# Plan — Live 0G Dashboard + Mnemos/Atlas Verification

## What you'll get

1. A new **Dashboard** tab in the workspace switcher (alongside Mnemos and Atlas) that shows **live data from 0G**, not localStorage:
   - Agent wallet address + on-chain OG balance (testnet)
   - **InferenceLedger balance** (real, polled every 15s)
   - **On-chain memory record count** for your connected wallet
   - **Recent records** table (last 10) with root hash, size, timestamp, and link to 0G chainscan
   - Live status pill: `0G online` / `unfunded` / `not configured`
2. A real verification run executed by me against the live 0G testnet, with the results pasted into chat as evidence (tx hashes, root hashes, ledger balance, inference latency, model used, verified=true/false).
3. A short "what Mnemos does / what Atlas does / what to build next" section so you can hand it to a tester.

---

## Current state (verified by reading the code)

- `ZG_PRIVATE_KEY` and `ZG_MEMORY_ENC_KEY` secrets are **already set** — the "not configured" warning won't appear anymore.
- Server functions that already work and hit real 0G testnet:
  - `chat0g` → 0G Compute broker, picks `llama-3.3-70b-instruct` or `deepseek-r1-70b`, returns `verified` flag from broker `processResponse`.
  - `commitMemory` → AES-256-GCM encrypts, uploads via `Indexer.upload`, returns real `rootHash` + `txHash`.
  - `recallMemories` → downloads by root hash, decrypts, returns memories.
  - `zgStatus` → returns wallet address + ledger OG.
- **Gap that makes the dashboard "feel dummy" today**: the list of root hashes is stored in `localStorage` per wallet. There is no server function that returns "all my records" from 0G directly, and no UI surface that shows them.

## What I'll build

### 1. New server function: `listMemories`
- Input: `{ wallet, rootHashes }` (root hashes still tracked client-side per wallet, but server now resolves them in parallel and returns metadata only — size, ts, role, sessionId — without exposing decrypted text in the dashboard list).
- Reuses `getIndexer()` and `decrypt()`.
- Returns `{ count, items: [{ rootHash, role, sessionId, ts, sizeBytes, latencyMs }] }`.

### 2. New server function: `ledgerSnapshot`
- Returns `{ address, walletOG, ledgerOG, services: [{provider, model, url}], chainId, blockNumber }`.
- Single round-trip for the dashboard header.

### 3. New component: `src/components/workspaces/Dashboard.tsx`
Layout:
```text
┌─────────────────────────────────────────────────────────┐
│  0G online · Galileo testnet · block #1234567           │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Wallet OG    │ Ledger OG    │ Records      │ Providers  │
│ 0.0421       │ 0.0500       │ 14           │ 3 online   │
├──────────────┴──────────────┴──────────────┴────────────┤
│  Recent records (last 10)                               │
│  root 0x12ab…f4 · user · 412B · 2m ago · tx ↗          │
│  root 0x9c3d…22 · assistant · 1.2KB · 2m ago · tx ↗    │
│  …                                                      │
└─────────────────────────────────────────────────────────┘
```
- Polls `ledgerSnapshot` every 15s via TanStack Query.
- Polls `listMemories` every 30s.
- "Refresh now" button.
- Empty state: "No records yet. Send your first message in Mnemos."

### 4. Wire it into `AppShellClient.tsx`
Add a third sidebar button "Dashboard · live 0G state" above Mnemos. Default landing tab becomes Dashboard so you see proof it's alive on first load.

### 5. Verification run (I do this after implementation, in the same turn)
I'll call the deployed server functions with `invoke-server-function`:
- `zgStatus` → confirm wallet + ledger
- `chat0g` with a real prompt → confirm 200, model name, latency, verified flag
- `commitMemory` with a known string → confirm rootHash + txHash
- `recallMemories` with that rootHash → confirm decrypt round-trips
- Paste the JSON evidence + a chainscan link for the tx into chat.

If any call fails I fix it before reporting.

---

## Functions of each agent (for the tester)

**Mnemos** — coding/blockchain research companion.
- Every user message is encrypted (AES-256-GCM) and uploaded to 0G Storage → returns a root hash + tx hash on Galileo testnet.
- Inference runs on 0G Compute (llama-3.3-70b or deepseek-r1-70b), with the broker's `processResponse` cryptographic verification.
- Returning sessions with vague prompts ("what were we working on?") trigger a recall: client sends stored root hashes → server downloads + decrypts → injects as system context before inference.
- Reply is also committed to 0G.

**Atlas** — cross-chain on-chain intelligence agent.
- Same 0G inference pipeline, different system prompt (research brief: protocol summary, on-chain signals, 3 risk flags).
- The "shard fetch" animation across 0G/ETH/SOL is a UX visualization of the manifest dispatch; the actual research output and the final memory commit are real 0G calls.
- Each finished brief is auto-committed to encrypted memory under `sessionId="atlas"` so it shows up in your dashboard count too.

---

## What's next for the smart-contract dev (mainnet)

You already have the full function list in `SMART_CONTRACTS.md`. The dashboard I'm building is the **frontend that those contracts will eventually power** — once `MemoryRegistry.commit` and `InferenceLedger.balanceOf` are deployed on 0G mainnet, I just swap the data sources in `listMemories` and `ledgerSnapshot` from the testnet broker to the mainnet contract calls. No UI changes needed.

Recommended next dev steps after this dashboard ships:
1. Add a "Sessions" view that groups records by `sessionId` and lets you replay one.
2. Add `revoke(rootHash)` once `MemoryRegistry` is on mainnet (today there's no on-chain revoke).
3. Add per-message "verified ✓" badge in Mnemos using the broker verification result we already have but don't display.

---

## Technical notes

- All new server functions live in `src/server/zg.functions.ts` and reuse the existing singletons in `zg.core.server.ts` — no new env vars.
- Dashboard uses TanStack Query with `refetchInterval` for real-time polling; no websockets needed.
- Root-hash list stays in `localStorage` for now (per-wallet) because there is no on-chain registry on testnet yet; this is the exact gap the mainnet `MemoryRegistry` contract closes.
- No changes to wallet/connect flow — RainbowKit `ConnectButton` is already in the header and working; if you don't see it, it's because the `/app` route is `ssr: false` and the wallet provider mounts client-side after hydration.
