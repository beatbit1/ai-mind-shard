import { useEffect, useState } from "react";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { useServerFn } from "@tanstack/react-start";
import { ledgerSnapshot, listInferenceProviders, listMemories } from "@/server/zg.functions";
import { getMemoryRecordRefs, getMemoryRoots, type MemoryRecordRef } from "@/lib/memoryRecords";
import { zeroGTestnet } from "@/lib/wallet";

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

export function Dashboard() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const wallet = address ?? "guest";
  const onZeroG = chainId === zeroGTestnet.id;

  const snapshotFn = useServerFn(ledgerSnapshot);
  const providersFn = useServerFn(listInferenceProviders);
  const listFn = useServerFn(listMemories);

  const [snap, setSnap] = useState<SnapshotState>({ status: "loading" });
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsErr, setRecordsErr] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function refreshRecords() {
    // Pull refs from the connected wallet AND any guest-scoped records that
    // were created before the wallet was connected — judges should see them all.
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
        // Always render every root we know about, even if download failed,
        // so the tx hash is still surfaced for verification.
        const byRoot = new Map<string, RecordItem>(
          (r.items as RecordItem[]).map((it) => [it.rootHash, it]),
        );
        const merged: RecordItem[] = uniqRoots.map((root) => {
          const ref = refByRoot.get(root);
          const item = byRoot.get(root);
          if (item && item.ok) return { ...item, txHash: ref?.txHash, proof: ref };
          if (item) return { ...item, txHash: ref?.txHash };
          // Server didn't return this root — fall back to the local ref.
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
      } else setRecordsErr(r.error.message);
    } catch (e) {
      setRecordsErr(e instanceof Error ? e.message : String(e));
    }
    setRecordsLoading(false);
  }

  useEffect(() => {
    // Snapshot is fast — do it first. Providers + records run in background.
    refreshSnapshot();
    refreshProviders();
    refreshRecords();
    const a = setInterval(refreshSnapshot, 15_000);
    const b = setInterval(refreshRecords, 30_000);
    return () => {
      clearInterval(a);
      clearInterval(b);
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
              <button
                onClick={() => {
                  refreshSnapshot();
                  refreshProviders();
                  refreshRecords();
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
              link={isConnected && address ? `https://chainscan-galileo.0g.ai/address/${address}` : undefined}
              tone={isConnected ? undefined : "warn"}
            />
            <Stat
              label="Tonara agent wallet (server)"
              value={ok ? `${ok.walletOG.toFixed(4)} OG` : snap.status === "loading" ? "…" : "—"}
              sub={ok ? short(ok.address) : agentAddress ? short(agentAddress) : "loading"}
              link={
                ok || agentAddress
                  ? `https://chainscan-galileo.0g.ai/address/${ok?.address ?? agentAddress}`
                  : undefined
              }
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

          {/* Funding CTA — the agent hot wallet is what pays for storage + inference */}
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
                    for ongoing calls. Your personal wallet's balance does not count.
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

          {isConnected && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  How signing works
                </div>
                <p className="mt-1 max-w-2xl text-xs text-foreground">
                  Your wallet <span className="font-mono">{short(address ?? "")}</span> is used as
                  identity & encryption scope. The Tonara <span className="font-medium">agent
                  wallet</span> on the server signs and pays gas for storage + inference — so
                  MetaMask will <span className="font-medium">not</span> pop up for each request.
                  Tx hashes appear in the records table below for verification.
                </p>
              </div>
              <button
                onClick={() => disconnect()}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-destructive hover:text-background"
              >
                Disconnect wallet
              </button>
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
                  : "No records yet. Fund the agent wallet, then send a message in Mnemos or run a query in Atlas."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Root hash</th>
                    <th className="px-3 py-2">Tx hash</th>
                    <th className="px-3 py-2">Proof</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Session</th>
                    <th className="px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 10).map((r) => (
                    <tr key={r.rootHash} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {short(r.rootHash)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {r.txHash ? (
                          <a
                            href={`https://chainscan-galileo.0g.ai/tx/${r.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline-offset-2 hover:underline"
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
