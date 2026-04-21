import { createFileRoute } from "@tanstack/react-router";
import { HeroMesh } from "@/components/HeroMesh";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AgentDemo } from "@/components/AgentDemo";

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
        content:
          "Encrypted memory shards on 0G. Cross-chain reassembly. Autonomous recall.",
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
        <Platform />
        <AgentSection />
        <DemoSection />
        <Ecosystem />
        <CTA />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ───────────────────────── HERO ───────────────────────── */

function Hero() {
  return (
    <section className="relative isolate min-h-screen overflow-hidden pt-16">
      {/* grid background */}
      <div className="absolute inset-0 grid-bg radial-fade" aria-hidden="true" />
      {/* 3D mesh */}
      <div className="absolute inset-0">
        <HeroMesh />
      </div>
      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col items-center justify-center px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-4 py-1.5 backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Now live on 0G testnet
          </span>
        </div>

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
          <a
            href="#demo"
            className="inline-flex h-12 items-center rounded-full border border-border bg-background/50 px-6 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
          >
            See it think
          </a>
        </div>

        {/* spec strip */}
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

/* ───────────────────────── MARQUEE ───────────────────────── */

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

/* ───────────────────────── PLATFORM ───────────────────────── */

function Platform() {
  const cards = [
    {
      tag: "01",
      title: "Sharded encrypted memory",
      copy: "Every memory is encrypted, split into erasure-coded shards, and distributed across 0G Storage. Lose any chain, recover anyway.",
    },
    {
      tag: "02",
      title: "On-chain master index",
      copy: "A canonical index lives on 0G Chain — fast, cheap, verifiable. Agents prove ownership before a single byte moves.",
    },
    {
      tag: "03",
      title: "Cross-chain reassembly",
      copy: "Fragments scatter across 0G, Ethereum, and Solana. Tonara pulls them back automatically — your agent never sees the seams.",
    },
    {
      tag: "04",
      title: "Autonomous micropayments",
      copy: "Agents pay for their own recall via OpenClaw identities. No keys to manage. No human in the loop.",
    },
  ];

  return (
    <section id="platform" className="relative border-b border-border py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            The platform
          </div>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Infrastructure for agents that <em className="not-italic text-muted-foreground">never forget.</em>
          </h2>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
          {cards.map((c) => (
            <div
              key={c.tag}
              className="group relative bg-background p-8 transition-colors hover:bg-surface md:p-10"
            >
              <div className="flex items-start justify-between">
                <div className="font-mono text-xs text-muted-foreground">{c.tag}</div>
                <div className="h-8 w-8 rounded-full border border-border transition-colors group-hover:border-foreground" />
              </div>
              <h3 className="mt-12 font-display text-2xl font-semibold tracking-tight md:text-3xl">
                {c.title}
              </h3>
              <p className="mt-4 max-w-md text-muted-foreground">{c.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── AGENTS ───────────────────────── */

function AgentSection() {
  return (
    <section id="agents" className="border-b border-border py-32">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 md:grid-cols-2 md:items-center">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Built for agents
          </div>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            From single agents to autonomous swarms.
          </h2>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Tonara plugs into any agent runtime — LangChain, CrewAI, custom rollouts.
            Your agents inherit a verifiable identity, a private long-term memory, and
            the ability to trade knowledge with other agents on-chain.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              "Persistent context across sessions, devices, and ecosystems.",
              "End-to-end encryption — nobody, including Tonara, sees raw memory.",
              "Agent-to-agent memory marketplaces with on-chain settlement.",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-foreground/90">
                <span className="mt-2 h-px w-6 shrink-0 bg-foreground" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Code-style preview */}
        <div className="relative">
          <div className="rounded-2xl border border-border bg-surface p-1">
            <div className="rounded-xl bg-background p-6 font-mono text-[13px] leading-relaxed">
              <div className="flex gap-4 text-muted-foreground">
                <span className="select-none text-border">01</span>
                <span>
                  <span className="text-muted-foreground">import</span>{" "}
                  <span className="text-foreground">{"{ Tonara }"}</span>{" "}
                  <span className="text-muted-foreground">from</span>{" "}
                  <span className="text-foreground">"tonara"</span>
                </span>
              </div>
              <div className="mt-4 flex gap-4">
                <span className="select-none text-border">02</span>
                <span className="text-muted-foreground">
                  <span className="text-foreground">const</span> agent ={" "}
                  <span className="text-foreground">await</span> Tonara.connect({"{"}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="select-none text-border">03</span>
                <span className="text-muted-foreground">  identity: <span className="text-foreground">"openclaw://0x4af…"</span>,</span>
              </div>
              <div className="flex gap-4">
                <span className="select-none text-border">04</span>
                <span className="text-muted-foreground">  chains: [<span className="text-foreground">"0g", "eth", "sol"</span>],</span>
              </div>
              <div className="flex gap-4">
                <span className="select-none text-border">05</span>
                <span className="text-muted-foreground">{"})"}</span>
              </div>
              <div className="mt-4 flex gap-4">
                <span className="select-none text-border">06</span>
                <span className="text-foreground">await agent.remember(thought)</span>
              </div>
              <div className="flex gap-4">
                <span className="select-none text-border">07</span>
                <span className="text-foreground">
                  await agent.recall(<span className="text-muted-foreground">"q3 vesting"</span>)
                </span>
              </div>
              <div className="mt-4 flex gap-4 text-muted-foreground">
                <span className="select-none text-border">08</span>
                <span>{"// → 3 shards · 287ms · 0.0021 OG"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── DEMO ───────────────────────── */

function DemoSection() {
  return (
    <section id="demo" className="border-b border-border py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Live runtime
          </div>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Watch an agent recall itself.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Every query reassembles encrypted shards from across the network.
            No state on the client. No trust required.
          </p>
        </div>

        <div className="mt-14">
          <AgentDemo />
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          {[
            ["1.2M", "shards stored"],
            ["840K", "agent recalls"],
            ["99.98%", "reassembly success"],
            ["3", "chains supported"],
          ].map(([v, l]) => (
            <div key={l} className="bg-background p-6">
              <div className="font-display text-3xl font-semibold">{v}</div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── ECOSYSTEM ───────────────────────── */

function Ecosystem() {
  return (
    <section id="ecosystem" className="border-b border-border py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              The ecosystem
            </div>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Powered by 0G. Open to every chain.
            </h2>
          </div>
          <a
            href="#"
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm transition-colors hover:bg-secondary"
          >
            View partners →
          </a>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-6">
          {[
            "0G", "OPENCLAW", "ETH", "SOL", "BASE", "ARB",
            "LANGCHAIN", "CREWAI", "EIGEN", "CELESTIA", "FILECOIN", "AKASH",
          ].map((p) => (
            <div
              key={p}
              className="flex aspect-[3/2] items-center justify-center bg-background p-6 transition-colors hover:bg-surface"
            >
              <span className="font-mono text-sm font-semibold tracking-widest text-muted-foreground">
                {p}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── CTA ───────────────────────── */

function CTA() {
  return (
    <section className="relative overflow-hidden border-b border-border py-32">
      <div className="absolute inset-0 grid-bg radial-fade opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <h2 className="font-display text-5xl font-semibold leading-tight tracking-tight text-balance md:text-7xl">
          Give your agent a brain that lasts forever.
        </h2>
        <p className="mt-6 text-lg text-muted-foreground">
          Spin up an OpenClaw identity, write your first encrypted memory, and watch it
          reassemble across chains in under a minute.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/app"
            className="inline-flex h-12 items-center rounded-full bg-foreground px-7 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Launch App →
          </a>
          <a
            href="#docs"
            className="inline-flex h-12 items-center rounded-full border border-border px-7 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Read the docs
          </a>
        </div>
      </div>
    </section>
  );
}
