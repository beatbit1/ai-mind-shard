import { useEffect, useState } from "react";

/**
 * Scale AI–style agent demo: a fake terminal/chat panel that
 * cycles through agent recall events showing the product in action.
 */
type Step = {
  user: string;
  agent: string;
  trace: { label: string; value: string }[];
};

const STEPS: Step[] = [
  {
    user: "What did we decide about the Q3 token vesting schedule?",
    agent:
      "Recovered from session 0x4af… — you opted for a 12-month linear unlock with a 3-month cliff. Two shards retrieved from 0G, one from Ethereum.",
    trace: [
      { label: "memory_id", value: "mem_8f21c…" },
      { label: "shards", value: "3 / 4 reassembled" },
      { label: "chains", value: "0G · ETH" },
      { label: "latency", value: "287 ms" },
      { label: "cost", value: "0.0021 OG" },
    ],
  },
  {
    user: "Recall every wallet I've flagged as high-risk this week.",
    agent:
      "11 wallets flagged. Memory reconstructed from 7 encrypted fragments distributed across 0G Storage and Solana. Index verified on 0G Chain.",
    trace: [
      { label: "memory_id", value: "mem_a13e7…" },
      { label: "shards", value: "7 / 7 reassembled" },
      { label: "chains", value: "0G · SOL" },
      { label: "latency", value: "412 ms" },
      { label: "cost", value: "0.0048 OG" },
    ],
  },
  {
    user: "Continue the research thread on autonomous market makers.",
    agent:
      "Resuming context from 14 prior sessions. Loaded long-term reasoning state — no rehydration needed. Fully end-to-end encrypted.",
    trace: [
      { label: "memory_id", value: "mem_2c904…" },
      { label: "shards", value: "12 / 16 reassembled" },
      { label: "chains", value: "0G" },
      { label: "latency", value: "198 ms" },
      { label: "cost", value: "0.0017 OG" },
    ],
  },
];

export function AgentDemo() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % STEPS.length), 5500);
    return () => clearInterval(t);
  }, []);

  const step = STEPS[idx];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          tonara · agent runtime
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
          live
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
        {/* Chat side */}
        <div className="space-y-5 p-6 md:p-8">
          <div key={`u-${idx}`} className="animate-fade-in">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              user
            </div>
            <p className="mt-2 text-base text-foreground">{step.user}</p>
          </div>

          <div className="h-px w-full bg-border" />

          <div key={`a-${idx}`} className="animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-foreground">
                <div className="h-2 w-2 rounded-[1px] bg-background" />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                agent · memory recall
              </div>
            </div>
            <p className="mt-3 text-base leading-relaxed text-foreground/90">
              {step.agent}
            </p>
          </div>
        </div>

        {/* Trace side */}
        <div className="relative border-l border-border bg-background/40 p-6 md:p-8">
          <div className="absolute inset-x-0 top-0 h-full overflow-hidden opacity-40">
            <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-foreground to-transparent animate-scan" />
          </div>

          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            retrieval trace
          </div>
          <dl key={`t-${idx}`} className="mt-4 space-y-3 animate-fade-in">
            {step.trace.map((t) => (
              <div key={t.label} className="flex items-center justify-between">
                <dt className="font-mono text-xs text-muted-foreground">{t.label}</dt>
                <dd className="font-mono text-xs text-foreground">{t.value}</dd>
              </div>
            ))}
          </dl>

          {/* Step indicator */}
          <div className="mt-8 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i === idx ? "bg-foreground" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
