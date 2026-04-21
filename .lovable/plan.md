

# Rebuild the dashboard around the two real use cases

You're right — the current `/app` is too abstract. We'll redesign it as **two purpose-built workspaces** that walk the user through the exact case-study flows, so when judges open it they immediately see the product in action.

## New navigation model

The dashboard becomes a workspace with a left sidebar and two switchable apps:

```text
┌──────────────┬──────────────────────────────────────────────┐
│  TONARA      │                                              │
│              │            [ Active workspace ]              │
│  · Mnemos    │                                              │
│  · Atlas     │                                              │
│              │                                              │
│  ───────     │                                              │
│  wallet      │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Mnemos** — the companion-agent workspace (sharded memory use case). "Mnemos" = memory in Greek, fits the "permanent brain" story without using the word "shard".
- **Atlas** — the cross-chain research-agent workspace (cross-chain fragmentation use case). "Atlas" = a map across chains.

No "Sharded Memory" / "Cross-Chain Fragmentation" labels in the UI. Those become the *infrastructure* powering each app, surfaced in the runtime trace panel.

Top bar keeps **Connect Wallet** (RainbowKit, already wired) and removes the "0G testnet" badge and address chip you didn't want.

---

## Workspace 1 — Mnemos (Companion Agent)

Mirrors your case study: *"User chats with agent → conversation stored as encrypted shards → returns 2 days later → agent recalls a specific past detail."*

**Layout:** chat on the left (60%), live infra trace on the right (40%).

**Chat panel:**
- Real chat UI: user bubbles + agent bubbles, input at the bottom, send button.
- Each user message is "encrypted and sharded" in the background — we visualize it without saying "shard": the message briefly shows a lock icon + "memory committed · mem_xxxx".
- A **"Simulate return after 2 days"** button at the top. Clicking it clears the visible chat (like a fresh session), keeps the wallet connected, and shows an empty input. When the user types something vague like "hey" or clicks a suggested prompt ("continue our last conversation"), the agent automatically performs a recall and replies referencing the prior context (e.g., *"Last time you mentioned trouble sleeping — did the breathing exercise help?"*).
- Seed prompts at the bottom of empty state: *"I've been struggling to sleep lately"*, *"Help me think through a career decision"*, *"Remember that I'm allergic to peanuts"*.

**Right side — Recall trace:**
Live timeline that lights up during recall:
```text
› resolving on-chain index · mem_8f21c…
› micropayment · 0.0021 OG → ShardEscrow
› fetching 6 shards in parallel
   ├─ 0G  ████████ 4/4
   └─ 0G  ████     2/2
✓ reassembled · decrypted · 287 ms
```
Plus a small stat row: `latency`, `shards`, `cost`, `memory_id`.

**Wallet gate:** chat input is disabled with an inline "Connect wallet to start a session" until connected.

---

## Workspace 2 — Atlas (Cross-Chain Research Agent)

Mirrors your case study: *"Agent on Solana queries 'what did I learn about token X?' → master index on 0G says shards live on 0G(4) + ETH(2) + SOL(2) → reassembled in <500ms."*

**Layout:** query bar on top, animated chain map in the middle, research output below.

**Query bar:**
- Single input: *"Ask Atlas about any token, protocol, or wallet…"*
- Pre-seeded chips: `What did I learn about $JITO?`, `Summarize my notes on Uniswap v4 hooks`, `Top 3 risk flags for token 0x…`

**Chain map (the visual centerpiece):**
- Three labeled nodes laid out horizontally: **0G**, **ETH**, **SOL** (mono SVG, styled like the rest of the site).
- A center node = **Atlas**.
- When a query runs, animated lines pulse from each chain to Atlas as shards arrive, with a counter on each edge: `0G · 4/4`, `ETH · 2/2`, `SOL · 2/2`.
- A "Simulate 0G outage" toggle: when enabled, the 0G edge fails mid-fetch and the system reconstructs from ETH + SOL only (proves erasure-coding redundancy — the killer demo moment).

**Research output card:**
A formatted research note streams in token-by-token after reassembly (e.g., a paragraph about token X with bullet risk flags). Footer shows: `8 shards · 3 chains · reassembled in 412 ms · manifest 0x…anchored on 0G`.

**Wallet gate:** query button disabled until connected.

---

## Files to change

- **`src/routes/app.tsx`** — replace the current single-page operator console with a workspace shell: sidebar nav (Mnemos / Atlas), top bar with Connect Wallet, and a switcher that mounts one workspace at a time. Keep `WalletProviders` wrapper.
- **`src/components/workspaces/Mnemos.tsx`** — new. Chat UI + recall trace + "simulate return" flow. Local state for messages and a fake long-term store keyed by wallet address (so reconnecting actually feels like resuming).
- **`src/components/workspaces/Atlas.tsx`** — new. Query bar + animated SVG chain map + research output. Includes the outage toggle.
- **`src/components/workspaces/RecallTrace.tsx`** — new. Reusable infra timeline component used by both workspaces.
- **`src/components/workspaces/ChainMap.tsx`** — new. SVG-based animated 0G/ETH/SOL ↔ Atlas graph with pulsing edges.

No changes to landing page, wallet config, or providers. All visuals stay strict black/white per your design rules.

## What this gives you for the demo

1. Open `/app`, click **Mnemos**, chat a few sentences → see "memory committed" pulses → click **Simulate return after 2 days** → ask "what were we talking about?" → agent answers correctly and the trace panel lights up showing the 0G recall. Exact case-study flow.
2. Click **Atlas**, run a token query → watch shards stream in from 0G + ETH + SOL on the map → research note materializes. Toggle the outage and re-run → 0G edge fails red, ETH+SOL still reconstruct. Exact case-study flow with a wow moment.

Both workspaces are fully functional simulations on top of the wallet connection that already works — no backend needed for the hackathon demo, and the structure is ready to swap in real 0G SDK calls per panel later.

