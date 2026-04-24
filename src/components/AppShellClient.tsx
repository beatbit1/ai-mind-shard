import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "@tanstack/react-router";
import { WalletProviders } from "@/components/WalletProviders";
import { Mnemos } from "@/components/workspaces/Mnemos";
import { Atlas } from "@/components/workspaces/Atlas";

type Workspace = "mnemos" | "atlas";

export default function AppShellClient() {
  const [active, setActive] = useState<Workspace>("mnemos");

  return (
    <WalletProviders>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-foreground">
                <div className="h-3 w-3 rounded-[2px] bg-background" />
              </div>
              <span className="font-display text-lg font-semibold tracking-tight">Tonara</span>
            </Link>
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </div>
        </header>
        <div className="mx-auto flex max-w-[1400px] gap-6 px-6 py-6">
          <aside className="w-56 shrink-0">
            <div className="rounded-2xl border border-border bg-surface p-2">
              <button
                onClick={() => setActive("mnemos")}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  active === "mnemos"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mnemos
                <div className="mt-0.5 text-[10px] uppercase tracking-widest opacity-60">
                  coding · research
                </div>
              </button>
              <button
                onClick={() => setActive("atlas")}
                className={`mt-1 w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  active === "atlas"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Atlas
                <div className="mt-0.5 text-[10px] uppercase tracking-widest opacity-60">
                  on-chain intel
                </div>
              </button>
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            {active === "mnemos" ? <Mnemos /> : <Atlas />}
          </main>
        </div>
      </div>
    </WalletProviders>
  );
}
