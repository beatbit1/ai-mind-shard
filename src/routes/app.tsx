import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletProviders } from "@/components/WalletProviders";
import { Mnemos } from "@/components/workspaces/Mnemos";
import { Atlas } from "@/components/workspaces/Atlas";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Tonara Console — Agent Workspaces" },
      {
        name: "description",
        content:
          "Operate Mnemos and Atlas — agent workspaces powered by encrypted long-term memory on 0G.",
      },
    ],
  }),
  component: () => (
    <WalletProviders>
      <AppShell />
    </WalletProviders>
  ),
});

type Workspace = "mnemos" | "atlas";

function AppShell() {
  const [active, setActive] = useState<Workspace>("mnemos");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="flex w-56 flex-col border-r border-border bg-surface">
          <Link to="/" className="flex items-center gap-2 border-b border-border px-5 py-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-foreground">
              <div className="h-2.5 w-2.5 rounded-[2px] bg-background" />
            </div>
            <span className="font-display text-base font-semibold">Tonara</span>
            <span className="ml-1 rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              console
            </span>
          </Link>

          <nav className="flex-1 p-3">
            <div className="px-2 pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Workspaces
            </div>
            <NavItem
              label="Mnemos"
              hint="Companion agent"
              active={active === "mnemos"}
              onClick={() => setActive("mnemos")}
            />
            <NavItem
              label="Atlas"
              hint="Cross-chain research"
              active={active === "atlas"}
              onClick={() => setActive("atlas")}
            />
          </nav>

          <div className="border-t border-border p-4 font-mono text-[10px] leading-relaxed text-muted-foreground">
            Powered by 0G Storage,
            <br />
            ShardEscrow & OpenClaw.
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {active === "mnemos" ? "Companion agent" : "Research agent"}
              </div>
              <div className="font-display text-sm font-semibold">
                {active === "mnemos" ? "Mnemos workspace" : "Atlas workspace"}
              </div>
            </div>
            <ConnectButton
              accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
              chainStatus="icon"
              showBalance={false}
            />
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            {active === "mnemos" ? <Mnemos /> : <Atlas />}
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-1 flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-foreground hover:bg-secondary"
      }`}
    >
      <span className="font-display text-sm font-semibold">{label}</span>
      <span
        className={`font-mono text-[10px] uppercase tracking-widest ${
          active ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {hint}
      </span>
    </button>
  );
}
