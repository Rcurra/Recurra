// Particle Universal Accounts — the cross-chain fund step. The ONLY file
// that may import @particle-network/universal-account-sdk.
//
// F6, per CONCEPT.md's confirmed strategy: UA SDK in EIP-7702 mode
// (useEIP7702: true — track requirement, the 4337 escape hatch does NOT
// satisfy it), delegated on SOURCE chains only (Base/Polygon, wherever the
// user's other-chain funds actually sit). Arbitrum's 7702 slot belongs to
// ZeroDev Kernel and is never touched here — confirmed by Particle
// (2026-07-08, Discord): source-chain delegation alone is sufficient,
// funds are then spendable to any supported chain. The cross-chain op is
// this file's whole job: read the unified balance, then route the user's
// other-chain USDC to their own address on Arbitrum, where the existing
// Kernel deposit flow (lib/zerodev.ts) picks it up from there — Particle
// never touches the vault or the session key.
//
// Mainnet-only (no testnet anywhere in Particle's UA stack, confirmed by
// Particle 2026-07-08) — feature-flagged via PARTICLE_ENABLED, default
// deposit path must work with this entirely absent.
//
// The real API here is verified against Particle's own working demo
// (github.com/Particle-Network/universal-accounts-7702) and this
// package's shipped .d.ts, not just the docs site — the docs' own
// reference pages don't show a complete working example end to end.

// Must load before the SDK import below — @coral-xyz/anchor (Particle's
// Solana dependency) runs `new Program(...)` as a side effect of merely
// being imported, referencing Node's ambient Buffer/process globals.
// Scoped here, not the root layout: this shim should only ever run for
// the one feature that needs it, not on every page load.
import './polyfills';

import { serializeSignature } from 'viem';
import {
  CHAIN_ID,
  UNIVERSAL_ACCOUNT_VERSION,
  UniversalAccount,
  type EIP7702Authorization,
} from '@particle-network/universal-account-sdk';
import { getSigner, sign7702Authorization } from './magic';

export const PARTICLE_ENABLED = process.env.NEXT_PUBLIC_PARTICLE_ENABLED === '1';

// Circle's canonical native USDC on Arbitrum One
// (arbiscan.io/token/0xaf88d065e77c8cC2239327C5EDb3A432268e5831) —
// deliberately NOT lib/contracts.ts's MockUSDC address; Particle's whole
// stack is mainnet-only, so this constant is too.
const ARBITRUM_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

function getParticleConfig(): { projectId: string; projectClientKey: string; projectAppUuid: string } {
  const projectId = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID;
  const projectClientKey = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY;
  const projectAppUuid = process.env.NEXT_PUBLIC_PARTICLE_APP_ID;
  if (!projectId || !projectClientKey || !projectAppUuid) {
    throw new Error(
      'Particle is enabled but NEXT_PUBLIC_PARTICLE_PROJECT_ID/CLIENT_KEY/APP_ID are not set — get real values from the Particle dashboard',
    );
  }
  return { projectId, projectClientKey, projectAppUuid };
}

function buildUniversalAccount(ownerAddress: string): UniversalAccount {
  const { projectId, projectClientKey, projectAppUuid } = getParticleConfig();
  return new UniversalAccount({
    projectId,
    projectClientKey,
    projectAppUuid,
    smartAccountOptions: {
      name: 'UNIVERSAL',
      version: UNIVERSAL_ACCOUNT_VERSION,
      ownerAddress,
      useEIP7702: true,
    },
  });
}

// Signs a UA transaction's rootHash with the account's own owner key — a
// plain personal-message signature over raw bytes (EIP-191, same scheme
// personal_sign uses), entirely outside Particle's SDK; it only builds and
// submits transactions, never touches key material. Branches on
// RecurraSigner the same shape lib/zerodev.ts's eip7702Account param does,
// but has to do it explicitly here since Particle's API wants a raw
// signature string back, not a viem account object to hand off to another
// SDK.
async function signRootHash(ownerAddress: string, rootHash: `0x${string}`): Promise<`0x${string}`> {
  const signer = getSigner();
  if (!signer) throw new Error('Not logged in — no signer available');
  if ('signMessage' in signer) {
    // LocalAccount (dev-wallet mode).
    return signer.signMessage({ message: { raw: rootHash } });
  }
  // EIP1193Provider (real-Magic mode) — rootHash is already 0x-hex, the
  // standard personal_sign shape (raw bytes, not UTF8 text to re-encode).
  const signature = await signer.request({
    method: 'personal_sign',
    params: [rootHash, ownerAddress as `0x${string}`],
  });
  return signature as `0x${string}`;
}

export async function getUnifiedBalance(ownerAddress: string): Promise<{ totalUsd: number }> {
  const ua = buildUniversalAccount(ownerAddress);
  const assets = await ua.getPrimaryAssets();
  return { totalUsd: assets.totalAmountInUSD };
}

// Routes the user's own other-chain USDC to their own address on Arbitrum
// — same owner, same address, different chain (the whole point of 7702's
// "same address, new powers" trick). `amount` is USDC's 6-decimal bigint,
// same convention as everywhere else in the app; converted to the plain
// decimal string Particle's API wants only at this call boundary.
export async function routeToArbitrum(ownerAddress: string, amount: bigint): Promise<{ transactionId: string }> {
  const ua = buildUniversalAccount(ownerAddress);

  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, '0');
  const amountDecimal = `${whole}.${fraction}`;

  // The quote call is where balance/fee rejections land (found live
  // 2026-07-18: "Insufficient primary token balance", Particle's -32653 —
  // same code the UXmaxx Discord thread reports). UniversalError carries a
  // numeric .code and a .data payload the one-line message hides; log the
  // whole object before rethrowing so a quote rejection is debuggable.
  let transaction;
  try {
    transaction = await ua.createTransferTransaction({
      token: { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: ARBITRUM_USDC },
      amount: amountDecimal,
      receiver: ownerAddress,
    });
  } catch (e) {
    console.error('routeToArbitrum: createTransferTransaction (quote) rejected', e);
    throw e;
  }

  // The first transaction on a source chain this owner hasn't delegated
  // on yet needs a signed EIP-7702 authorization per userOp that requires
  // one. Two paths, matching lib/zerodev.ts's own eip7702Auth fork exactly
  // (found live while reviewing this before ever touching mainnet — the
  // original version always called sign7702Authorization below, which
  // throws outright in dev-wallet mode ("Magic-only")):
  //   - LocalAccount (dev-wallet): signs its own authorization natively
  //     via viem's signAuthorization, which — unlike the Magic path below —
  //     accepts an explicit nonce, so it can use auth.nonce exactly as
  //     Particle's userOp specifies it.
  //   - EIP1193Provider (real-Magic): sign7702Authorization, the same
  //     primitive F4's Kernel path already uses for Arbitrum, just pointed
  //     at whichever source chain Particle says needs it here.
  // Cached by nonce so a batch touching the same chain twice signs it
  // once, mirroring Particle's own reference implementation.
  //
  // UNVERIFIED, flagged for the first real test on the Magic path only:
  // Particle's own demo passes userOp.eip7702Auth.nonce straight through
  // to the signer, but Magic's sign7702Authorization doesn't take an
  // explicit nonce override today — it derives its own from the account's
  // current on-chain nonce. For this owner's first-ever authorization on
  // a given source chain both should land on the same value, but this has
  // never been exercised against a real account. Check this first the
  // moment real Particle credentials + a funded source-chain wallet exist.
  const signer = getSigner();
  if (!signer) throw new Error('Not logged in — no signer available');
  const signedByNonce = new Map<number, string>();
  const authorizations: EIP7702Authorization[] = [];
  for (const op of transaction.userOps) {
    const auth = op.eip7702Auth;
    if (!auth || op.eip7702Delegated) continue;
    let signature = signedByNonce.get(auth.nonce);
    if (!signature) {
      let signed: { r: `0x${string}`; s: `0x${string}`; yParity: number };
      if ('signAuthorization' in signer && signer.signAuthorization) {
        const local = await signer.signAuthorization({
          address: auth.address as `0x${string}`,
          chainId: auth.chainId,
          nonce: auth.nonce,
        });
        // yParity is always populated in practice (viem's own local signer
        // sets it directly), but the type only guarantees v-or-yParity —
        // never trust that ambiguity blindly, it's the exact bug that cost
        // hours on the Kernel path (see sign7702Authorization's history).
        const yParity = local.yParity ?? (local.v === 27n || local.v === 0n ? 0 : 1);
        signed = { r: local.r, s: local.s, yParity };
      } else {
        signed = await sign7702Authorization({
          contractAddress: auth.address as `0x${string}`,
          chainId: auth.chainId,
        });
      }
      signature = serializeSignature(signed);
      signedByNonce.set(auth.nonce, signature);
      // Diagnostic-only: the exact nonce this authorization was signed
      // for — the one thing to check first if sendTransaction below
      // rejects it. Not proven correct yet, only "should be," per the
      // comment above.
      console.info('routeToArbitrum: signed EIP-7702 authorization', {
        chainId: auth.chainId,
        address: auth.address,
        nonce: auth.nonce,
      });
    }
    authorizations.push({ userOpHash: op.userOpHash, signature });
  }

  const rootHashSignature = await signRootHash(ownerAddress, transaction.rootHash as `0x${string}`);
  try {
    const result = await ua.sendTransaction(transaction, rootHashSignature, authorizations);
    return { transactionId: result?.transactionId ?? '' };
  } catch (e) {
    // Same discipline as lib/zerodev.ts's subscribeAndFund: a rejection
    // here is too generic to fix blind. Particle's UniversalError carries
    // a numeric .code and optional .data the bare .message can hide — log
    // the whole thing before rethrowing unchanged so walletErrorMessage
    // still handles the user-facing side.
    console.error('routeToArbitrum: sendTransaction rejected', e);
    throw e;
  }
}
