import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "@tanstack/react-router";
import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { WalletProviders } from "@/components/WalletProviders";
import { Mnemos } from "@/components/workspaces/Mnemos";
import { Atlas } from "@/components/workspaces/Atlas";
import { Dashboard } from "@/components/workspaces/Dashboard";
import { ZG_MAINNET_CHAIN_ID } from "@/contracts/addresses";

type Workspace = "dashboard" | "mnemos" | "atlas";

const TABS: Array<{ id: Workspace; label: string; sub: string }> = [
  { id: "dashboard", label: "Dashboard", sub: "live · 0G state" },
  { id: "mnemos", label: "Mnemos", sub: "coding · research" },
  { id: "atlas", label: "Atlas", sub: "on-chain intel" },
];

export default function AppShellClient() {
  const [active, setActive] = useState<Workspace>("dashboard");

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
            <WalletStatus />
          </div>
        </header>
        <div className="mx-auto flex max-w-[1400px] gap-6 px-6 py-6">
          <aside className="w-56 shrink-0">
            <div className="rounded-2xl border border-border bg-surface p-2">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    i > 0 ? "mt-1" : ""
                  } ${
                    active === t.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest opacity-60">
                    {t.sub}
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            {active === "dashboard" && <Dashboard />}
            {active === "mnemos" && <Mnemos />}
            {active === "atlas" && <Atlas />}
          </main>
        </div>
      </div>
    </WalletProviders>
  );
}

function WalletStatus() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const onMainnet = chainId === ZG_MAINNET_CHAIN_ID;

  return (
    <div className="flex items-center gap-2">
      {isConnected && address && (
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[11px] md:flex">
          <span className={onMainnet ? "text-foreground" : "text-destructive"}>
            {onMainnet ? "0G Mainnet" : `chain ${chainId}`}
          </span>
          <span className="text-muted-foreground">{short(address)}</span>
        </div>
      )}
      {isConnected && !onMainnet && (
        <button
          onClick={() => switchChain({ chainId: ZG_MAINNET_CHAIN_ID })}
          disabled={isPending}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {isPending ? "Switching…" : "Use 0G Mainnet"}
        </button>
      )}
      {isConnected ? (
        <button
          onClick={() => disconnect()}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground transition-colors hover:bg-destructive hover:text-background"
        >
          Disconnect
        </button>
      ) : (
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
      )}
    </div>
  );
}

function short(s: string) {
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
