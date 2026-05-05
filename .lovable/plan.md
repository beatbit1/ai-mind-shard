
# Full Mainnet Deployment — All Tonara Contracts on 0G Aristotle

Five contracts total, deployed via Remix IDE, then wired into the app. You don't need Hardhat or Foundry — everything works in the browser.

## Contract overview

| # | Contract | Purpose | Required? |
|---|---|---|---|
| 1 | **Tonara.sol** (ERC-20) | $TONARA token — identity, payments, judging proof | Yes |
| 2 | **MemoryRegistry.sol** | On-chain log of every encrypted memory root hash per user | Yes |
| 3 | **InferenceLedger.sol** | Pre-paid OG balance per user; agent debits per inference | Yes |
| 4 | **AgentRegistry.sol** | Registry of agents (Mnemos, Atlas, future custom) | Recommended |
| 5 | **SessionAccess.sol** | Lets a user grant a teammate read access to a session | Optional (skip for hackathon) |

For the hackathon I recommend **#1, #2, #3, #4** (skip #5 — not on the demo path).

---

## Phase 0 — One-time setup (you, ~10 min)

1. Add **0G Aristotle Mainnet** to MetaMask:
   ```text
   Network name:  0G Mainnet (Aristotle)
   RPC URL:       https://evmrpc.0g.ai
   Chain ID:      16661
   Symbol:        OG
   Explorer:      https://chainscan.0g.ai
   ```
2. Fund the wallet with **~3 OG** (enough to deploy all 4 contracts + a few test txns).
3. Open https://remix.ethereum.org. Left sidebar → **Deploy & run** → Environment → **Injected Provider — MetaMask**. Confirm Remix shows `Custom (16661) network`.

---

## Phase 1 — Deploy order (matters!)

Deploy in this exact order because some contracts reference others:

```text
1. Tonara (ERC-20)         ← independent
2. MemoryRegistry          ← independent
3. InferenceLedger         ← independent
4. AgentRegistry           ← independent
─────────────────────────────────────────
5. (After all four)        ← grant ROUTER_ROLE on InferenceLedger
                              to the Tonara agent wallet
```

For each contract: paste the source I'll provide → compile (Solidity 0.8.24, EVM cancun) → Deploy → MetaMask confirms → copy address + tx hash.

---

## Phase 2 — What you send back to me

After all four deploys, paste a block like this in chat:

```text
Owner wallet:        0x...
Agent wallet:        0x...   (the ZG_PRIVATE_KEY public address — I'll tell you what it is)

Tonara token:        0x...   tx 0x...
MemoryRegistry:      0x...   tx 0x...
InferenceLedger:     0x...   tx 0x...
AgentRegistry:       0x...   tx 0x...
```

I'll give you the exact contract source files in the next message after you approve this plan (each is short, ~40-80 lines, all use OpenZeppelin which Remix auto-resolves).

---

## Phase 3 — What I wire on the app side

Once you send the addresses, I'll do all of this in one shot:

### 3.1 New chain config
- `src/lib/wallet.ts` → add `zeroGMainnet` (chain 16661) alongside existing testnet entry. RainbowKit will let users pick which to connect to.

### 3.2 Contract addresses + ABIs
- New folder `src/contracts/` containing one `.json` ABI per contract + a single `addresses.ts`:
  ```text
  TONARA            = "0x..."
  MEMORY_REGISTRY   = "0x..."
  INFERENCE_LEDGER  = "0x..."
  AGENT_REGISTRY    = "0x..."
  ```

### 3.3 Storage flow → MemoryRegistry
- `src/server/zg.functions.ts::commitMemory`:
  1. Encrypt + upload to 0G Storage (already works) → returns `rootHash`
  2. **NEW**: agent wallet calls `MemoryRegistry.commitFor(user, rootHash, size, kind, sessionId)` → returns on-chain index + mainnet tx hash
  3. Both hashes returned to the UI

- `src/components/workspaces/Mnemos.tsx` & `Atlas.tsx`:
  - Replace `localStorage` root-hash list with reads from `MemoryRegistry.recordsOf(wallet, 0, 100)`
  - On first connect, prompt user to call `setDelegate(agentWallet, true)` so the agent can commit on their behalf (one-time tx)

### 3.4 Inference billing → InferenceLedger
- `src/server/zg.ledger.server.ts`: replace the broker's off-chain ledger with `InferenceLedger.balanceOf(user)` reads + `charge(user, provider, amount, requestId)` writes (signed by agent wallet, which holds `ROUTER_ROLE`).
- Add a **"Top up"** button in the dashboard that calls `deposit()` (sends OG from user wallet).

### 3.5 Agent registry → workspace switcher
- `src/components/AppShellClient.tsx`: load workspace tabs from `AgentRegistry.get(...)` instead of hard-coded "Mnemos / Atlas". Future you adds a new agent by calling `register()` from MetaMask — appears in the sidebar instantly.
- I'll register Mnemos + Atlas as part of post-deploy setup.

### 3.6 $TONARA on dashboard
- New "TONARA Balance" card with `useReadContract({ ... balanceOf })`
- "Add to MetaMask" button (`wallet_watchAsset`)
- Optional **"Pay with TONARA"** toggle for inference (transfers TONARA to agent wallet before each query)

### 3.7 Dashboard explorer links
- All four contract addresses + every tx hash get clickable links to `https://chainscan.0g.ai/...` so judges can verify.

### 3.8 Keep testnet alive as fallback
- 0G **Storage** + **Compute** SDKs still hit Galileo testnet (cheap, fast, free).
- Mainnet is used for: token, memory registry, inference ledger, agent registry.
- This hybrid is the realistic posture — 0G mainnet storage/compute is paid OG, testnet is free.

### 3.9 Verification I'll run
1. Connect wallet on 0G Mainnet → see TONARA balance, ledger balance, memory count.
2. Send a Mnemos message → confirm:
   - 0G Storage upload tx (testnet)
   - `MemoryRegistry.commitFor` tx (mainnet) ← visible on chainscan.0g.ai
   - `InferenceLedger.charge` tx (mainnet)
3. Click any record → audit modal shows both the storage root and the mainnet registry index.
4. Paste all the chainscan links back to you for the judge demo.

---

## Phase 4 — Post-deploy setup transactions (~5 min, you do these in MetaMask)

After the app is wired, you'll trigger 3 small txns once:

1. **Grant router role** on `InferenceLedger`: call `grantRole(ROUTER_ROLE, agentWallet)` — lets the agent debit users' ledger balance. I'll add a "Setup" admin page that does this with one click.
2. **Register Mnemos** on `AgentRegistry`: `register("Mnemos", "0g://<manifest-root>")`
3. **Register Atlas** on `AgentRegistry`: `register("Atlas", "0g://<manifest-root>")`

I'll surface these as buttons in a new `/admin` route visible only to the deployer wallet.

---

## Risks / things to know

- **Real OG cost**: ~0.5–1 OG total for all 4 deploys + role setup. Each MemoryRegistry commit thereafter is < 60k gas (cents).
- **Agent wallet must have OG**: it pays gas for `commitFor` and `charge`. Top it up with ~2 OG.
- **Don't lose deployer key**: it owns Tonara supply, AgentRegistry admin, and InferenceLedger admin. Use a fresh wallet you control.
- **Skip SessionAccess for now**: not on the demo path. Easy to add post-hackathon.
- **Storage on mainnet later**: if you eventually want 0G Storage on mainnet too, it's a one-line change in `src/server/zg.core.server.ts` (`ZG_RPC` + `ZG_INDEXER_RPC`).

---

## Your next action

Reply **"go"** and I'll send you:
1. Four ready-to-paste `.sol` files (Tonara, MemoryRegistry, InferenceLedger, AgentRegistry).
2. The agent wallet's public address (so you know which address to delegate to and fund).
3. Step-by-step Remix screenshots-style instructions for each deploy.

After you deploy and paste the addresses, I'll do Phase 3 (full app integration) in a single build.
