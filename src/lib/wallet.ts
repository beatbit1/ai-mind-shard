import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  injectedWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import type { Chain } from "wagmi/chains";

// 0G Aristotle mainnet (chain id 16661) — production contracts live here.
export const zeroGMainnet: Chain = {
  id: 16661,
  name: "0G Aristotle Mainnet",
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc.0g.ai"] },
    public: { http: ["https://evmrpc.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G ChainScan", url: "https://chainscan.0g.ai" },
  },
};

// Use RainbowKit's getDefaultConfig — it wires up the EIP-6963 injected
// discovery so MetaMask (and any other browser-extension wallet) is detected
// reliably. Custom connectorsForWallets requires a valid WalletConnect
// projectId or the connector list silently fails to initialize.
export const wagmiConfig = getDefaultConfig({
  appName: "Tonara",
  // Public WalletConnect Cloud demo projectId. Required by RainbowKit but only
  // used for the WalletConnect QR fallback, not for the injected MetaMask flow.
  projectId: "3fbb6bba6f1de962d911bb5b5c9dba88",
  chains: [zeroGMainnet],
  wallets: [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, injectedWallet, rainbowWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
  ssr: true,
});
