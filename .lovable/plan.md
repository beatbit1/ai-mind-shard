

# Real 0G integration for Mnemos (Compute + Storage + OpenClaw)

## What we're building

Mnemos becomes a **real coding & blockchain research agent** that:
- Chats via **0G Compute** running `llama-3.3-70b-instruct` (auto-discovered provider, no static URL needed)
- Persists every exchange as **AES-256-GCM encrypted blobs on 0G Storage** (Galileo testnet, real merkle root)
- Pays for inference + storage via **OpenClaw prepaid ledger** (real OG micropayments, surfaced in the trace)
- Recalls past memories on return by listing the wallet's stored roots and downloading + decrypting them

No simulation left in Mnemos. Atlas stays simulated for now (separate task).

## Secrets we need (just 2)

When you approve, I'll trigger the secret prompt for:
1. **`ZG_PRIVATE_KEY`** — funded Galileo testnet wallet private key (the 64-hex-char one starting with `0x`, NOT the address you sent). Needs ~0.1 OG from the faucet.
2. **`ZG_MEMORY_ENC_KEY`** — 32-byte hex string for AES-256-GCM. I'll provide the exact `openssl rand -hex 32` command in the prompt; you paste the output.

Dropped: `ZG_COMPUTE_PROVIDER_URL` (auto-discovered) and `ZG_COMPUTE_API_SECRET` (per-request signed headers, no static secret exists).

## Architecture

All 0G SDK calls run **server-side** in TanStack `createServerFn` handlers — the SDKs are Node-leaning and the private key must never reach the browser.

```text
Browser (Mnemos.tsx)
   │  useServerFn(chat0g)        useServerFn(commitMemory)        useServerFn(recallMemories)
   ▼                                ▼                                ▼
src/server/zg.functions.ts  ──────────────────────────────────────────────
   │                                │                                │
   ▼                                ▼                                ▼
0g-serving-broker SDK          @0glabs/0g-ts-sdk              @0glabs/0g-ts-sdk
(inference + ledger)            Indexer + ZgFile                Indexer.download
+ OpenClaw prepaid             → uploads encrypted blob        + AES-GCM decrypt
ledger (auto-debit)            → returns rootHash + txHash
```

## New / changed files

**Server (new):**
- `src/server/zg.client.ts` — initializes wallet (`ethers`), `Indexer` (Turbo testnet), and `0g-serving-broker` once. Module-level singletons gated by `createServerOnlyFn`.
- `src/server/zg.crypto.ts` — AES-256-GCM encrypt/decrypt helpers using `ZG_MEMORY_ENC_KEY`.
- `src/server/zg.functions.ts` — three `createServerFn` endpoints:
  - `chat0g({ messages })` → discovers `llama-3.3-70b-instruct` provider, generates signed auth headers via broker, calls OpenAI-compatible `/chat/completions`, returns assistant reply + provider/model/cost metadata.
  - `commitMemory({ wallet, role, text, sessionId })` → encrypts payload, uploads via `Indexer.upload(zgFile)`, returns `{ rootHash, txHash, sizeBytes, latencyMs }`.
  - `recallMemories({ wallet, limit })` → reads the wallet's memory index (a small JSON manifest stored at a deterministic path per wallet), downloads each blob, decrypts, returns the message list with per-shard latency + cost.
- `src/server/zg.ledger.ts` — `ensureLedgerFunded()` helper that checks `broker.ledger.getLedger()` and tops up with `broker.ledger.depositFund(0.05)` if balance < threshold. Called lazily before each inference + download.

**Frontend (refactor):**
- `src/components/workspaces/Mnemos.tsx` — rewrite around the new server functions. Persona switches to **coding / blockchain research companion**. Seed prompts:
  - *"Explain ERC-4337 account abstraction step by step"*
  - *"Audit this Solidity function for reentrancy: …"*
  - *"Index the last 10 swaps on Uniswap v4 pool 0x…"*
  - *"What's the gas cost of CREATE2 vs CREATE in current EVM?"*
  
  On every send: call `commitMemory` (user msg) → `chat0g` (full thread) → `commitMemory` (assistant msg) → push real trace lines. The "Simulate return after 2 days" button now actually clears local state and calls `recallMemories(wallet)` — the agent replies referencing real decrypted prior context.

- `src/components/workspaces/RecallTrace.tsx` — gains real fields: provider address, model, txHash (linkable to chainscan-galileo), rootHash. Already supports the shape.

**Deps to add:**
- `@0glabs/0g-ts-sdk` — storage SDK
- `@0glabs/0g-serving-broker` — compute SDK
- `ethers` v6 — required by both SDKs

## OpenClaw integration

Wired into `zg.ledger.ts`:
1. On first server-fn call after deploy, `ensureLedgerFunded()` deposits 0.05 OG into the OpenClaw prepaid ledger via `broker.ledger.depositFund(0.05)`.
2. Every subsequent inference call and storage download auto-debits from this balance — the broker handles the on-chain micropayment under the hood and returns the cost.
3. We surface `broker.ledger.getLedger()` balance in the trace footer so judges see it tick down in real time (`ledger: 0.0479 OG`).

## Trace output (real, not simulated)

When you send a message, the right panel will show:

```text
12:04:11 › encrypting · AES-256-GCM · 412B
12:04:11 › uploading to 0G Storage · indexer.upload(zgFile)
12:04:13 ✓ committed · root 0xa1b2…f9e0 · tx 0x7c4e…12ab · 1.84s
12:04:13 › discovering inference provider · llama-3.3-70b-instruct
12:04:13 › signing request headers · OpenClaw debit pending
12:04:14 › POST /chat/completions · provider 0xf072…65Dd
12:04:18 ✓ inference · 4.1s · 287 tokens · 0.00031 OG debited
12:04:18 › encrypting reply · uploading
12:04:19 ✓ committed · root 0xc3d4…aa11 · tx 0x9f81…ee02
        ledger: 0.04959 OG · session: 2 memories
```

## Verification plan

After implementation, I'll:
1. Hit `/api/test-zg-storage` (a temporary `createServerFn`-backed route) to upload "hello world", get a real root hash, then download + decrypt — confirms storage round-trip works.
2. Hit `/api/test-zg-inference` to call `llama-3.3-70b-instruct` with "say hi" — confirms compute + ledger debit works.
3. Open Mnemos in the preview, send a message, watch trace, check the txHash links resolve on `chainscan-galileo.0g.ai`.
4. Click "Simulate return", ask "what did we discuss?" — agent should reply with real recalled context from decrypted blobs.
5. Remove the two test routes once verified.

I'll report back with the rootHash, txHash, ledger balance change, and a screenshot of the working trace.

## Risks / fallbacks

- **Worker runtime compatibility**: `@0glabs/0g-ts-sdk` uses `ethers` + some Node crypto. Both work under TanStack's `nodejs_compat` worker. If a specific submodule fails (e.g., a stream API), we narrow to the exact `Indexer` + `ZgFile` exports we need and stub the rest.
- **Faucet blocked**: if you can't get OG tokens before we ship, integration code still deploys but server functions will return a clear "wallet unfunded — please fund 0x… on Galileo" error instead of crashing. Mnemos shows this inline.
- **Provider downtime**: if `llama-3.3-70b-instruct` provider is offline, we fall back to `deepseek-r1-70b` automatically.

Approve and I'll request the 2 secrets, then implement + verify end-to-end.

