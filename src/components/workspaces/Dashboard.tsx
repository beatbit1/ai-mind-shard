import { useEffect, useState } from "react";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { useServerFn } from "@tanstack/react-start";
import {
  ledgerSnapshot,
  listInferenceProviders,
  listMemories,
  verifyTxs,
} from "@/server/zg.functions";
import { getMemoryRecordRefs, getMemoryRoots, type MemoryRecordRef } from "@/lib/memoryRecords";
import { getAgentActions, type AgentAction } from "@/lib/agentActions";
import { zeroGTestnet } from "@/lib/wallet";

const EXPLORER = "https://chainscan-galileo.0g.ai";
const STORAGE_EXPLORER = "https://storagescan-galileo.0g.ai";

type SnapshotData = {
  address: string;
  walletOG: number;
  ledgerOG: number;
  blockNumber: number;
  chainId: number;
  ts: number;
};

type SnapshotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: SnapshotData }
  | { status: "err"; message: string; address?: string };

type ProviderItem = { provider: string; model: string; url: string };

type RecordItem =
  | {
      ok: true;
      rootHash: string;
      role: "user" | "assistant";
      sessionId: string;
      ts: number;
      sizeBytes: number;
      txHash?: string;
      proof?: MemoryRecordRef;
      locations?: Array<{ url: string; shardId: number | null }>;
      latencyMs: number;
    }
  | { ok: false; rootHash: string; txHash?: string; error: string; latencyMs: number };

type TxStatus = "confirmed" | "pending" | "failed" | "unknown";
type TxStatusItem = {
  txHash: string;
  status: TxStatus;
  blockNumber?: number;
  confirmations?: number;
};

export function Dashboard() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const wallet = address ?? "guest";
  const onZeroG = chainId === zeroGTestnet.id;

  const snapshotFn = useServerFn(ledgerSnapshot);
  const providersFn = useServerFn(listInferenceProviders);
  const listFn = useServerFn(listMemories);
  const verifyFn = useServerFn(verifyTxs);

  const [snap, setSnap] = useState<SnapshotState>({ status: "loading" });
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsErr, setRecordsErr] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [txStatus, setTxStatus] = useState<Record<string, TxStatusItem>>({});
  const [actions, setActions] = useState<AgentAction[]>([]);

  async function refreshSnapshot() {
    try {
      const r: any = await snapshotFn({});
      if (r.ok) {
        setSnap({ status: "ok", data: r as SnapshotData });
        setLastFetched(Date.now());
      } else {
        setSnap({ status: "err", message: r.error?.message ?? "unknown", address: r.address });
      }
    } catch (e) {
      setSnap({ status: "err", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function refreshProviders() {
    try {
      const r: any = await providersFn({});
      if (r.ok) setProviders(r.services);
    } catch {
      /* ignore */
    }
  }

  function refreshActions() {
    const keys = wallet === "guest" ? ["guest"] : [wallet, "guest"];
    const all: AgentAction[] = [];
    for (const k of keys) for (const a of getAgentActions(k)) all.push(a);
    all.sort((a, b) => b.ts - a.ts);
    setActions(all.slice(0, 25));
  }

  async function refreshTxStatus(hashes: string[]) {
    const uniq = Array.from(new Set(hashes.filter(Boolean)));
    if (uniq.length === 0) return;
    try {
      const r: any = await verifyFn({ data: { txHashes: uniq } });
      if (r.ok) {
        setTxStatus((prev) => {
          const next = { ...prev };
          for (const it of r.items as TxStatusItem[]) next[it.txHash] = it;
          return next;
        });
      }
    } catch {
      /* ignore */
    }
  }

  async function refreshRecords() {
    const keys = wallet === "guest" ? ["guest"] : [wallet, "guest"];
    const allRefs: MemoryRecordRef[] = [];
    const allRoots: string[] = [];
    for (const k of keys) {
      for (const ref of getMemoryRecordRefs(k)) allRefs.push(ref);
      for (const r of getMemoryRoots(k)) allRoots.push(r);
    }
    const refByRoot = new Map(allRefs.map((r) => [r.rootHash, r]));
    const uniqRoots = Array.from(new Set(allRoots));

    if (uniqRoots.length === 0) {
      setRecords([]);
      return;
    }
    setRecordsLoading(true);
    setRecordsErr(null);
    try {
      const r: any = await listFn({ data: { rootHashes: uniqRoots } });
      if (r.ok) {
        const byRoot = new Map<string, RecordItem>(
          (r.items as RecordItem[]).map((it) => [it.rootHash, it]),
        );
        const merged: RecordItem[] = uniqRoots.map((root) => {
          const ref = refByRoot.get(root);
          const item = byRoot.get(root);
          if (item && item.ok) return { ...item, txHash: ref?.txHash, proof: ref };
          if (item) return { ...item, txHash: ref?.txHash };
          return ref
            ? {
                ok: true,
                rootHash: root,
                role: ref.role ?? "user",
                sessionId: ref.sessionId ?? "",
                ts: ref.ts ?? 0,
                sizeBytes: ref.sizeBytes ?? 0,
                txHash: ref.txHash,
                proof: ref,
                locations: [],
                latencyMs: 0,
              }
            : { ok: false, rootHash: root, error: "missing", latencyMs: 0 };
        });
        merged.sort((a, b) => {
          const ta = a.ok ? a.ts : refByRoot.get(a.rootHash)?.ts ?? 0;
          const tb = b.ok ? b.ts : refByRoot.get(b.rootHash)?.ts ?? 0;
          return tb - ta;
        });
        setRecords(merged);
        // Verify tx confirmation status on-chain
        refreshTxStatus(merged.map((m) => m.txHash || "").filter(Boolean));
      } else setRecordsErr(r.error.message);
    } catch (e) {
      setRecordsErr(e instanceof Error ? e.message : String(e));
    }
    setRecordsLoading(false);
  }

  useEffect(() => {
    refreshSnapshot();
    refreshProviders();
    refreshRecords();
    refreshActions();
    const a = setInterval(refreshSnapshot, 15_000);
    const b = setInterval(refreshRecords, 30_000);
    const c = setInterval(refreshActions, 5_000);
    // Listen to localStorage changes from Mnemos/Atlas in same tab
    const onStorage = () => refreshActions();
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(a);
      clearInterval(b);
      clearInterval(c);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  const ok = snap.status === "ok" ? snap.data : null;
  const okCount = records.filter((r) => r.ok).length;
  const agentAddress = ok?.address ?? (snap.status === "err" ? snap.address ?? "" : "");
  const needsFunding = ok ? ok.walletOG < 0.5 : false;

  const statusPill =
    snap.status === "ok"
      ? needsFunding
        ? { label: "agent wallet low", tone: "warn" as const }
        : { label: "0G online", tone: "ok" as const }
      : snap.status === "err"
        ? snap.message.toLowerCase().includes("not configured")
          ? { label: "not configured", tone: "warn" as const }
          : { label: "0G error", tone: "err" as const }
        : { label: "loading…", tone: "muted" as const };

  function copyAddress() {
    if (!agentAddress) return;
    navigator.clipboard.writeText(agentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      {/* HEADER + STATS */}
      <div className="rounded-2xl border border-border bg-surface p-1">
        <div className="rounded-xl bg-background p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Live 0G state · Galileo testnet · chain 16602
              </div>
              <h2 className="mt-0.5 font-display text-lg font-semibold lg:text-xl">Dashboard</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Pill tone={statusPill.tone}>{statusPill.label}</Pill>
              {ok && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  block #{ok.blockNumber.toLocaleString()} · chain {ok.chainId}
                </span>
              )}
              {isConnected && (
                <button
                  onClick={() => disconnect()}
                  className="rounded-full border border-border px-3 py-1 text-xs text-foreground transition-colors hover:bg-destructive hover:text-background"
                >
                  Disconnect
                </button>
              )}
              <button
                onClick={() => {
                  refreshSnapshot();
                  refreshProviders();
                  refreshRecords();
                  refreshActions();
                }}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Your wallet"
              value={isConnected && address ? "connected" : "not connected"}
              sub={isConnected && address ? short(address) : "click Connect Wallet ↗"}
              link={isConnected && address ? `${EXPLORER}/address/${address}` : undefined}
              tone={isConnected ? undefined : "warn"}
            />
            <Stat
              label="Tonara agent wallet (server)"
              value={ok ? `${ok.walletOG.toFixed(4)} OG` : snap.status === "loading" ? "…" : "—"}
              sub={ok ? short(ok.address) : agentAddress ? short(agentAddress) : "loading"}
              link={ok || agentAddress ? `${EXPLORER}/address/${ok?.address ?? agentAddress}` : undefined}
              tone={needsFunding ? "warn" : undefined}
            />
            <Stat
              label="Inference ledger"
              value={ok ? `${ok.ledgerOG.toFixed(5)} OG` : "—"}
              sub="0G Compute · prepaid"
            />
            <Stat
              label="Memory records"
              value={recordsLoading ? "…" : String(okCount)}
              sub={`${records.length} tracked${recordsErr ? " · err" : ""}`}
            />
          </div>
          {providers.length > 0 && (
            <div className="mt-2 font-mono text-[10.5px] text-muted-foreground">
              {providers.length} inference providers · {providers[0].model}
            </div>
          )}

          {/* Funding CTA */}
          {agentAddress && (needsFunding || snap.status === "err") && (
            <div className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-500">
                    Action needed · agent wallet under-funded
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-foreground">
                    Tonara's agent wallet pays for every 0G Storage upload and inference call.
                    It needs at least <span className="font-medium">3 OG</span> to open the
                    inference ledger and a topup of <span className="font-medium">~1 OG</span>{" "}
                    for ongoing calls.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <span className="rounded-md border border-border bg-surface px-2 py-1">
                      {agentAddress}
                    </span>
                    <button
                      onClick={copyAddress}
                      className="rounded-md border border-border px-2 py-1 text-foreground transition-colors hover:bg-secondary"
                    >
                      {copied ? "✓ copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <a
                  href="https://faucet.0g.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  Open 0G faucet ↗
                </a>
              </div>
            </div>
          )}

          {snap.status === "err" && !needsFunding && (
            <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              <span className="text-foreground">0G error:</span> {snap.message}
            </div>
          )}

          {!isConnected && (
            <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-center font-mono text-[11px] text-muted-foreground">
              connect your wallet to scope memory records to your address
            </div>
          )}

          {isConnected && !onZeroG && (
            <div className="mt-4 rounded-xl border border-destructive/40 bg-surface px-4 py-3 text-center font-mono text-[11px] text-destructive">
              wallet connected on chain {chainId}; switch to 0G Galileo chain {zeroGTestnet.id} for accurate network state
            </div>
          )}
        </div>
      </div>

      {/* RECORDS TABLE */}
      <div className="rounded-2xl border border-border bg-surface p-1">
        <div className="rounded-xl bg-background p-5 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Recent on-chain memory records
              </div>
              <h3 className="mt-0.5 font-display text-base font-semibold lg:text-lg">
                Last {Math.min(records.length, 10)} of {records.length}
              </h3>
            </div>
            {lastFetched && (
              <span className="font-mono text-[10.5px] text-muted-foreground">
                updated {new Date(lastFetched).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            {records.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {recordsLoading
                  ? "fetching from 0G Storage…"
                  : "No records yet. Send a message in Mnemos or run a query in Atlas."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Root hash</th>
                    <th className="px-3 py-2">Tx hash</th>
                    <th className="px-3 py-2">Proof</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Session</th>
                    <th className="px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 10).map((r) => {
                    const tx = r.txHash ? txStatus[r.txHash] : undefined;
                    const status: TxStatus = tx?.status ?? (r.txHash ? "pending" : "unknown");
                    return (
                      <tr key={r.rootHash} className="border-t border-border hover:bg-surface/50">
                        <td className="px-3 py-2">
                          <StatusBadge
                            status={status}
                            confirmations={tx?.confirmations}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          <a
                            href={`${STORAGE_EXPLORER}/file/${r.rootHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline-offset-2 hover:underline"
                            title={r.rootHash}
                          >
                            {short(r.rootHash)} ↗
                          </a>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          {r.txHash ? (
                            <a
                              href={`${EXPLORER}/tx/${r.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline-offset-2 hover:underline"
                              title={r.txHash}
                            >
                              {short(r.txHash)} ↗
                            </a>
                          ) : (
                            <span className="text-muted-foreground">indexed</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {r.ok ? `${r.locations?.length ?? 0} nodes · ${formatBytes(r.sizeBytes)}` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {r.ok ? (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest">
                              {r.role}
                            </span>
                          ) : (
                            <span className="text-destructive">decrypt err</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {r.ok ? short(r.sessionId) : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {r.ok ? `${timeAgo(r.ts)} · ${r.latencyMs}ms` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
            click any hash → opens on the 0G Galileo explorer (storagescan / chainscan)
          </div>
        </div>
      </div>

      {/* AGENT ACTIONS */}
      <div className="rounded-2xl border border-border bg-surface p-1">
        <div className="rounded-xl bg-background p-5 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Latest agent actions
              </div>
              <h3 className="mt-0.5 font-display text-base font-semibold lg:text-lg">
                Inference · shard reassembly · cross-chain
              </h3>
            </div>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {actions.length} entries
            </span>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            {actions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No agent activity yet — actions will appear here as soon as Mnemos or Atlas runs.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Tx</th>
                    <th className="px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <KindBadge kind={a.kind} ok={a.ok} />
                      </td>
                      <td className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                        {a.source}
                      </td>
                      <td className="px-3 py-2 text-[12.5px]">
                        <div className={a.ok ? "" : "text-destructive"}>{a.label}</div>
                        {a.error && (
                          <div className="font-mono text-[10px] text-destructive/80">{a.error}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {a.txHash ? (
                          <a
                            href={`${EXPLORER}/tx/${a.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline-offset-2 hover:underline"
                          >
                            {short(a.txHash)} ↗
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {timeAgo(a.ts)}
                        {a.latencyMs ? ` · ${a.latencyMs}ms` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {providers.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-1">
          <div className="rounded-xl bg-background p-5 lg:p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Inference providers online
            </div>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {providers.slice(0, 6).map((s) => (
                <div
                  key={s.provider}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[11px]"
                >
                  <span>{s.model}</span>
                  <span className="text-muted-foreground">{short(s.provider)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, confirmations }: { status: TxStatus; confirmations?: number }) {
  const map: Record<TxStatus, { label: string; cls: string; dot: string }> = {
    confirmed: {
      label: confirmations ? `confirmed · ${confirmations}` : "confirmed",
      cls: "border-green-500/40 text-green-500",
      dot: "bg-green-500",
    },
    pending: {
      label: "pending",
      cls: "border-yellow-500/40 text-yellow-500",
      dot: "bg-yellow-500 animate-pulse",
    },
    failed: {
      label: "failed",
      cls: "border-destructive/50 text-destructive",
      dot: "bg-destructive",
    },
    unknown: {
      label: "indexing",
      cls: "border-border text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  };
  const m = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function KindBadge({ kind, ok }: { kind: AgentAction["kind"]; ok: boolean }) {
  const cls = ok ? "border-border text-foreground" : "border-destructive/50 text-destructive";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${cls}`}>
      {kind}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  link,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  link?: string;
  tone?: "warn";
}) {
  return (
    <div
      className={`rounded-xl border bg-surface p-4 ${
        tone === "warn" ? "border-yellow-500/40" : "border-border"
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl font-semibold tabular-nums ${
          tone === "warn" ? "text-yellow-500" : ""
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="hover:underline">
              {sub} ↗
            </a>
          ) : (
            sub
          )}
        </div>
      )}
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "err" | "muted" }) {
  const cls =
    tone === "ok"
      ? "border-green-500/40 text-green-500"
      : tone === "warn"
        ? "border-yellow-500/40 text-yellow-500"
        : tone === "err"
          ? "border-destructive/50 text-destructive"
          : "border-border text-muted-foreground";
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "ok" ? "bg-green-500 animate-pulse" : tone === "warn" ? "bg-yellow-500" : tone === "err" ? "bg-destructive" : "bg-muted-foreground"}`} />
      {children}
    </span>
  );
}

function short(s: string) {
  if (!s) return "";
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
