import { createServerFn } from "@tanstack/react-start";
import {
  assertFunded,
  getBroker,
  getIndexer,
  getWallet,
  ZGNotConfiguredError,
  ZGUnfundedError,
} from "./zg.core.server";
import { decrypt, encrypt } from "./zg.crypto.server";
import { ensureLedgerFunded, getLedgerBalanceOG } from "./zg.ledger.server";

const PREFERRED_MODELS = ["llama-3.3-70b-instruct", "deepseek-r1-70b"];
const SYSTEM_PROMPT = `You are Mnemos — a senior coding and blockchain research companion running on 0G's decentralized compute network. You specialize in Solidity, EVM internals, account abstraction (ERC-4337), DeFi protocol design, on-chain indexing, gas optimization, security auditing, and reading raw blockchain data. Be precise, cite EIPs/standards by number, prefer code examples over prose, and flag risks (reentrancy, oracle manipulation, MEV, upgrade footguns). When recalling prior context from the user's encrypted memory on 0G Storage, reference it explicitly so they know it was retrieved.`;

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

function toSafeError(e: unknown): { kind: string; message: string; address?: string } {
  if (e instanceof ZGNotConfiguredError) {
    return { kind: "not_configured", message: e.message };
  }
  if (e instanceof ZGUnfundedError) {
    return { kind: "unfunded", message: e.message, address: e.address };
  }
  const msg = e instanceof Error ? e.message : String(e);
  return { kind: "error", message: msg };
}

// ─── chat0g ──────────────────────────────────────────────────────────────────
export const chat0g = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { messages: ChatMsg[] })
  .handler(async ({ data }) => {
    const t0 = Date.now();
    try {
      await assertFunded();
      await ensureLedgerFunded();
      const broker = await getBroker();

      const services: any[] = await broker.inference.listService();
      let chosen = services.find((s) => PREFERRED_MODELS.includes(s.model));
      if (!chosen) chosen = services[0];
      if (!chosen) throw new Error("No 0G inference providers available");

      await broker.inference.acknowledgeProviderSigner(chosen.provider).catch(() => {});

      const messages: ChatMsg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages];
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const headers = await broker.inference.getRequestHeaders(chosen.provider, lastUser);

      const res = await fetch(`${chosen.url}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ model: chosen.model, messages }),
      });
      if (!res.ok) throw new Error(`Inference HTTP ${res.status}: ${await res.text()}`);
      const json: any = await res.json();
      const reply: string = json.choices?.[0]?.message?.content ?? "";
      const chatId: string = json.id ?? "";

      let valid = true;
      try {
        valid = await broker.inference.processResponse(chosen.provider, reply, chatId);
      } catch {
        valid = false;
      }

      const ledgerOG = await getLedgerBalanceOG();
      return {
        ok: true as const,
        reply,
        provider: chosen.provider,
        model: chosen.model,
        latencyMs: Date.now() - t0,
        ledgerOG,
        verified: valid,
      };
    } catch (e) {
      return { ok: false as const, error: toSafeError(e), latencyMs: Date.now() - t0 };
    }
  });

// ─── commitMemory ────────────────────────────────────────────────────────────
export const commitMemory = createServerFn({ method: "POST" })
  .inputValidator(
    (d: unknown) =>
      d as { wallet: string; role: "user" | "assistant"; text: string; sessionId: string },
  )
  .handler(async ({ data }) => {
    const t0 = Date.now();
    try {
      await assertFunded();
      const indexer = await getIndexer();
      const wallet = getWallet();

      const payload = JSON.stringify({
        v: 1,
        wallet: data.wallet,
        sessionId: data.sessionId,
        role: data.role,
        text: data.text,
        ts: Date.now(),
      });
      const blob = encrypt(payload);

      const { ZgFile } = await import("@0glabs/0g-ts-sdk");
      // ZgFile from buffer
      const file = (ZgFile as any).fromBuffer
        ? (ZgFile as any).fromBuffer(blob)
        : new (ZgFile as any)(blob);

      const [tree, treeErr] = await (file as any).merkleTree();
      if (treeErr) throw new Error(`merkleTree: ${treeErr}`);
      const rootHash: string = tree.rootHash();

      const [tx, upErr] = await (indexer as any).upload(file, "https://evmrpc-testnet.0g.ai", wallet);
      if (upErr) throw new Error(`upload: ${upErr}`);

      return {
        ok: true as const,
        rootHash,
        txHash: typeof tx === "string" ? tx : (tx?.hash ?? ""),
        sizeBytes: blob.length,
        latencyMs: Date.now() - t0,
      };
    } catch (e) {
      return { ok: false as const, error: toSafeError(e), latencyMs: Date.now() - t0 };
    }
  });

// ─── recallMemories ──────────────────────────────────────────────────────────
// Downloads a list of root hashes (passed from the client's persisted index) and decrypts them.
export const recallMemories = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { rootHashes: string[] })
  .handler(async ({ data }) => {
    const t0 = Date.now();
    try {
      await assertFunded();
      const indexer = await getIndexer();
      const memories: Array<{
        rootHash: string;
        role: "user" | "assistant";
        text: string;
        ts: number;
        latencyMs: number;
      }> = [];

      for (const root of data.rootHashes.slice(-20)) {
        const ts0 = Date.now();
        try {
          // SDK download API: download(rootHash, outFile?, withProof?) → returns Buffer in newer versions
          const result: any = await (indexer as any).download(root, true);
          const blob: Buffer = Buffer.isBuffer(result)
            ? result
            : result?.data
              ? Buffer.from(result.data)
              : Buffer.from(result);
          const json = JSON.parse(decrypt(blob));
          memories.push({
            rootHash: root,
            role: json.role,
            text: json.text,
            ts: json.ts,
            latencyMs: Date.now() - ts0,
          });
        } catch {
          // skip unreadable shards
        }
      }

      return { ok: true as const, memories, latencyMs: Date.now() - t0 };
    } catch (e) {
      return { ok: false as const, error: toSafeError(e), latencyMs: Date.now() - t0 };
    }
  });

// ─── status (for UI gating) ──────────────────────────────────────────────────
export const zgStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await assertFunded();
    const ledgerOG = await getLedgerBalanceOG().catch(() => 0);
    return { ok: true as const, address: getWallet().address, ledgerOG };
  } catch (e) {
    return { ok: false as const, error: toSafeError(e) };
  }
});
