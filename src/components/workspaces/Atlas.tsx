import { useState } from "react";
import { useAccount } from "wagmi";
import { ChainMap, type ChainEdge } from "./ChainMap";
import { RecallTrace, type TraceLine, sha256Hex, ts, wait } from "./RecallTrace";

const SEED_QUERIES = [
  "What did I learn about $JITO?",
  "Summarize my notes on Uniswap v4 hooks",
  "Top 3 risk flags for token 0x4f9b…",
];

const RESEARCH: Record<string, string[]> = {
  jito: [
    "Jito ($JITO) is a Solana liquid-staking + MEV-capture protocol.",
    "• TVL trend: steadily expanding through restaking integrations.",
    "• Yield source: validator MEV tips redistributed to JitoSOL holders.",
    "• Risk flags: validator concentration, MEV regulation, smart-contract dependency on stake-pool program.",
    "Personal notes: you flagged this as a long-term hold last week.",
  ],
  uniswap: [
    "Uniswap v4 introduces hooks: contracts attached to a pool's lifecycle (beforeSwap, afterSwap, etc.).",
    "• Singleton architecture reduces gas vs v3's factory model.",
    "• Hooks unlock dynamic fees, on-chain limit orders, and custom oracles.",
    "• Risk: hook misconfiguration can brick a pool — always audit hook code paths.",
    "Personal notes: you bookmarked the dynamic-fee whitepaper.",
  ],
  default: [
    "Synthesizing your prior research across 3 chains…",
    "• Sentiment: cautiously bullish based on your notes from the last 30 days.",
    "• Liquidity: distributed across 2 DEX venues; thin depth below mid-cap range.",
    "• Risk flags: low audit coverage, single-team dependency, governance centralization.",
    "Personal notes: tagged as 'watch' — not in your active portfolio.",
  ],
};

export function Atlas() {
  const { isConnected } = useAccount();
  const [query, setQuery] = useState("");
  const [working, setWorking] = useState(false);
  const [outage, setOutage] = useState(false);
  const [edges, setEdges] = useState<ChainEdge[]>([
    { chain: "0G", total: 4, fetched: 0, status: "idle" },
    { chain: "ETH", total: 2, fetched: 0, status: "idle" },
    { chain: "SOL", total: 2, fetched: 0, status: "idle" },
  ]);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [manifest, setManifest] = useState<string | null>(null);
  const [latency, setLatency] = useState<string | null>(null);

  function pushTrace(level: TraceLine["level"], msg: string) {
    setTrace((t) => [...t, { t: ts(), level, msg }]);
  }

  function setEdge(chain: ChainEdge["chain"], patch: Partial<ChainEdge>) {
    setEdges((es) => es.map((e) => (e.chain === chain ? { ...e, ...patch } : e)));
  }

  async function runQuery(q: string) {
    if (!isConnected || working || !q.trim()) return;
    setWorking(true);
    setOutput([]);
    setManifest(null);
    setLatency(null);
    setTrace([]);
    setEdges([
      { chain: "0G", total: 4, fetched: 0, status: "idle" },
      { chain: "ETH", total: 2, fetched: 0, status: "idle" },
      { chain: "SOL", total: 2, fetched: 0, status: "idle" },
    ]);

    const start = performance.now();
    pushTrace("info", `query received · "${q.slice(0, 48)}${q.length > 48 ? "…" : ""}"`);
    await wait(200);
    pushTrace("info", `resolving master index on 0G · 8 shards across 3 chains`);
    await wait(260);

    // Start fetching from each chain in parallel
    const targets: ChainEdge["chain"][] = ["0G", "ETH", "SOL"];
    targets.forEach((c) => setEdge(c, { status: "fetching" }));
    pushTrace("info", `parallel fetch initiated`);

    const tasks = targets.map(async (chain) => {
      const totals: Record<string, number> = { "0G": 4, ETH: 2, SOL: 2 };
      const total = totals[chain];
      for (let i = 1; i <= total; i++) {
        await wait(140 + Math.random() * 120);
        if (chain === "0G" && outage && i === 2) {
          setEdge("0G", { status: "failed" });
          pushTrace("err", `0G · node unreachable mid-stream · failing over`);
          return;
        }
        setEdge(chain, { fetched: i });
        pushTrace("info", `${chain} · shard ${i}/${total} received`);
      }
      setEdge(chain, { status: "done" });
    });

    await Promise.all(tasks);

    if (outage) {
      pushTrace("info", `reconstructing from ETH + SOL via Reed–Solomon redundancy`);
      await wait(320);
      pushTrace("ok", `reassembled despite 0G outage · integrity verified`);
    } else {
      pushTrace("ok", `all 8 shards received · reassembling`);
      await wait(220);
    }

    const id = (await sha256Hex(q + Date.now())).slice(0, 12);
    setManifest(`0x${id}`);
    const elapsed = Math.round(performance.now() - start);
    setLatency(`${elapsed} ms`);

    // Stream research output
    const key = /jito/i.test(q) ? "jito" : /uniswap|hook/i.test(q) ? "uniswap" : "default";
    const lines = RESEARCH[key];
    for (const line of lines) {
      setOutput((o) => [...o, ""]);
      for (let i = 0; i <= line.length; i += 3) {
        await wait(12);
        setOutput((o) => {
          const next = [...o];
          next[next.length - 1] = line.slice(0, i);
          return next;
        });
      }
    }

    setWorking(false);
  }

  return (
    <div className="space-y-4">
      {/* Query bar */}
      <div className="rounded-2xl border border-border bg-surface p-1">
        <div className="rounded-xl bg-background p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Cross-chain research agent
              </div>
              <h2 className="mt-0.5 font-display text-lg font-semibold">Atlas</h2>
            </div>
            <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={outage}
                onChange={(e) => setOutage(e.target.checked)}
                className="accent-foreground"
              />
              simulate 0G outage
            </label>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runQuery(query);
            }}
            className="mt-4 flex gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Atlas about any token, protocol, or wallet…"
              className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
            />
            <button
              type="submit"
              disabled={!isConnected || working || !query.trim()}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {working ? "Running…" : "Run query"}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {SEED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuery(q);
                  runQuery(q);
                }}
                disabled={!isConnected || working}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>

          {!isConnected && (
            <div className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
              connect wallet to dispatch queries
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <ChainMap edges={edges} />
        <RecallTrace
          lines={trace}
          title="Retrieval trace"
          subtitle="Manifest · 0G index"
        />
      </div>

      {/* Output */}
      <div className="rounded-2xl border border-border bg-surface p-1">
        <div className="rounded-xl bg-background p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Reassembled research
              </div>
              <h3 className="mt-0.5 font-display text-base font-semibold">Output</h3>
            </div>
            {manifest && (
              <div className="font-mono text-[10.5px] text-muted-foreground">
                {edges.reduce((s, e) => s + e.fetched, 0)} shards · 3 chains · {latency} · manifest{" "}
                <span className="text-foreground">{manifest}</span> anchored on 0G
              </div>
            )}
          </div>

          <div className="mt-4 min-h-[140px] rounded-xl border border-border bg-background p-4 text-sm leading-relaxed">
            {output.length === 0 ? (
              <div className="text-muted-foreground">
                › research output will stream here after reassembly.
              </div>
            ) : (
              output.map((line, i) => (
                <div key={i} className={i === 0 ? "" : "mt-1.5"}>
                  {line}
                  {working && i === output.length - 1 && (
                    <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-foreground" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
