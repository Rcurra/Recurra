# Recurra

**Chain-agnostic recurring payment protocol. Fund once. Approve once. Pay forever.**

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

The user experience is indistinguishable from a Web2 subscription. The settlement is fully on-chain.

---

## How It Works

```
User (Browser)
│
├─ 1. Logs in with email via Magic → gets an EOA address
├─ 2. EIP-7702 upgrades the EOA to a smart account (same address)
├─ 3. Picks a subscription plan
├─ 4. Signs once → ZeroDev issues a session key scoped to the vault + merchant
└─ 5. Particle UA reads unified balance across all chains
                          │
                          ▼
                   Backend (Rust)
                          │
          ┌───────────────┼───────────────┐
          │               │               │
       REST API       Scheduler      Openfort TEE
   (create/cancel   (polls for due   (signs + submits
    subscriptions)   subscriptions)   tx server-side)
                          │
                          ▼
               Arbitrum Smart Contracts
                          │
          ┌───────────────┼───────────────┐
          │               │               │
  PaymentExecutor  SubscriptionRegistry  SubscriptionVault
  (verifies session  (stores plans +     (holds funds in
   key, debits vault) tracks due dates)   escrow)
```

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

**REST API** — handles subscription lifecycle from the frontend: create, cancel, fetch history.

**Scheduler** — a `tokio` interval loop that wakes up on a configurable cadence, queries the registry for overdue subscriptions, and fires each payment through Openfort. No user interaction required.

**Openfort integration** — the scheduler delegates all transaction signing to Openfort's TEE wallet API. The backend constructs the calldata and Openfort signs it inside a hardware-secured enclave. The private key never exists in the backend's memory.

### Frontend (Next.js)

A minimal consumer-facing interface built around three flows:

- **Login** — Magic email link, no wallet install required
- **Subscribe** — plan selection → single ZeroDev session key signature → done
- **Dashboard** — active subscriptions, next payment date, cancel

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Login | [Magic](https://magic.link) | Email/social login, generates EOA, no seed phrase |
| Smart account | [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) | Upgrades existing EOA to smart account, same address |
| Session keys | [ZeroDev](https://zerodev.app) | Scoped backend permissions — one user signature covers all future payments |
| Cross-chain balance | [Particle Network](https://particle.network) | Universal Accounts unify balances across chains |
| Tx signing | [Openfort](https://openfort.xyz) | TEE backend wallets — private key never in plaintext |
| Chain | [Arbitrum](https://arbitrum.io) | EVM L2, 10–100x cheaper gas than Ethereum mainnet |
| Contracts | Solidity 0.8.24 + Foundry | Fast compilation, built-in fuzz testing, scripted deploys |
| Backend | Rust (Axum 0.8 + Tokio) | Async HTTP server + concurrent scheduler |
| Frontend | Next.js 16 + TypeScript + Tailwind | App Router, server components by default |

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
│   │   ├── SubscriptionRegistry.t.sol
│   │   ├── SubscriptionVault.t.sol
│   │   └── PaymentExecutor.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
├── backend/
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── errors.rs
│   │   ├── models/
│   │   ├── api/
│   │   │   └── subscriptions.rs
│   │   ├── scheduler/
│   │   └── openfort/
│   └── Cargo.toml
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx
        │   └── dashboard/page.tsx
        ├── features/
        │   ├── auth/
        │   └── subscriptions/
        ├── lib/
        │   ├── magic.ts
        │   ├── particle.ts
        │   └── zerodev.ts
        ├── services/
        │   └── api.ts
        ├── hooks/
        └── types/
```

---

## Hackathon

Built for the **UXmaxx Hackathon** by [Encode Club](https://www.encode.club) (June – August 2026), hosted by the 7702 Collective: Particle Network, Arbitrum, Magic, ZeroDev, and Openfort.

Track: Universal Accounts · Sponsors are the judges.
