# Tonara Smart-Contract Spec (Mainnet)

This document is the contract surface the off-chain app (Mnemos + Atlas) is built
against. The Solidity dev should deliver these contracts on the chosen mainnet
(0G mainnet primary; EVM L2 fallback). All structs/events/functions below are
required — do not rename.

---

## 1. `MemoryRegistry.sol`

Anchors encrypted-memory manifests committed to 0G Storage. Each user (EOA or
SCW) has an append-only log of `(rootHash, sizeBytes, timestamp, kind)`. The
app currently keeps roots in `localStorage`; this contract is the on-chain
source of truth so memory survives device loss.

```solidity
enum MemoryKind { User, Assistant, ResearchBrief, Custom }

struct MemoryRecord {
    bytes32 rootHash;     // 0G storage merkle root
    uint64  sizeBytes;
    uint64  timestamp;
    MemoryKind kind;
    bytes32 sessionId;    // groups exchanges
}

event MemoryCommitted(address indexed owner, uint256 indexed index, bytes32 rootHash, MemoryKind kind, bytes32 sessionId);
event MemoryRevoked(address indexed owner, uint256 indexed index);
event DelegateSet(address indexed owner, address indexed delegate, bool allowed);

function commit(bytes32 rootHash, uint64 sizeBytes, MemoryKind kind, bytes32 sessionId) external returns (uint256 index);
function commitBatch(bytes32[] calldata roots, uint64[] calldata sizes, MemoryKind[] calldata kinds, bytes32 sessionId) external returns (uint256 firstIndex);
function revoke(uint256 index) external; // marks tombstone; record stays for audit
function recordsOf(address owner, uint256 offset, uint256 limit) external view returns (MemoryRecord[] memory);
function recordCount(address owner) external view returns (uint256);
function setDelegate(address delegate, bool allowed) external; // lets the agent commit on user's behalf
function commitFor(address owner, bytes32 rootHash, uint64 sizeBytes, MemoryKind kind, bytes32 sessionId) external returns (uint256);
```

**Notes for the dev**
- Storage layout must be append-only — never reorder.
- `commitFor` MUST require `delegates[owner][msg.sender] == true`.
- Emit `MemoryCommitted` for every commit (the indexer reads these).
- Gas target: < 60k for `commit`, < 30k per item in `commitBatch`.

---

## 2. `InferenceLedger.sol` (replaces today's "OpenClaw" off-chain ledger)

Pre-paid balance per user that the agent debits per inference call. On testnet
we use the 0G serving-broker's ledger; on mainnet this contract owns it.

```solidity
event Deposited(address indexed user, uint256 amount, uint256 newBalance);
event Withdrawn(address indexed user, uint256 amount);
event Charged(address indexed user, address indexed provider, uint256 amount, bytes32 requestId);
event ProviderRegistered(address indexed provider, string endpoint, uint256 pricePerCall);
event ProviderRetired(address indexed provider);

function deposit() external payable;
function depositFor(address user) external payable;
function withdraw(uint256 amount) external;
function balanceOf(address user) external view returns (uint256);

// charged by an authorized router (see AccessControl below)
function charge(address user, address provider, uint256 amount, bytes32 requestId) external;

// provider registry
function registerProvider(address provider, string calldata endpoint, uint256 pricePerCall) external; // onlyAdmin
function retireProvider(address provider) external; // onlyAdmin
function provider(address provider) external view returns (string memory endpoint, uint256 pricePerCall, bool active);
```

**Notes**
- AccessControl: `DEFAULT_ADMIN_ROLE`, `ROUTER_ROLE` (allowed to call `charge`),
  `PROVIDER_ADMIN_ROLE`.
- Use OpenZeppelin `ReentrancyGuard` on `withdraw`.
- Min deposit and per-call cap to bound griefing.
- Off-chain agent submits a signed receipt; router verifies + calls `charge`.

---

## 3. `AgentRegistry.sol`

Lets users (or DAOs) register named agents (Mnemos, Atlas, custom). The frontend
reads this to populate the workspace switcher dynamically post-mainnet.

```solidity
struct Agent {
    bytes32 id;
    address owner;
    string  name;
    string  metadataURI;   // ipfs://… or 0g://<root> JSON manifest
    bool    active;
}

event AgentRegistered(bytes32 indexed id, address indexed owner, string name);
event AgentUpdated(bytes32 indexed id, string metadataURI, bool active);

function register(string calldata name, string calldata metadataURI) external returns (bytes32 id);
function update(bytes32 id, string calldata metadataURI, bool active) external;
function get(bytes32 id) external view returns (Agent memory);
function ownerOf(bytes32 id) external view returns (address);
```

---

## 4. `SessionAccess.sol` (optional, recommended)

Granular sharing: lets a memory owner grant another address read-access to a
specific `sessionId` so a teammate / auditor can decrypt with the same wrapped
key.

```solidity
event AccessGranted(address indexed owner, bytes32 indexed sessionId, address indexed reader, uint64 expiresAt);
event AccessRevoked(address indexed owner, bytes32 indexed sessionId, address indexed reader);

function grant(bytes32 sessionId, address reader, uint64 expiresAt) external;
function revoke(bytes32 sessionId, address reader) external;
function canRead(address owner, bytes32 sessionId, address reader) external view returns (bool);
```

The encrypted symmetric key is delivered off-chain (e.g., via 0G storage entry
keyed by `keccak256(owner, sessionId, reader)`), but on-chain `canRead` is the
authority the agent honours.

---

## 5. Deployment & Wiring Checklist

1. Deploy `MemoryRegistry`, `InferenceLedger`, `AgentRegistry`, `SessionAccess`.
2. Grant `ROUTER_ROLE` on `InferenceLedger` to the off-chain agent's hot wallet
   (the same wallet currently held by `ZG_PRIVATE_KEY`).
3. For each supported model provider, call `registerProvider(...)` with the 0G
   compute endpoint and `pricePerCall` in wei.
4. Frontend integration points (already stubbed in this repo):
   - `src/server/zg.ledger.server.ts` → call `InferenceLedger.charge` instead of
     `broker.ledger.depositFund`.
   - `src/server/zg.functions.ts::commitMemory` → after `indexer.upload`, call
     `MemoryRegistry.commitFor(user, rootHash, …)` from the agent wallet.
   - `src/components/workspaces/Mnemos.tsx::getRoots` → replace `localStorage`
     with `MemoryRegistry.recordsOf(address, …)`.
   - `src/components/AppShellClient.tsx` → load workspace list from
     `AgentRegistry`.
5. Verify on Etherscan / chainscan-mainnet.0g.ai. Publish ABI JSONs to
   `src/contracts/`.

## 6. Security Requirements (non-negotiable)

- Solidity ^0.8.24, `via-ir` enabled.
- OpenZeppelin AccessControl + ReentrancyGuard + Pausable.
- Full Foundry test suite, fuzz `commit`/`charge`, invariant: ledger total = sum
  of balances + reserved.
- Two independent audits before mainnet.
- Upgradeability: prefer immutable contracts + versioned redeploy. If UUPS is
  required, gate the upgrade behind a 7-day timelock + multisig.
- Gas refund / batched commits to reduce mainnet cost for chatty sessions.

## 7. Out of scope for the contract dev

- Encryption key management (handled in `src/server/zg.crypto.server.ts`).
- 0G Storage merkle proofs (handled by `@0glabs/0g-ts-sdk`).
- Frontend wiring (handled here, post-deploy).
