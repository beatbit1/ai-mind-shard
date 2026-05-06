# Tonara Smart Contracts — 0G Aristotle Mainnet

All four production contracts deployed via Remix IDE on **0G Aristotle Mainnet
(chain id 16661)** using Solidity `0.8.24` (EVM `cancun`) with OpenZeppelin
contracts.

## Network

| Field | Value |
|---|---|
| Network | 0G Aristotle Mainnet |
| Chain ID | `16661` |
| RPC | `https://evmrpc.0g.ai` |
| Explorer | `https://chainscan.0g.ai` |
| Native token | OG |

## Deployments

| Contract | Address | Tx Hash | Explorer |
|---|---|---|---|
| **Tonara** (ERC-20) | `0x9fBe747Acd390198295c848ed7EdF38942237935` | `0x0d625c650b87164726f4bb7001ed4555f23f5c31ded76847e3482fd4a3133a08` | [view](https://chainscan.0g.ai/address/0x9fBe747Acd390198295c848ed7EdF38942237935) |
| **MemoryRegistry** | `0x3E045a00179510c8fe6358CD93fA8F1BEE7e293e` | _(see explorer)_ | [view](https://chainscan.0g.ai/address/0x3E045a00179510c8fe6358CD93fA8F1BEE7e293e) |
| **InferenceLedger** | `0x739280dD1Cf1B8e9d648C7f315736085a4191A2A` | `0x64b3c1cdd28ad6797f1e0c6f713722e3eb12cad9c47dba750e5c94b30b6030ef` | [view](https://chainscan.0g.ai/address/0x739280dD1Cf1B8e9d648C7f315736085a4191A2A) |
| **AgentRegistry** | `0xc6DA0F91b357308097760464bcD86A119950B896` | `0xf26d0432fa740c19809003122bbec6c418023a05e86ca5fe1232c827184b60cc` | [view](https://chainscan.0g.ai/address/0xc6DA0F91b357308097760464bcD86A119950B896) |

## Tonara agent wallet (server-side)

```
0x3BAd8c56E84a9b3B4B3f25Eb9013ca84b94f7ec5
```

This is the public address derived from the `ZG_PRIVATE_KEY` secret. The
backend uses it to:
- call `MemoryRegistry.commitFor(user, rootHash, …)` once a user delegates
- call `InferenceLedger.charge(user, provider, amount, requestId)` after each inference

It must hold a small amount of mainnet OG (~1–2 OG) to pay gas.

## ABIs

JSON ABIs live in [`src/contracts/`](../src/contracts/) for the React app to
import directly via `viem` / `wagmi` / `ethers`.

## Compiler settings

```
solc:    0.8.24+commit.e11b9ed9
evm:     cancun
optimizer: enabled, 200 runs
```

## Files

- [`Tonara.sol`](./Tonara.sol)
- [`MemoryRegistry.sol`](./MemoryRegistry.sol)
- [`InferenceLedger.sol`](./InferenceLedger.sol)
- [`AgentRegistry.sol`](./AgentRegistry.sol)
