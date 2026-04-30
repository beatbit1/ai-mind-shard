import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  injectedWallet,
  rainbowWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import type { Chain } from "wagmi/chains";

// 0G Galileo testnet (chain id 16602 — current Galileo network).
export const zeroGTestnet: Chain = {
  id: 16602,
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

// Use injected/MetaMask connectors directly so MetaMask pops up immediately
// (no WalletConnect dependency / no demo projectId hang).
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, injectedWallet, rainbowWallet, coinbaseWallet],
    },
  ],
  {
    appName: "Tonara",
    projectId: "tonara-injected", // not used by injected wallets, but required by the API
  },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [zeroGTestnet, mainnet, sepolia],
  transports: {
    [zeroGTestnet.id]: http("https://evmrpc-testnet.0g.ai"),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
});
