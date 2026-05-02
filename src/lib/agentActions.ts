// Lightweight client-side log of agent actions (inference, recall, commit,
// shard reassembly, cross-chain research) so the dashboard can surface what
// the agent has been doing — with timestamps and related tx hashes.

export const ACTIONS_PREFIX = "tonara.agent.actions.";

export type AgentActionKind =
  | "inference"
  | "commit"
  | "recall"
  | "reassembly"
  | "cross-chain"
  | "atlas";

export type AgentAction = {
  id: string;
  kind: AgentActionKind;
  source: "mnemos" | "atlas" | "dashboard";
  label: string;             // human-readable summary
  ts: number;
  latencyMs?: number;
  txHash?: string;
  rootHash?: string;
  provider?: string;
  model?: string;
  ok: boolean;
  error?: string;
};

export function getAgentActions(wallet: string): AgentAction[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIONS_PREFIX + wallet) ?? "[]");
  } catch {
    return [];
  }
}

export function appendAgentAction(wallet: string, action: Omit<AgentAction, "id" | "ts"> & { ts?: number }) {
  const list = getAgentActions(wallet);
  list.push({
    id: crypto.randomUUID(),
    ts: action.ts ?? Date.now(),
    ...action,
  });
  localStorage.setItem(ACTIONS_PREFIX + wallet, JSON.stringify(list.slice(-100)));
}
