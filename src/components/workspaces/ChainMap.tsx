type ChainKey = "0G" | "ETH" | "SOL";

export type ChainEdge = {
  chain: ChainKey;
  total: number;
  fetched: number;
  status: "idle" | "fetching" | "done" | "failed";
};

export function ChainMap({ edges }: { edges: ChainEdge[] }) {
  const positions: Record<ChainKey, { x: number; y: number }> = {
    "0G": { x: 80, y: 60 },
    ETH: { x: 80, y: 180 },
    SOL: { x: 80, y: 300 },
  };
  const center = { x: 520, y: 180 };

  return (
    <div className="rounded-2xl border border-border bg-surface p-1">
      <div className="rounded-xl bg-background p-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Cross-chain shard map
        </div>
        <h3 className="mt-1 font-display text-base font-semibold">Live retrieval graph</h3>

        <svg viewBox="0 0 600 360" className="mt-4 w-full">
          <defs>
            <linearGradient id="line-active" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(1 0 0 / 0.1)" />
              <stop offset="100%" stopColor="oklch(1 0 0 / 0.9)" />
            </linearGradient>
          </defs>

          {edges.map((e) => {
            const p = positions[e.chain];
            const active = e.status === "fetching";
            const done = e.status === "done";
            const failed = e.status === "failed";
            const stroke = failed
              ? "oklch(1 0 0 / 0.15)"
              : done
                ? "oklch(1 0 0 / 0.7)"
                : active
                  ? "url(#line-active)"
                  : "oklch(1 0 0 / 0.1)";
            return (
              <g key={e.chain}>
                <line
                  x1={p.x + 60}
                  y1={p.y}
                  x2={center.x - 60}
                  y2={center.y}
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray={active ? "4 4" : failed ? "2 6" : "0"}
                >
                  {active && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-16"
                      dur="0.6s"
                      repeatCount="indefinite"
                    />
                  )}
                </line>
                {/* progress dot */}
                {active && (
                  <circle r="3" fill="white">
                    <animateMotion
                      dur="1.1s"
                      repeatCount="indefinite"
                      path={`M${p.x + 60},${p.y} L${center.x - 60},${center.y}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* chain nodes */}
          {edges.map((e) => {
            const p = positions[e.chain];
            const failed = e.status === "failed";
            return (
              <g key={`n-${e.chain}`}>
                <rect
                  x={p.x - 60}
                  y={p.y - 26}
                  width={120}
                  height={52}
                  rx={10}
                  fill="oklch(0 0 0)"
                  stroke={failed ? "oklch(1 0 0 / 0.2)" : "oklch(1 0 0 / 0.4)"}
                />
                <text
                  x={p.x}
                  y={p.y - 6}
                  textAnchor="middle"
                  className="fill-foreground"
                  style={{ font: "600 14px var(--font-display)" }}
                >
                  {e.chain}
                </text>
                <text
                  x={p.x}
                  y={p.y + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ font: "11px var(--font-mono)" }}
                >
                  {failed ? "offline" : `${e.fetched}/${e.total} shards`}
                </text>
              </g>
            );
          })}

          {/* atlas center */}
          <g>
            <rect
              x={center.x - 70}
              y={center.y - 32}
              width={140}
              height={64}
              rx={12}
              fill="oklch(1 0 0)"
            />
            <text
              x={center.x}
              y={center.y - 6}
              textAnchor="middle"
              className="fill-background"
              style={{ font: "700 16px var(--font-display)" }}
            >
              Atlas
            </text>
            <text
              x={center.x}
              y={center.y + 14}
              textAnchor="middle"
              className="fill-background/70"
              style={{ font: "11px var(--font-mono)" }}
            >
              reassembler
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
