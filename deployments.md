# Recurra — Deployments

Single source of truth for on-chain addresses (per CONCEPT.md M3). Env files
point here; nothing hardcoded in either the backend or frontend codebase.

## Arbitrum Sepolia (testnet)

- **Chain ID:** `421614`
- **RPC (public, keyless):** `https://arbitrum-sepolia-rpc.publicnode.com`
- **Deployed:** 2026-07-14, via `contracts/script/Deploy.s.sol`
- **Deploy block (safe start for event scans):** `287458272`
- **Deployer / initial `authorizedExecutor`:** `0x3d582d907c8d73764b261c25c1D7C317Eaaee034`
  (a plain testnet EOA for now — rotate to the real Openfort TEE wallet via
  `PaymentExecutor.setAuthorizedExecutor` once that's provisioned; no redeploy needed)

| Contract              | Address                                     | Deploy block | Deploy tx                                                           |
| ---------------------- | -------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| `SubscriptionRegistry` | `0x33C7E0D2d9da4eF91de1C99Cfd33692e640DfD0E` | 287458272    | `0x3eae8b9b2982fb739759cd5db071e5869016282adf2673536c0150dbd18537d4` |
| `SubscriptionVault`    | `0xD34EcB5E7e434b3bf3a2cf351D2266D038aC22Ad` | 287458277    | `0x2e3084fe11f352e7fecfa6aed271759dab58d94b1cd35e01f996348f622627f2` |
| `PaymentExecutor`      | `0x4143E9ACbb4ba2DF5eD64963B379D63D51Adc1eA` | 287458282    | `0x6837b48d8ac649e5fbaae542fae4c712c9eb79ff136392f2d5149856b8645c67` |
| `MockUSDC`             | `0x4064ACe8078595f629c53BfF1e914cA64eE0F9cD` | 287458302    | `0xb5493b29809f61112f7d5f5f61b93bd77cb04ca8bd814cb2483f7f8f1b399d4e` |

`MockUSDC` is testnet-only, 6 decimals (matches real USDC) — real USDC's
Arbitrum address takes its place on any future mainnet deploy.

All four contracts verified on Arbiscan (source, ABI, and constructor args public):

- Registry: https://sepolia.arbiscan.io/address/0x33c7e0d2d9da4ef91de1c99cfd33692e640dfd0e
- Vault: https://sepolia.arbiscan.io/address/0xd34ecb5e7e434b3bf3a2cf351d2266d038ac22ad
- Executor: https://sepolia.arbiscan.io/address/0x4143e9acbb4ba2df5ed64963b379d63d51adc1ea
- MockUSDC: https://sepolia.arbiscan.io/address/0x4064ace8078595f629c53bff1e914ca64ee0f9cd

## ABI paths

Foundry output, post-`forge build`, relative to `contracts/`:

- `out/SubscriptionRegistry.sol/SubscriptionRegistry.json`
- `out/SubscriptionVault.sol/SubscriptionVault.json`
- `out/PaymentExecutor.sol/PaymentExecutor.json`
- `out/MockUSDC.sol/MockUSDC.json` (script/MockUSDC.sol)

## Env wiring (not yet switched over — anvil is still the local dev target)

Backend (`backend/.env`):

```
ARBITRUM_RPC=https://arbitrum-sepolia-rpc.publicnode.com
SUBSCRIPTION_REGISTRY_ADDRESS=0x33C7E0D2d9da4eF91de1C99Cfd33692e640DfD0E
SUBSCRIPTION_VAULT_ADDRESS=0xD34EcB5E7e434b3bf3a2cf351D2266D038aC22Ad
EXECUTOR_ADDRESS=0x4143E9ACbb4ba2DF5eD64963B379D63D51Adc1eA
```

Frontend (`frontend/.env.local`):

```
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_USDC_ADDRESS=0x4064ACe8078595f629c53BfF1e914cA64eE0F9cD
NEXT_PUBLIC_REGISTRY_ADDRESS=0x33C7E0D2d9da4eF91de1C99Cfd33692e640DfD0E
NEXT_PUBLIC_VAULT_ADDRESS=0xD34EcB5E7e434b3bf3a2cf351D2266D038aC22Ad
```

Swapping to these is a deliberate cutover (loses the current anvil dev state,
and the backend's real Openfort signer needs to be live first — `LOCAL_SIGNER_PRIVATE_KEY`
can't reach a public testnet's `authorizedExecutor` safely for a real demo)
— not done as part of this deploy.

## Security ops (from the 2026-07-17 audit — dashboard/key work, not code)

**Paymaster quota is a public attack surface (M-2).** The ZeroDev project ID
ships in the client bundle by design (`NEXT_PUBLIC_ZERODEV_RPC`), so anyone
can build their own Kernel account against our bundler/paymaster and burn
sponsored gas — including free USDC transfers, since the app's own Send
requires sponsoring calls to the USDC contract. Mitigation lives in the
ZeroDev dashboard, not code: set gas policies (contract allowlist =
Registry + Vault + USDC, per-account rate limits, project spend cap), and
treat quota exhaustion during the demo window as an expected failure mode —
sponsored writes degrade, reads and the scheduler don't.

**One EOA currently holds every privileged role (M-4).** The deployer key
`0x3d58...e034` is owner of all three contracts (so it controls
`setAuthorizedExecutor` and the one-time `setExecutor` wiring) *and* is the
`authorizedExecutor` itself. Compromise of that single key = executor
rotation + firing any due payment (bounded by design, but perpetual
griefing). Before demo day:

1. Rotate `authorizedExecutor` to the Openfort TEE wallet via
   `PaymentExecutor.setAuthorizedExecutor` (already planned above — no
   redeploy needed).
2. Move contract ownership to a separate key that never touches a server.
   Future deploys get `Ownable2Step` (two-step transfer, fat-finger-proof);
   the live Sepolia contracts predate it, so transfer carefully there.
