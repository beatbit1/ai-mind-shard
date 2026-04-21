import { useEffect, useRef } from "react";

export type TraceLine = {
  t: string;
  level: "info" | "ok" | "warn" | "err";
  msg: string;
};

export type TraceStats = {
  latency?: string;
  shards?: string;
  cost?: string;
  memoryId?: string;
};

export function RecallTrace({
  lines,
  stats,
  title = "Runtime trace",
  subtitle = "0G Storage · ShardEscrow",
}: {
  lines: TraceLine[];
  stats?: TraceStats;
  title?: string;
  subtitle?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-1">
      <div className="flex h-full flex-col rounded-xl bg-background p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {subtitle}
            </div>
            <h3 className="mt-1 font-display text-base font-semibold">{title}</h3>
          </div>
          <span
            className={`h-2 w-2 rounded-full ${lines.length > 0 ? "bg-foreground animate-pulse" : "bg-muted-foreground/40"}`}
          />
        </div>

        <div
          ref={ref}
          className="mt-4 flex-1 overflow-y-auto rounded-xl border border-border bg-background p-3 font-mono text-[11.5px] leading-relaxed"
        >
          {lines.length === 0 ? (
            <div className="text-muted-foreground">› idle · awaiting agent action…</div>
          ) : (
            lines.map((l, i) => (
              <div key={i} className="flex gap-3">
                <span className="select-none text-border">{l.t}</span>
                <span
                  className={
                    l.level === "ok"
                      ? "text-foreground"
                      : l.level === "err"
                        ? "text-foreground/80"
                        : "text-muted-foreground"
                  }
                >
                  {l.level === "ok" ? "✓ " : l.level === "warn" ? "! " : l.level === "err" ? "✗ " : "› "}
                  {l.msg}
                </span>
              </div>
            ))
          )}
        </div>

        {stats && (
          <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl border border-border p-3 font-mono text-[10.5px]">
            <Stat label="latency" value={stats.latency ?? "—"} />
            <Stat label="shards" value={stats.shards ?? "—"} />
            <Stat label="cost" value={stats.cost ?? "—"} />
            <Stat label="memory" value={stats.memoryId ?? "—"} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-foreground">{value}</div>
    </div>
  );
}

export function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
