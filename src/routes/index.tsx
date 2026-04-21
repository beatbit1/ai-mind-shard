import { createFileRoute } from "@tanstack/react-router";
import { HeroMesh } from "@/components/HeroMesh";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tonara — A permanent brain for autonomous AI agents" },
      {
        name: "description",
        content:
          "Tonara gives AI agents permanent, private, sharded long-term memory. Encrypted on 0G, indexed on-chain, retrievable across ecosystems.",
      },
      { property: "og:title", content: "Tonara — A permanent brain for autonomous AI agents" },
      {
        property: "og:description",
        content: "Encrypted memory shards on 0G. Cross-chain reassembly. Autonomous recall.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate min-h-screen overflow-hidden pt-16">
      <div className="absolute inset-0 grid-bg radial-fade" aria-hidden="true" />
      <div className="absolute inset-0">
        <HeroMesh />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-center px-6 text-center">
        <h1 className="mt-8 max-w-5xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-7xl lg:text-8xl">
          A permanent brain
          <br />
          <span className="text-muted-foreground">for autonomous agents.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg text-muted-foreground text-balance md:text-xl">
          Tonara stores AI memory as encrypted shards on 0G — indexed on-chain,
          reassembled across ecosystems, recalled in milliseconds.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/app"
            className="group inline-flex h-12 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Launch App
            <span className="ml-2 transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>

        <div className="mt-20 grid w-full max-w-3xl grid-cols-3 divide-x divide-border border-y border-border py-6 text-center">
          {[
            ["< 300ms", "recall latency"],
            ["AES-256", "shard encryption"],
            ["3 chains", "redundant storage"],
          ].map(([v, l]) => (
            <div key={l} className="px-4">
              <div className="font-display text-2xl font-semibold">{v}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = [
    "0G STORAGE", "OPENCLAW", "0G CHAIN", "0G COMPUTE",
    "ETHEREUM", "SOLANA", "ERASURE CODING", "ZK PROOFS",
    "AGENT SDK", "MICROPAYMENTS",
  ];
  const doubled = [...items, ...items];

  return (
    <section className="border-y border-border bg-background py-6">
      <div className="overflow-hidden">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
          {doubled.map((t, i) => (
            <span
              key={i}
              className="font-mono text-sm uppercase tracking-widest text-muted-foreground"
            >
              {t} <span className="ml-12 text-border">●</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
