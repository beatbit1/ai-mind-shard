import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount, useWriteContract, useChainId, useSwitchChain } from "wagmi";
import { WalletProviders } from "@/components/WalletProviders";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACTS, mainnetTxUrl, ZG_MAINNET_CHAIN_ID } from "@/contracts/addresses";
import InferenceLedgerAbi from "@/contracts/InferenceLedger.abi.json";
import AgentRegistryAbi from "@/contracts/AgentRegistry.abi.json";
import MemoryRegistryAbi from "@/contracts/MemoryRegistry.abi.json";
import { keccak256, toBytes } from "viem";

const AGENT_WALLET = "0x3BAd8c56E84a9b3B4B3f25Eb9013ca84b94f7ec5";
const ROUTER_ROLE = keccak256(toBytes("ROUTER_ROLE"));

export const Route = createFileRoute("/admin")({
  component: () => (
    <WalletProviders>
      <AdminPage />
    </WalletProviders>
  ),
});

function AdminPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [log, setLog] = useState<Array<{ label: string; tx?: string; error?: string }>>([]);
  const onMainnet = chainId === ZG_MAINNET_CHAIN_ID;

  async function run(label: string, fn: () => Promise<`0x${string}`>) {
    try {
      const tx = await fn();
      setLog((l) => [{ label, tx }, ...l]);
    } catch (e) {
      setLog((l) => [{ label, error: e instanceof Error ? e.message : String(e) }, ...l]);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-6 bg-background p-8 text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Tonara · 0G Aristotle Mainnet · chain {ZG_MAINNET_CHAIN_ID}
          </div>
          <h1 className="font-display text-2xl font-semibold">Admin · one-time setup</h1>
        </div>
        <ConnectButton showBalance={false} accountStatus="address" />
      </div>

      {isConnected && !onMainnet && (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm">
          You're on chain {chainId}. Switch to 0G Mainnet ({ZG_MAINNET_CHAIN_ID}).
          <button
            onClick={() => switchChain({ chainId: ZG_MAINNET_CHAIN_ID })}
            className="ml-3 rounded-full bg-foreground px-3 py-1 text-xs text-background"
          >
            Switch
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="text-sm font-medium">Agent wallet (server)</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground break-all">{AGENT_WALLET}</div>
      </div>

      <Section
        title="1. Grant ROUTER_ROLE on InferenceLedger"
        desc="Lets the off-chain agent call charge() on behalf of users."
        button="Grant ROUTER_ROLE"
        disabled={!isConnected || !onMainnet || isPending}
        onClick={() =>
          run("grantRole(ROUTER_ROLE, agent)", () =>
            writeContractAsync({
              address: CONTRACTS.INFERENCE_LEDGER as `0x${string}`,
              abi: InferenceLedgerAbi as any,
              functionName: "grantRole",
              args: [ROUTER_ROLE, AGENT_WALLET as `0x${string}`],
              chainId: ZG_MAINNET_CHAIN_ID,
            }),
          )
        }
      />

      <Section
        title="2. Register Mnemos on AgentRegistry"
        desc='register("Mnemos", "0g://mnemos-manifest")'
        button="Register Mnemos"
        disabled={!isConnected || !onMainnet || isPending}
        onClick={() =>
          run("AgentRegistry.register(Mnemos)", () =>
            writeContractAsync({
              address: CONTRACTS.AGENT_REGISTRY as `0x${string}`,
              abi: AgentRegistryAbi as any,
              functionName: "register",
              args: ["Mnemos", "0g://mnemos-manifest"],
              chainId: ZG_MAINNET_CHAIN_ID,
            }),
          )
        }
      />

      <Section
        title="3. Register Atlas on AgentRegistry"
        desc='register("Atlas", "0g://atlas-manifest")'
        button="Register Atlas"
        disabled={!isConnected || !onMainnet || isPending}
        onClick={() =>
          run("AgentRegistry.register(Atlas)", () =>
            writeContractAsync({
              address: CONTRACTS.AGENT_REGISTRY as `0x${string}`,
              abi: AgentRegistryAbi as any,
              functionName: "register",
              args: ["Atlas", "0g://atlas-manifest"],
              chainId: ZG_MAINNET_CHAIN_ID,
            }),
          )
        }
      />

      <Section
        title="4. (Per user) Delegate agent on MemoryRegistry"
        desc="One-time tx for YOUR connected wallet so the agent can anchor your memories on-chain."
        button="setDelegate(agent, true)"
        disabled={!isConnected || !onMainnet || isPending || !address}
        onClick={() =>
          run("MemoryRegistry.setDelegate(agent, true)", () =>
            writeContractAsync({
              address: CONTRACTS.MEMORY_REGISTRY as `0x${string}`,
              abi: MemoryRegistryAbi as any,
              functionName: "setDelegate",
              args: [AGENT_WALLET as `0x${string}`, true],
              chainId: ZG_MAINNET_CHAIN_ID,
            }),
          )
        }
      />

      {log.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Activity
          </div>
          <ul className="space-y-2">
            {log.map((l, i) => (
              <li key={i} className="rounded-md border border-border bg-background p-2 text-xs">
                <div className="font-medium">{l.label}</div>
                {l.tx && (
                  <a
                    href={mainnetTxUrl(l.tx)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10.5px] text-primary underline break-all"
                  >
                    {l.tx} ↗
                  </a>
                )}
                {l.error && <div className="font-mono text-[10.5px] text-destructive">{l.error}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  desc,
  button,
  disabled,
  onClick,
}: {
  title: string;
  desc: string;
  button: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{desc}</div>
      <button
        onClick={onClick}
        disabled={disabled}
        className="mt-3 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-40"
      >
        {button}
      </button>
    </div>
  );
}
