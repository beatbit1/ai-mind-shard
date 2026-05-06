# Tonara × 0G Mainnet Integration

You deployed all 4 contracts on **0G Aristotle mainnet (chain 16661)**. This plan wires them into the app, commits the `.sol` sources to the repo (so they survive Remix), and surfaces real mainnet txns in the UI.

## Deployed contracts (recorded)

```text
Tonara (ERC-20):    0x9fBe747Acd390198295c848ed7EdF38942237935
   ⚠ NOTE: same address as MemoryRegistry below — likely a copy/paste mix-up
MemoryRegistry:     0x9fBe747Acd390198295c848ed7EdF38942237935
InferenceLedger:    0x739280dD1Cf1B8e9d648C7f315736085a4191A2A
AgentRegistry:      0xc6DA0F91b357308097760464bcD86A119950B896
```

**Question I need answered before wiring:** the Tonara token address and the MemoryRegistry address you pasted are identical. Only one contract can live at any address. Almost certainly the **Tonara ERC-20 address from your earlier message is the real Tonara token**, and `0x9fBe...7935` from this message is **MemoryRegistry**. I'll proceed assuming that. If wrong, tell me and I'll swap one address in `addresses.ts`. this is memoryregistry contract address 0x3E045a00179510c8fe6358CD93fA8F1BEE7e293e this is the real one 

---

## What I'll build

### 1. Commit the 4 `.sol` files to the repo

- New folder `contracts/` at repo root with:
  - `Tonara.sol`, `MemoryRegistry.sol`, `InferenceLedger.sol`, `AgentRegistry.sol`
  - `README.md` listing addresses, tx hashes, deployer, network
- Auto-syncs to your GitHub repo (no manual git work).

### 2. Add mainnet chain + addresses + ABIs

- `src/lib/wallet.ts`: add `zeroGMainnet` (chain 16661, RPC `https://evmrpc.0g.ai`, explorer `https://chainscan.0g.ai`) — RainbowKit will let users pick mainnet or testnet.
- New folder `src/contracts/`:
  - `addresses.ts` — exports the 4 addresses + chain id
  - `MemoryRegistry.abi.json`, `InferenceLedger.abi.json`, `AgentRegistry.abi.json`, `Tonara.abi.json` (the JSONs you pasted)

### 3. Server-side: agent commits memory roots to mainnet

- New `src/server/zg.contracts.server.ts`:
  - Mainnet `JsonRpcProvider` + `Wallet` (uses existing `ZG_PRIVATE_KEY` — the same agent wallet you funded)
  - Helpers: `commitMemoryOnChain(owner, rootHash, sizeBytes, kind, sessionId)`, `chargeInference(user, provider, amount, requestId)`, `getOnChainBalance(user)`
- `src/server/zg.functions.ts::commitMemory`: after the 0G Storage upload, call `MemoryRegistry.commitFor(...)` from the agent wallet → return both the storage `txHash` (testnet) AND the new `mainnetTxHash` + `recordIndex`.

### 4. UI surfacing of mainnet activity

- **Dashboard** (`src/components/workspaces/Dashboard.tsx`):
  - New "Mainnet Contracts" card showing all 4 addresses, each linking to `chainscan.0g.ai/address/<addr>`
  - "TONARA Balance" tile (reads `balanceOf(wallet)` from the token contract)
  - "On-chain memories" tile (reads `MemoryRegistry.recordCount(wallet)`)
  - Audit modal: when a memory has a mainnet tx, show "Verified on 0G Mainnet ✓" + link
- **Mnemos** (`src/components/workspaces/Mnemos.tsx`):
  - Store `mainnetTxHash` alongside `rootHash` in `appendMemoryRecord` (extend `MemoryRecordRef` type)
  - Show a small "⛓ mainnet anchored" badge under each saved exchange
- **WalletConnect**: when user is on testnet, show a one-click "Switch to 0G Mainnet" prompt before they can anchor memories on-chain.

### 5. One-time delegation prompt

First time a user connects on mainnet, prompt: "Allow Tonara agent to anchor your memories on-chain?" → calls `MemoryRegistry.setDelegate(agentWallet, true)` from MetaMask. After that, all `commitFor` calls succeed silently. This is the ONE tx the user pays for — every subsequent commit is paid by the agent wallet.

### 6. README updates

- `contracts/README.md`: deployment record + ABIs reference
- Top-level note in `SMART_CONTRACTS.md`: "✅ Deployed to 0G Aristotle mainnet" with the 4 addresses

---

## Post-deploy txns you'll do (one-time, ~3 MetaMask clicks)

After I push the integration, you'll trigger 3 small admin txns from MetaMask via a new `/admin` page (only visible to your deployer wallet):

1. `**InferenceLedger.grantRole(ROUTER_ROLE, agentWallet)**` — lets the agent debit user balances. I'll give you the agent wallet address in chat once the wiring is done (it's the public address of `ZG_PRIVATE_KEY`).
2. `**AgentRegistry.register("Mnemos", "0g://mnemos-manifest")**`
3. `**AgentRegistry.register("Atlas", "0g://atlas-manifest")**`

Each is < 0.01 OG.

---

## What stays on testnet (intentionally)

- 0G **Storage** uploads (cheap, fast — testnet is the right cost profile for chatty memories)
- 0G **Compute** inference (paid via the broker's testnet ledger)

What's on mainnet:

- $TONARA token, MemoryRegistry anchors, InferenceLedger settlement, AgentRegistry

This hybrid is the realistic posture for the hackathon demo and matches the original plan.

---

## Risks / things to flag

- **The Tonara/MemoryRegistry address collision** — please confirm which is which before I push, or I'll assume the labelling above.
- **Agent wallet needs OG on mainnet** to pay gas for `commitFor` and `charge`. Top it up with ~1–2 OG. Send me its address verification once I show it to you.
- **Compiling Solidity in CI**: I'll commit raw `.sol` source only — no Hardhat/Foundry build. The repo stays clean; the contracts are already deployed so we don't need to recompile.

---

## Your next action

Reply **"go"** and I'll do all 6 sections in one build, then tell you:

1. The agent wallet address to fund + delegate to
2. The 3 admin txns to trigger from `/admin`
3. Test steps to verify mainnet activity shows up in the dashboard  
  
go, let integrate everything and send me the agent wallet too then verify sand test if everything are working, then add all contract sol addresses on the github repo and explorer link for judges verification. 