import { createServerFn } from "@tanstack/react-start";
import {
  agentAddress,
  commitMemoryOnChain,
  getInferenceLedgerBalance,
  getMainnetSnapshot,
  getOnChainMemoryRecords,
  getOnChainRecordCount,
  getTonaraBalance,
  type MemoryKind,
} from "./zg.contracts.server";

export const mainnetSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const snap = await getMainnetSnapshot();
    return { ok: true as const, ...snap };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
      agent: (() => { try { return agentAddress(); } catch { return ""; } })(),
    };
  }
});

export const mainnetUserStats = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { wallet: string })
  .handler(async ({ data }) => {
    try {
      const [tonara, count, ledger, records] = await Promise.all([
        getTonaraBalance(data.wallet),
        getOnChainRecordCount(data.wallet),
        getInferenceLedgerBalance(data.wallet),
        getOnChainMemoryRecords(data.wallet, 10),
      ]);
      return {
        ok: true as const,
        tonaraBalance: tonara.formatted,
        tonaraRaw: tonara.raw,
        memoryCount: count,
        ledgerBalanceOG: ledger,
        records,
      };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  });

export const anchorMemoryOnMainnet = createServerFn({ method: "POST" })
  .inputValidator(
    (d: unknown) =>
      d as {
        owner: string;
        rootHash: string;
        sizeBytes: number;
        role: "user" | "assistant";
        sessionId: string;
      },
  )
  .handler(async ({ data }) => {
    const kind: MemoryKind = data.role === "assistant" ? 1 : 0;
    return commitMemoryOnChain({
      owner: data.owner,
      rootHash: data.rootHash,
      sizeBytes: data.sizeBytes,
      kind,
      sessionId: data.sessionId,
    });
  });
