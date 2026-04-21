import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Tonara Console — Agent Memory Operator" },
      {
        name: "description",
        content:
          "Operate your agent's encrypted long-term memory on 0G. Write, recall, and inspect shards across chains.",
      },
    ],
  }),
  component: AppDashboard,
});

type Memory = {
  id: string;
  preview: string;
  shards: number;
  chains: string[];
  size: string;
  created: string;
};

type LogEntry = {
  t: string;
  level: "info" | "ok" | "warn";
  msg: string;
};

const SEED_MEMORIES: Memory[] = [
  {
    id: "mem_0x4af2e1",
    preview: "User mentioned trouble sleeping; recommended 4-7-8 breathing.",
    shards: 6,
    chains: ["0G", "ETH"],
    size: "12.4 KB",
    created: "2m ago",
  },
  {
    id: "mem_0x9c11d8",
    preview: "Q3 vesting unlock schedule for portfolio token X — 3 tranches.",
    shards: 8,
    chains: ["0G", "ETH", "SOL"],
    size: "31.7 KB",
    created: "14m ago",
  },
  {
    id: "mem_0x2bda07",
    preview: "Research note: Solana DePIN landscape, 27 projects, ranked.",
    shards: 12,
    chains: ["0G", "SOL"],
    size: "84.2 KB",
    created: "1h ago",
  },
  {
    id: "mem_0x71f3aa",
    preview: "Agent identity handshake with openclaw://0x88a… (trusted).",
    shards: 4,
    chains: ["0G"],
    size: "3.1 KB",
    created: "3h ago",
  },
];

function AppDashboard() {
  const [memories, setMemories] = useState<Memory[]>(SEED_MEMORIES);
  const [query, setQuery] = useState("");
  const [recalling, setRecalling] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { t: ts(), level: "ok", msg: "Connected to 0G testnet · chain id 16600" },
    { t: ts(), level: "info", msg: "Agent identity loaded · openclaw://0x4af2…" },
  ]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  const stats = useMemo(() => {
    const totalShards = memories.reduce((a, m) => a + m.shards, 0);
    return [
      { label: "memories", value: memories.length.toString() },
      { label: "shards", value: totalShards.toString() },
      { label: "chains", value: "3" },
      { label: "spent", value: "0.0214 OG" },
    ];
  }, [memories]);

  function pushLog(level: LogEntry["level"], msg: string) {
    setLogs((l) => [...l, { t: ts(), level, msg }]);
  }

  async function handleRecall() {
    if (!query.trim() || recalling) return;
    setRecalling(true);
    pushLog("info", `recall("${query}") · resolving on-chain index…`);
    await wait(420);
    pushLog("info", "index hit · 6 shards located across 0G(4) ETH(1) SOL(1)");
    await wait(380);
    pushLog("info", "micropayment · 0.0021 OG → ShardEscrow");
    await wait(300);
    pushLog("info", "fetching shards in parallel…");
    await wait(520);
    pushLog("ok", "reassembled 6/6 · decrypted · 287ms total");
    setRecalling(false);
  }

  async function handleWrite() {
    pushLog("info", "encrypting memory · AES-256-GCM");
    await wait(220);
    pushLog("info", "erasure-coding · 8 shards (k=5, n=8)");
    await wait(260);
    pushLog("info", "dispatching shards · 0G(5) ETH(2) SOL(1)");
    await wait(380);
    pushLog("ok", "writeMemory tx confirmed · 0xa1f…c92");
    const m: Memory = {
      id: `mem_0x${Math.random().toString(16).slice(2, 8)}`,
      preview: "New memory written from console.",
      shards: 8,
      chains: ["0G", "ETH", "SOL"],
      size: "18.0 KB",
      created: "now",
    };
    setMemories((arr) => [m, ...arr]);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-foreground">
                <div className="h-2.5 w-2.5 rounded-[2px] bg-background" />
              </div>
              <span className="font-display text-base font-semibold">Tonara</span>
              <span className="ml-2 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                console
              </span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {["Memories", "Shards", "Agents", "Logs"].map((n, i) => (
                <button
                  key={n}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    i === 0
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                0G testnet
              </span>
            </div>
            <div className="rounded-full border border-border px-3 py-1.5 font-mono text-xs">
              0x4af2…e1c8
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-background p-5">
              <div className="font-display text-2xl font-semibold">{s.value}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Recall + Logs */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-border bg-surface p-1">
            <div className="rounded-xl bg-background p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Recall
                  </div>
                  <h2 className="mt-1 font-display text-xl font-semibold">
                    Query agent memory
                  </h2>
                </div>
                <button
                  onClick={handleWrite}
                  className="rounded-full border border-border px-4 py-2 text-xs transition-colors hover:bg-secondary"
                >
                  + Write memory
                </button>
              </div>

              <div className="mt-5 flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRecall()}
                  placeholder='e.g. "q3 vesting schedule"'
                  className="flex-1 rounded-full border border-border bg-background px-5 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
                />
                <button
                  onClick={handleRecall}
                  disabled={recalling || !query.trim()}
                  className="inline-flex items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {recalling ? "Recalling…" : "Recall"}
                </button>
              </div>

              <div className="mt-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Recent memories
                </div>
                <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                  {memories.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {m.id}
                        </div>
                        <div className="mt-1 truncate text-sm">{m.preview}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-right">
                        <div className="hidden gap-1 md:flex">
                          {m.chains.map((c) => (
                            <span
                              key={c}
                              className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px]"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {m.shards} shards · {m.size}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Logs */}
          <section className="rounded-2xl border border-border bg-surface p-1">
            <div className="rounded-xl bg-background p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Runtime
                  </div>
                  <h2 className="mt-1 font-display text-xl font-semibold">Live logs</h2>
                </div>
                <span className="h-2 w-2 animate-pulse rounded-full bg-foreground" />
              </div>
              <div
                ref={logRef}
                className="mt-5 h-80 overflow-y-auto rounded-xl border border-border bg-background p-4 font-mono text-[12px] leading-relaxed"
              >
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="select-none text-border">{l.t}</span>
                    <span
                      className={
                        l.level === "ok"
                          ? "text-foreground"
                          : l.level === "warn"
                            ? "text-muted-foreground"
                            : "text-muted-foreground"
                      }
                    >
                      {l.level === "ok" ? "✓ " : "› "}
                      {l.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
