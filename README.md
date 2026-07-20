# Recurra

**Chain-agnostic recurring payment protocol. Fund once. Approve once. Pay forever.**

Live demo: [recurra-nine.vercel.app](https://recurra-nine.vercel.app) · Core protocol deployed on Arbitrum Sepolia, cross-chain funding live on Arbitrum One mainnet — see [Deployments](#deployments) below.

---

## The Problem

Recurring payments are a fundamental primitive of the modern economy — subscriptions, DAO memberships, creator tips, SaaS billing. On-chain, they don't exist in any usable form.

Every attempt breaks down for the same reasons:

- **Multi-chain fragmentation** — a user's funds might be on Polygon, but the merchant contract lives on Arbitrum. The user has to bridge manually before they can even start.
- **Wallet fatigue** — every payment cycle requires the user to sign a new transaction. That's fine once. It's untenable as a recurring billing model.
- **No trustless execution** — either the user has to return and manually pay, or the protocol holds their private key (which is not a protocol, it's a custodian).
- **Web3 onboarding friction** — before a user can subscribe to anything, they need a wallet, ETH for gas, and a working understanding of seed phrases. Most people stop here.

The result: recurring payments in Web3 are either custodial hacks or they don't exist.

---

## The Solution

Recurra is a smart contract protocol that makes recurring on-chain subscriptions work the way they should.

A user connects with their email, picks a plan, and signs once. That's it. Every future payment — across any chain, on any schedule — executes automatically without the user ever returning.

Under the hood:

- Their EOA is silently upgraded to a smart account via EIP-7702 — same address, new capabilities.
- A session key is issued to the backend, scoped to a specific merchant, amount cap, and expiry. The user's funds can only be debited within those limits.
- Particle Network's Universal Accounts give the user a single cross-chain balance. Their USDC on Polygon pays a subscription on Arbitrum — no bridging, no manual steps.
- When a payment is due, an Openfort TEE wallet signs and submits the transaction server-side. No private key is ever exposed in plaintext, even on the backend.
- The contracts never trust the backend's word for it: every payment is independently re-verified on-chain before it settles. The backend is a **trigger**, never a **trustee**.

The user experience is indistinguishable from a Web2 subscription. The settlement is fully on-chain.

---

## How It Works

```
User (Browser)
│
├─ 1. Logs in with email via Magic → gets an EOA address
├─ 2. EIP-7702 upgrades the EOA to a smart account (same address)
├─ 3. Picks a subscription plan, signs once
├─ 4. ZeroDev issues a session key scoped to the vault + merchant + amount cap + expiry
│      (subscribe/deposit/withdraw/cancel all execute on-chain from here — gasless, sponsored)
└─ 5. Particle UA reads a unified USDC balance across all chains
                          │
                          ▼
                   Backend (Rust)
                          │
          ┌───────────────┼───────────────┐
          │               │               │
      Read-only API    Scheduler      Openfort TEE
   (subscriptions,   (polls for due   (signs + submits
    plans, payment    payments, sim   payment tx
    history)          via eth_call,    server-side)
                       triages 5 revert
                       reasons)
                          │
                          ▼
               Arbitrum Smart Contracts
                          │
          ┌───────────────┼───────────────┐
          │               │               │
  PaymentExecutor  SubscriptionRegistry  SubscriptionVault
  (verifies session  (stores plans +     (holds funds in
   key, debits vault, tracks due dates)   escrow, deposit/
   independently re-                      withdraw anytime)
   verifies every call)
```

---

## What's Shipped Beyond the MVP

- **Cross-chain funding, live on mainnet.** Particle Universal Accounts (EIP-7702 mode) route a subscriber's USDC from any supported chain directly to their vault on Arbitrum One. Particle's UA stack has no testnet, so this runs against real transactions — including a pre-sign confirmation screen that shows exactly what's being spent, from where, and at what fee before anything is signed (the raw signed payload is otherwise unreadable to the user). The same route doubles as a withdrawal to any address, and every route persists as a receipt linking each chain's real execution transaction.
- **Gasless, end to end.** Every wallet write — subscribe, deposit, withdraw, cancel — is sponsored, not just the initial subscribe.
- **Full activity history.** Payment receipts are sourced from on-chain `PaymentExecuted` events, not assumed state.
- **Security hardening.** `Ownable2Step` on both ownable contract surfaces, the backend's signing key rotated to a dedicated Openfort TEE wallet separate from contract ownership, internal RPC/chain error detail scrubbed from API responses, dev-wallet auth mode hard-refused in production builds, and a non-root, locked-build container deploy.

---

## Architecture

### Smart Contracts (Arbitrum)

Three contracts with a strict separation of concerns:

**`SubscriptionRegistry.sol`**
The source of truth for all subscription state. Stores merchant plans (token, amount, interval) and tracks `nextPaymentDue` per subscriber. The scheduler reads this to know what to execute.

**`SubscriptionVault.sol`**
Holds subscriber funds in escrow. Only `PaymentExecutor` can call `debit()` — no other address, including the backend, can touch the funds directly. Subscribers can deposit and withdraw freely at any time.

**`PaymentExecutor.sol`**
The enforcement layer. When the backend submits a payment, this contract verifies the session key is valid, unexpired, and within its spending limits before touching the vault. If any check fails, the transaction reverts.

### Backend (Rust)

An Axum HTTP server with two responsibilities running concurrently:

**Read-only REST API** — `GET /subscriptions`, `/subscriptions/{id}`, `/plans`, `/plans/{id}`, `/payments`. The backend never creates, cancels, or otherwise writes subscription state — subscribing, depositing, withdrawing, and cancelling all happen as direct on-chain calls from the frontend through the user's smart account. The API exists purely to read that state back for the dashboard.

**Scheduler** — a `tokio` interval loop that wakes up on a configurable cadence, queries the registry for overdue subscriptions, simulates each payment via `eth_call` before submitting, and triages all five of `PaymentExecutor`'s custom revert reasons (skip silently, warn, or abort the batch, depending on which). No user interaction required.

**Openfort integration** — the scheduler delegates all transaction signing to Openfort's TEE wallet API. The backend constructs the calldata and Openfort signs it inside a hardware-secured enclave. The private key never exists in the backend's memory.

### Frontend (Next.js)

The consumer-facing dashboard, built around:

- **Login** — Magic email link, no wallet install required
- **Subscribe / deposit / withdraw / cancel** — all gasless, sponsored through a ZeroDev session key
- **Fund from another chain** — Particle Universal Accounts cross-chain route, with a pre-sign confirmation card and persisted route receipts
- **Activity** — expandable per-charge receipts sourced from the backend's read API

---

## Deployments

Particle's Universal Account stack has no testnet anywhere, so this is a deliberate two-network demo: the core protocol runs on a public testnet (free to exercise repeatedly), and cross-chain funding runs on live mainnet (the only place Particle UA works at all).

### Core protocol — Arbitrum Sepolia (chain id `421614`)

| Contract | Address |
|---|---|
| `SubscriptionRegistry` | [`0x33C7E0D2d9da4eF91de1C99Cfd33692e640DfD0E`](https://sepolia.arbiscan.io/address/0x33c7e0d2d9da4ef91de1c99cfd33692e640dfd0e) |
| `SubscriptionVault` | [`0xD34EcB5E7e434b3bf3a2cf351D2266D038aC22Ad`](https://sepolia.arbiscan.io/address/0xd34ecb5e7e434b3bf3a2cf351d2266d038ac22ad) |
| `PaymentExecutor` | [`0x4143E9ACbb4ba2DF5eD64963B379D63D51Adc1eA`](https://sepolia.arbiscan.io/address/0x4143e9acbb4ba2df5ed64963b379d63d51adc1ea) |
| `MockUSDC` (testnet stand-in, 6 decimals) | [`0x4064ACe8078595f629c53BfF1e914cA64eE0F9cD`](https://sepolia.arbiscan.io/address/0x4064ace8078595f629c53bff1e914ca64ee0f9cd) |

All four contracts are source-verified on Arbiscan. Full deploy blocks and transaction hashes live in [`deployments.md`](./deployments.md).

### Cross-chain funding — Arbitrum One (mainnet)

Runs against Circle's canonical native USDC on Arbitrum One — real chains, real funds, no simulation.

### Hosting

Backend runs as a long-lived Fly.io Machine (`backend/fly.toml`) so the scheduler keeps polling on its own schedule, not just while a request is in flight. Frontend is deployed on Vercel.

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Login | [Magic](https://magic.link) | Email/social login, generates EOA, no seed phrase |
| Smart account | [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) | Upgrades existing EOA to smart account, same address |
| Session keys + gas sponsorship | [ZeroDev](https://zerodev.app) | Scoped backend permissions and gasless sponsorship for every wallet write |
| Cross-chain balance + funding | [Particle Network](https://particle.network) | Universal Accounts unify balances across chains and route funds to Arbitrum One |
| Tx signing | [Openfort](https://openfort.xyz) | TEE backend wallets — private key never in plaintext |
| Chain | [Arbitrum](https://arbitrum.io) | Sepolia (core protocol) + One mainnet (cross-chain funding) |
| Contracts | Solidity + Foundry | Fuzz-tested, scripted deploys, Arbiscan-verified |
| Backend | Rust (Axum + Tokio) | Async read API + concurrent scheduler, deployed on Fly.io |
| Frontend | Next.js + TypeScript + Tailwind | App Router, deployed on Vercel |

---

## Repository Structure

```
Recurra/
├── contracts/
│   ├── src/
│   │   ├── SubscriptionRegistry.sol
│   │   ├── SubscriptionVault.sol
│   │   └── PaymentExecutor.sol
│   ├── test/
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
├── backend/
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── errors.rs
│   │   ├── sender.rs
│   │   ├── models/
│   │   ├── api/
│   │   │   ├── subscriptions.rs
│   │   │   └── payments.rs
│   │   ├── chain/          # on-chain reads, event scans, contract bindings
│   │   ├── scheduler/      # due-payment polling + simulate-then-submit loop
│   │   └── openfort/       # TEE signer integration
│   ├── fly.toml
│   └── Cargo.toml
├── deployments.md          # single source of truth for on-chain addresses
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx
        │   └── dashboard/
        ├── features/
        │   ├── auth/
        │   ├── subscriptions/
        │   ├── vault/       # deposit/withdraw + Particle cross-chain funding UI
        │   └── wallet/
        ├── components/
        ├── lib/
        │   ├── magic.ts
        │   ├── particle.ts
        │   └── zerodev.ts
        ├── services/
        ├── hooks/
        └── types/
```

---

## Hackathon

Built for the **UXmaxx Hackathon** by [Encode Club](https://www.encode.club), hosted by the 7702 Collective: Particle Network, Arbitrum, Magic, ZeroDev, and Openfort.

Track: Universal Accounts · Sponsors are the judges.
