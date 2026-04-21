import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "wagmi/chains";
import type { Chain } from "wagmi/chains";

// 0G Galileo testnet (chain id 16601). If a different 0G chain is needed, swap RPC + id here.
export const zeroGTestnet: Chain = {
  id: 16601,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
    public: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
};

export const wagmiConfig = getDefaultConfig({
  appName: "Tonara",
  // Public demo project id — replace with your own from https://cloud.walletconnect.com
  projectId: "3fbb6bda0fd25a8f7f7c4a6a6f6c6e9a",
  chains: [zeroGTestnet, mainnet, sepolia],
  ssr: true,
});
