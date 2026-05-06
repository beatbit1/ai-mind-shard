// Server-only mainnet contract helpers.
// Anchors memory roots and inference charges on 0G Aristotle Mainnet (chain 16661).
// NEVER import from client code.
import { ethers } from "ethers";
import {
  CONTRACTS,
  ZG_MAINNET_CHAIN_ID,
  ZG_MAINNET_RPC,
} from "@/contracts/addresses";
import MemoryRegistryAbi from "@/contracts/MemoryRegistry.abi.json";
import InferenceLedgerAbi from "@/contracts/InferenceLedger.abi.json";
import TonaraAbi from "@/contracts/Tonara.abi.json";

let _provider: ethers.JsonRpcProvider | null = null;
let _wallet: ethers.Wallet | null = null;

function provider(): ethers.JsonRpcProvider {
  if (!_provider) _provider = new ethers.JsonRpcProvider(ZG_MAINNET_RPC, ZG_MAINNET_CHAIN_ID);
  return _provider;
}

function wallet(): ethers.Wallet {
  if (!_wallet) {
    const pk = process.env.ZG_PRIVATE_KEY;
    if (!pk) throw new Error("ZG_PRIVATE_KEY not configured");
    const norm = pk.startsWith("0x") ? pk : `0x${pk}`;
    _wallet = new ethers.Wallet(norm, provider());
  }
  return _wallet;
}

export function agentAddress(): string {
  return wallet().address;
}

export type MemoryKind = 0 | 1 | 2 | 3; // User | Assistant | ResearchBrief | Custom

function asBytes32(hex: string): string {
  let h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length > 64) h = h.slice(-64);
  if (h.length < 64) h = h.padStart(64, "0");
  return "0x" + h;
}

function toBytes32SessionId(sessionId: string): string {
  // hash arbitrary string into bytes32
  return ethers.keccak256(ethers.toUtf8Bytes(sessionId));
}

export type CommitOnChainResult =
  | { ok: true; txHash: string; blockNumber: number; index: string }
  | { ok: false; error: string };

export async function commitMemoryOnChain(params: {
  owner: string;
  rootHash: string;
  sizeBytes: number;
  kind: MemoryKind;
  sessionId: string;
}): Promise<CommitOnChainResult> {
  try {
    const reg = new ethers.Contract(CONTRACTS.MEMORY_REGISTRY, MemoryRegistryAbi as any, wallet());

    // Confirm delegation; if missing, surface a recoverable error.
    try {
      const allowed: boolean = await reg.delegates(params.owner, agentAddress());
      if (!allowed) {
        return { ok: false, error: "User has not delegated agent on MemoryRegistry. Call setDelegate(agent, true) once from MetaMask." };
      }
    } catch {
      /* if call fails, attempt commit anyway and let the chain decide */
    }

    const tx = await reg.commitFor(
      params.owner,
      asBytes32(params.rootHash),
      BigInt(params.sizeBytes),
      params.kind,
      toBytes32SessionId(params.sessionId),
    );
    const rcpt = await tx.wait();

    // Decode index from MemoryCommitted event if possible
    let index = "?";
    try {
      const iface = new ethers.Interface(MemoryRegistryAbi as any);
      for (const log of rcpt?.logs ?? []) {
        try {
          const parsed = iface.parseLog(log as any);
          if (parsed?.name === "MemoryCommitted") {
            index = String(parsed.args.index);
            break;
          }
        } catch { /* not our event */ }
      }
    } catch { /* ignore */ }

    return {
      ok: true,
      txHash: tx.hash,
      blockNumber: rcpt?.blockNumber ?? 0,
      index,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getOnChainRecordCount(owner: string): Promise<number> {
  try {
    const reg = new ethers.Contract(CONTRACTS.MEMORY_REGISTRY, MemoryRegistryAbi as any, provider());
    const count: bigint = await reg.recordCount(owner);
    return Number(count);
  } catch {
    return 0;
  }
}

export async function getTonaraBalance(owner: string): Promise<{ raw: string; formatted: number }> {
  try {
    const tok = new ethers.Contract(CONTRACTS.TONARA, TonaraAbi as any, provider());
    const raw: bigint = await tok.balanceOf(owner);
    return { raw: raw.toString(), formatted: Number(raw) / 1e18 };
  } catch {
    return { raw: "0", formatted: 0 };
  }
}

export async function getMainnetSnapshot(): Promise<{
  agent: string;
  agentBalanceOG: number;
  blockNumber: number;
  contracts: typeof CONTRACTS;
  chainId: number;
}> {
  const p = provider();
  const [bal, blk] = await Promise.all([
    p.getBalance(agentAddress()).catch(() => 0n),
    p.getBlockNumber().catch(() => 0),
  ]);
  return {
    agent: agentAddress(),
    agentBalanceOG: Number(bal) / 1e18,
    blockNumber: blk,
    contracts: CONTRACTS,
    chainId: ZG_MAINNET_CHAIN_ID,
  };
}

export async function getInferenceLedgerBalance(user: string): Promise<number> {
  try {
    const led = new ethers.Contract(CONTRACTS.INFERENCE_LEDGER, InferenceLedgerAbi as any, provider());
    const raw: bigint = await led.balanceOf(user);
    return Number(raw) / 1e18;
  } catch {
    return 0;
  }
}
