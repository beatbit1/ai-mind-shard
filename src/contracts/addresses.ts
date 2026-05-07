// 0G Aristotle Mainnet contract addresses (chain id 16661).
// Deployed via Remix IDE — see /contracts/README.md for details.

export const ZG_MAINNET_CHAIN_ID = 16661;
export const ZG_MAINNET_RPC = "https://evmrpc.0g.ai";
export const ZG_MAINNET_EXPLORER = "https://chainscan.0g.ai";

export const CONTRACTS = {
  TONARA:           "0x9fBe747Acd390198295c848ed7EdF38942237935",
  MEMORY_REGISTRY:  "0x3E045a00179510c8fe6358CD93fA8F1BEE7e293e",
  INFERENCE_LEDGER: "0x739280dD1Cf1B8e9d648C7f315736085a4191A2A",
  AGENT_REGISTRY:   "0xc6DA0F91b357308097760464bcD86A119950B896",
} as const;

export const DEPLOY_TXS = {
  TONARA:           "0x0d625c650b87164726f4bb7001ed4555f23f5c31ded76847e3482fd4a3133a08",
  MEMORY_REGISTRY:  "0x4a3814691bbbd717d174c0da1af784849082cd9cb408be7b76cfe4bfd36ece59",
  INFERENCE_LEDGER: "0x64b3c1cdd28ad6797f1e0c6f713722e3eb12cad9c47dba750e5c94b30b6030ef",
  AGENT_REGISTRY:   "0xf26d0432fa740c19809003122bbec6c418023a05e86ca5fe1232c827184b60cc",
} as const;

export const DEPLOY_BLOCKS = {
  TONARA: 32363942,
  MEMORY_REGISTRY: 32366729,
  INFERENCE_LEDGER: 32367628,
  AGENT_REGISTRY: 32368263,
} as const;

export function mainnetTxUrl(hash: string): string {
  return `${ZG_MAINNET_EXPLORER}/tx/${hash}`;
}

export function mainnetAddrUrl(addr: string): string {
  return `${ZG_MAINNET_EXPLORER}/address/${addr}`;
}
