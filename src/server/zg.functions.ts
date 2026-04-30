import { createServerFn } from "@tanstack/react-start";
import {
  assertFunded,
  getBroker,
  getIndexer,
  getProvider,
  getWallet,
  ZGNotConfiguredError,
  ZGUnfundedError,
} from "./zg.core.server";
import { decrypt, encrypt } from "./zg.crypto.server";
import { ensureLedgerFunded, getLedgerBalanceOG } from "./zg.ledger.server";

const PREFERRED_MODELS = ["llama-3.3-70b-instruct", "deepseek-r1-70b"];
const SYSTEM_PROMPT = `You are Mnemos — a senior coding and blockchain research companion running on 0G's decentralized compute network. You specialize in Solidity, EVM internals, account abstraction (ERC-4337), DeFi protocol design, on-chain indexing, gas optimization, security auditing, and reading raw blockchain data. Be precise, cite EIPs/standards by number, prefer code examples over prose, and flag risks (reentrancy, oracle manipulation, MEV, upgrade footguns). When recalling prior context from the user's encrypted memory on 0G Storage, reference it explicitly so they know it was retrieved.`;

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function downloadRootBlob(indexer: any, root: string): Promise<Buffer> {
  const { readFile, unlink } = await import("fs/promises");
  const safeRoot = root.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  const filePath = `/tmp/tonara-${safeRoot}-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`;
  const err = await indexer.download(root, filePath, true);
  if (err) throw new Error(`download: ${err.message ?? err}`);
  const blob = await readFile(filePath);
  await unlink(filePath).catch(() => {});
  return Buffer.from(blob);
}

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
      const meta = await broker.inference.getServiceMetadata(chosen.provider).catch(() => null);
      const model = meta?.model ?? chosen.model;

      const messages: ChatMsg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages];
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const headers = await broker.inference.getRequestHeaders(chosen.provider, lastUser);

      // Broker metadata returns the OpenAI-compatible endpoint, usually /v1/proxy.
      const endpointBase = String(meta?.endpoint ?? chosen.url).replace(/\/+$/, "");
      const endpoint = `${endpointBase}/chat/completions`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ model, messages }),
      });
      if (!res.ok) throw new Error(`Inference HTTP ${res.status} @ ${endpoint}: ${await res.text()}`);
      const json: any = await res.json();
      const reply: string = json.choices?.[0]?.message?.content ?? "";
      const chatId: string = json.id ?? "";
      if (!reply.trim()) throw new Error(`Inference returned empty response @ ${endpoint}`);

      let valid = true;
      try {
        valid = await broker.inference.processResponse(chosen.provider, chatId, reply);
      } catch {
        valid = false;
      }

      const ledgerOG = await getLedgerBalanceOG();
      return {
        ok: true as const,
        reply,
        provider: chosen.provider,
        model,
        latencyMs: Date.now() - t0,
        ledgerOG,
        verified: valid,
      };
    } catch (e) {
      return { ok: false as const, error: toSafeError(e), latencyMs: Date.now() - t0 };
    }
  });

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

      // Use MemData (in-memory) — ZgFile requires a real file descriptor and breaks on Workers
      const { MemData } = await import("@0glabs/0g-ts-sdk");
      const file = new (MemData as any)(blob);

      const [tree, treeErr] = await (file as any).merkleTree();
      if (treeErr) throw new Error(`merkleTree: ${treeErr}`);
      const rootHash: string = tree.rootHash();

      const proof = tree.proofAt(0);
      const [tx, upErr] = await (indexer as any).upload(file, "https://evmrpc-testnet.0g.ai", wallet);
      if (upErr) throw new Error(`upload: ${upErr}`);
      const txHash = typeof tx === "string" ? tx : (tx?.txHash ?? tx?.hash ?? "");
      const locations = await (indexer as any).getFileLocations(rootHash).catch(() => []);

      return {
        ok: true as const,
        rootHash,
        txHash,
        proof: { lemma: proof.lemma, path: proof.path, segments: file.numSegments() },
        locations: locations.map((n: any) => ({ url: n.url, shardId: n.shardId ?? n.shard_id ?? null })),
        sizeBytes: blob.length,
        latencyMs: Date.now() - t0,
      };
    } catch (e) {
      return { ok: false as const, error: toSafeError(e), latencyMs: Date.now() - t0 };
    }
  });

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
          const blob = await downloadRootBlob(indexer, root);
          const json = JSON.parse(decrypt(blob));
          memories.push({
            rootHash: root,
            role: json.role,
            text: json.text,
            ts: json.ts,
            latencyMs: Date.now() - ts0,
          });
        } catch {
        }
      }

      return { ok: true as const, memories, latencyMs: Date.now() - t0 };
    } catch (e) {
      return { ok: false as const, error: toSafeError(e), latencyMs: Date.now() - t0 };
    }
  });

export const zgStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await assertFunded();
    const ledgerOG = await getLedgerBalanceOG().catch(() => 0);
    return { ok: true as const, address: getWallet().address, ledgerOG };
  } catch (e) {
    return { ok: false as const, error: toSafeError(e) };
  }
});

export const ledgerSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await assertFunded();
    const wallet = getWallet();
    const provider = getProvider();
    const [walletWei, blockNumber, ledgerOG] = await Promise.all([
      provider.getBalance(wallet.address).catch(() => 0n),
      provider.getBlockNumber().catch(() => 0),
      getLedgerBalanceOG().catch(() => 0),
    ]);
    return {
      ok: true as const,
      address: wallet.address,
      walletOG: Number(walletWei) / 1e18,
      ledgerOG,
      blockNumber,
      chainId: 16602,
      ts: Date.now(),
    };
  } catch (e) {
    // Always return a safe envelope — never let createServerFn surface a 500.
    if (e instanceof ZGNotConfiguredError || e instanceof ZGUnfundedError) {
      return { ok: false as const, error: toSafeError(e) };
    }
    // Even if the wallet is unfunded, expose its address so the user can fund it.
    let address = "";
    try {
      address = getWallet().address;
    } catch {
      /* ignore */
    }
    return {
      ok: false as const,
      error: toSafeError(e),
      address,
    };
  }
});

export const listInferenceProviders = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await assertFunded();
    const broker = await getBroker();
    const list: any[] = await broker.inference.listService();
    return {
      ok: true as const,
      services: list.slice(0, 10).map((s) => ({
        provider: s.provider,
        model: s.model,
        url: s.url,
      })),
    };
  } catch (e) {
    return { ok: false as const, error: toSafeError(e) };
  }
});

export const listMemories = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { rootHashes: string[] })
  .handler(async ({ data }) => {
    const t0 = Date.now();
    try {
      await assertFunded();
      const indexer = await getIndexer();
      const roots = data.rootHashes.slice(-50);
      const items = await Promise.all(
        roots.map(async (root) => {
          const t1 = Date.now();
          try {
            const blob = await downloadRootBlob(indexer, root);
            const json = JSON.parse(decrypt(blob));
            const locations = await (indexer as any).getFileLocations(root).catch(() => []);
            return {
              rootHash: root,
              role: json.role as "user" | "assistant",
              sessionId: json.sessionId as string,
              ts: json.ts as number,
              sizeBytes: blob.length,
              wallet: json.wallet as string,
              locations: locations.map((n: any) => ({ url: n.url, shardId: n.shardId ?? n.shard_id ?? null })),
              latencyMs: Date.now() - t1,
              ok: true as const,
            };
          } catch (err) {
            return {
              rootHash: root,
              ok: false as const,
              error: err instanceof Error ? err.message : String(err),
              latencyMs: Date.now() - t1,
            };
          }
        }),
      );
      const good = items.filter((i: any) => i.ok);
      return {
        ok: true as const,
        count: good.length,
        items: items.sort((a: any, b: any) => (b.ts ?? 0) - (a.ts ?? 0)),
        latencyMs: Date.now() - t0,
      };
    } catch (e) {
      return { ok: false as const, error: toSafeError(e), latencyMs: Date.now() - t0 };
    }
  });
