// Server-only 0G client singletons. NEVER import from client code.
import { ethers } from "ethers";

export const ZG_RPC = "https://evmrpc-testnet.0g.ai";
export const ZG_INDEXER_RPC = "https://indexer-storage-testnet-turbo.0g.ai";
export const ZG_CHAIN_ID = 16601;

export class ZGNotConfiguredError extends Error {
  constructor(public missing: string[]) {
    super(`0G integration not configured. Missing: ${missing.join(", ")}`);
    this.name = "ZGNotConfiguredError";
  }
}

export class ZGUnfundedError extends Error {
  constructor(public address: string) {
    super(`Wallet ${address} has no OG balance on Galileo testnet. Fund it at https://faucet.0g.ai`);
    this.name = "ZGUnfundedError";
  }
}

function requireSecrets() {
  const missing: string[] = [];
  if (!process.env.ZG_PRIVATE_KEY) missing.push("ZG_PRIVATE_KEY");
  if (!process.env.ZG_MEMORY_ENC_KEY) missing.push("ZG_MEMORY_ENC_KEY");
  if (missing.length > 0) throw new ZGNotConfiguredError(missing);
}

let _provider: ethers.JsonRpcProvider | null = null;
let _wallet: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  requireSecrets();
  if (!_provider) _provider = new ethers.JsonRpcProvider(ZG_RPC);
  return _provider;
}

export function getWallet(): ethers.Wallet {
  requireSecrets();
  if (!_wallet) {
    const pk = process.env.ZG_PRIVATE_KEY!;
    const normalized = pk.startsWith("0x") ? pk : `0x${pk}`;
    _wallet = new ethers.Wallet(normalized, getProvider());
  }
  return _wallet;
}

let _indexer: unknown = null;
export async function getIndexer() {
  requireSecrets();
  if (!_indexer) {
    const { Indexer } = await import("@0glabs/0g-ts-sdk");
    _indexer = new Indexer(ZG_INDEXER_RPC);
  }
  return _indexer as InstanceType<typeof import("@0glabs/0g-ts-sdk").Indexer>;
}

let _broker: unknown = null;
export async function getBroker() {
  requireSecrets();
  if (!_broker) {
    const mod = await import("@0glabs/0g-serving-broker");
    // SDK exports createZGComputeNetworkBroker
    const create = (mod as any).createZGComputeNetworkBroker;
    if (typeof create !== "function") {
      throw new Error("0G compute broker SDK missing createZGComputeNetworkBroker export");
    }
    _broker = await create(getWallet());
  }
  return _broker as any;
}

export async function assertFunded() {
  const w = getWallet();
  const bal = await getProvider().getBalance(w.address);
  if (bal === 0n) throw new ZGUnfundedError(w.address);
  return { address: w.address, balanceWei: bal.toString() };
}
