import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useServerFn } from "@tanstack/react-start";
import { ledgerSnapshot, listMemories } from "@/server/zg.functions";

const ROOTS_PREFIX = "tonara.mnemos.roots.";

type SnapshotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: Awaited<ReturnType<typeof callOk>> }
  | { status: "err"; message: string };

// helper type
async function callOk() {
  return {} as {
    address: string;
    walletOG: number;
    ledgerOG: number;
    blockNumber: number;
    chainId: number;
    services: Array<{ provider: string; model: string; url: string }>;
    ts: number;
  };
}

type RecordItem =
  | {
      ok: true;
      rootHash: string;
      role: "user" | "assistant";
      sessionId: string;
      ts: number;
      sizeBytes: number;
      latencyMs: number;
    }
  | { ok: false; rootHash: string; error: string; latencyMs: number };

export function Dashboard() {
  const { isConnected, address } = useAccount();
  const wallet = address ?? "guest";
  const rootsKey = useMemo(() => ROOTS_PREFIX + wallet, [wallet]);

  const snapshotFn = useServerFn(ledgerSnapshot);
  const listFn = useServerFn(listMemories);

  const [snap, setSnap] = useState<SnapshotState>({ status: "idle" });
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsErr, setRecordsErr] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  function getRoots(): string[] {
    try {
      return JSON.parse(localStorage.getItem(rootsKey) ?? "[]");
    } catch {
      return [];
    }
  }

  async function refreshSnapshot() {
    setSnap((s) => (s.status === "ok" ? s : { status: "loading" }));
    const r = await snapshotFn({});
    if (r.ok) {
      setSnap({ status: "ok", data: r as any });
      setLastFetched(Date.now());
    } else {
      setSnap({ status: "err", message: r.error.message });
    }
  }

  async function refreshRecords() {
    const roots = getRoots();
    if (roots.length === 0) {
      setRecords([]);
      return;
    }
    setRecordsLoading(true);
    setRecordsErr(null);
    const r = await listFn({ data: { rootHashes: roots } });
    setRecordsLoading(false);
    if (r.ok) {
      setRecords(r.items as RecordItem[]);
    } else {
      setRecordsErr(r.error.message);
    }
  }

  useEffect(() => {
    refreshSnapshot();
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

  const statusPill =
    snap.status === "ok"
      ? { label: "0G online", tone: "ok" as const }
      : snap.status === "err"
        ? snap.message.toLowerCase().includes("not configured")
          ? { label: "not configured", tone: "warn" as const }
          : snap.message.toLowerCase().includes("unfunded") || snap.message.toLowerCase().includes("balance")
            ? { label: "wallet unfunded", tone: "warn" as const }
            : { label: "0G error", tone: "err" as const }
        : { label: "checking…", tone: "muted" as const };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-1">
        <div className="rounded-xl bg-background p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Live 0G state · Galileo testnet
              </div>
              <h2 className="mt-0.5 font-display text-lg font-semibold">Dashboard</h2>
            </div>
            <div className="flex items-center gap-3">
              <Pill tone={statusPill.tone}>{statusPill.label}</Pill>
              {ok && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  block #{ok.blockNumber.toLocaleString()} · chain {ok.chainId}
                </span>
              )}
              <button
                onClick={() => {
                  refreshSnapshot();
                  refreshRecords();
                }}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Agent wallet"
              value={ok ? `${ok.walletOG.toFixed(4)} OG` : "—"}
              sub={ok ? short(ok.address) : "loading"}
              link={ok ? `https://chainscan-galileo.0g.ai/address/${ok.address}` : undefined}
            />
            <Stat
              label="Inference ledger"
              value={ok ? `${ok.ledgerOG.toFixed(5)} OG` : "—"}
              sub="0G Compute"
            />
            <Stat
              label="Memory records"
              value={recordsLoading ? "…" : String(okCount)}
              sub={`${records.length} tracked${recordsErr ? " · err" : ""}`}
            />
            <Stat
              label="Inference providers"
              value={ok ? String(ok.services.length) : "—"}
              sub={ok && ok.services[0] ? ok.services[0].model : "discovering"}
            />
          </div>

          {snap.status === "err" && (
            <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              <span className="text-foreground">0G error:</span> {snap.message}
            </div>
          )}

          {!isConnected && (
            <div className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-center font-mono text-[11px] text-muted-foreground">
              connect your wallet to scope records to your address
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-1">
        <div className="rounded-xl bg-background p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Recent on-chain memory records
              </div>
              <h3 className="mt-0.5 font-display text-base font-semibold">
                Last {Math.min(records.length, 10)} of {records.length}
              </h3>
            </div>
            {lastFetched && (
              <span className="font-mono text-[10.5px] text-muted-foreground">
                updated {new Date(lastFetched).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {records.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {recordsLoading
                  ? "fetching from 0G Storage…"
                  : "No records yet. Send your first message in Mnemos or run a query in Atlas."}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Root</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Session</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 10).map((r) => (
                    <tr key={r.rootHash} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-[11px]">
                        <a
                          href={`https://chainscan-galileo.0g.ai/address/${r.rootHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          {short(r.rootHash)}
                        </a>
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
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {r.ok ? formatBytes(r.sizeBytes) : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {r.ok ? timeAgo(r.ts) : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {r.latencyMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {ok && ok.services.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-1">
          <div className="rounded-xl bg-background p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Inference providers online
            </div>
            <div className="mt-3 space-y-1">
              {ok.services.slice(0, 6).map((s) => (
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
}: {
  label: string;
  value: string;
  sub?: string;
  link?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
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
