// Magic — email-OTP login → EOA. The ONLY file that may import magic-sdk.
// Also owns session persistence (localStorage) so nothing outside this file
// needs to know how a session is stored, in either mode below.
//
// Two paths, chosen by NEXT_PUBLIC_DEV_WALLET:
// - dev-wallet ('1'): signs with a local anvil key, no Magic quota spent.
//   loginWithEmail ignores the email entirely.
// - real Magic: email-OTP via Magic's own hosted UI (magic.auth.loginWithEmailOTP),
//   wrapped as an EIP-1193 provider → viem WalletClient. Lazy: the Magic
//   client is only constructed on this path, so the placeholder
//   NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY never gets touched while dev mode is on.
//
// EIP-7702 signing (F4) is core magic-sdk (`magic.wallet.sign7702Authorization`
// / `send7702Transaction`) — NOT something @magic-ext/evm provides. That
// extension only adds multi-chain switching (`magic.evm.switchChain`), which
// this single-network app doesn't need, so it stays uninstalled-from-code
// (installed in package.json, per the original F1 scope note, but unused).

import { Magic } from 'magic-sdk';
import { createWalletClient, custom, http, type EIP1193Provider, type WalletClient } from 'viem';
import { privateKeyToAccount, type LocalAccount } from 'viem/accounts';
import { getChain } from './chain';

const STORAGE_KEY = 'recurra_address';
const isDevWallet = process.env.NEXT_PUBLIC_DEV_WALLET === '1';

let walletClient: WalletClient | null = null;
let magicInstance: Magic | null = null;

// Constructed lazily — only on the real-Magic path, on first use — so the
// placeholder NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY never gets touched while
// NEXT_PUBLIC_DEV_WALLET=1.
function getMagic(): Magic {
  if (!magicInstance) {
    const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
    if (!key || key === 'pk_live_...') {
      throw new Error('NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY is not set — add a real key or set NEXT_PUBLIC_DEV_WALLET=1');
    }
    const chain = getChain();
    magicInstance = new Magic(key, {
      network: { rpcUrl: chain.rpcUrls.default.http[0], chainId: chain.id },
    });
  }
  return magicInstance;
}

async function loginDev(): Promise<string> {
  const key = process.env.NEXT_PUBLIC_DEV_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) {
    throw new Error('NEXT_PUBLIC_DEV_PRIVATE_KEY is not set — see .env.local.example');
  }
  const account = privateKeyToAccount(key);
  walletClient = createWalletClient({ account, chain: getChain(), transport: http() });
  localStorage.setItem(STORAGE_KEY, account.address);
  return account.address;
}

// The EOA address lives at wallets.ethereum.publicAddress in this SDK
// version, not top-level (verified against the installed types — an
// earlier version of this file assumed a flat `publicAddress`, which
// doesn't typecheck against what's actually installed).
async function getMagicAddress(magic: Magic): Promise<string | null> {
  const { wallets } = await magic.user.getInfo();
  return wallets.ethereum?.publicAddress ?? null;
}

async function loginMagic(email: string): Promise<string> {
  const magic = getMagic();
  await magic.auth.loginWithEmailOTP({ email }); // Magic's own hosted UI handles the OTP code
  walletClient = createWalletClient({ chain: getChain(), transport: custom(magic.rpcProvider) });
  const address = await getMagicAddress(magic);
  if (!address) throw new Error('Magic login succeeded but returned no address');
  localStorage.setItem(STORAGE_KEY, address);
  return address;
}

export async function loginWithEmail(email: string): Promise<string> {
  return isDevWallet ? loginDev() : loginMagic(email);
}

export async function restoreSession(): Promise<string | null> {
  if (isDevWallet) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const key = process.env.NEXT_PUBLIC_DEV_PRIVATE_KEY as `0x${string}` | undefined;
    if (key) {
      const account = privateKeyToAccount(key);
      walletClient = createWalletClient({ account, chain: getChain(), transport: http() });
    }
    return stored;
  }

  const magic = getMagic();
  const loggedIn = await magic.user.isLoggedIn();
  if (!loggedIn) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  walletClient = createWalletClient({ chain: getChain(), transport: custom(magic.rpcProvider) });
  const address = await getMagicAddress(magic);
  if (address) localStorage.setItem(STORAGE_KEY, address);
  return address;
}

export async function logout(): Promise<void> {
  if (!isDevWallet) {
    await getMagic().user.logout();
  }
  walletClient = null;
  localStorage.removeItem(STORAGE_KEY);
}

// Unused until F3's signer abstraction / F4's Kernel account, but part of
// F1's checklist item ("EIP-1193 provider → viem WalletClient") — avoids a
// second pass through this file to add it later.
export function getWalletClient(): WalletClient | null {
  return walletClient;
}

// lib/wallet.ts's per-call `account` override — an address alone is enough
// for real-Magic mode (its WalletClient's custom(magic.rpcProvider)
// transport genuinely implements eth_sendTransaction, asking Magic's
// provider to sign), but dev-wallet mode needs the actual LocalAccount
// object here, not just its address. viem only signs a transaction locally
// (then broadcasts via eth_sendRawTransaction) when the `account` it's
// given carries real signing capability; hand it a bare address instead
// and viem assumes a JSON-RPC account and asks the transport's node itself
// to sign via eth_sendTransaction — which anvil happens to support for its
// own well-known unlocked accounts, but no real node (Sepolia included)
// does. Found live 2026-07-14: every dev-wallet write except F4's
// subscribeAndFund (which signs client-side regardless) broke the moment
// dev-wallet mode pointed at a real chain, with exactly that error.
export function getWriteAccount(address: string): LocalAccount | `0x${string}` {
  if (isDevWallet) {
    const key = process.env.NEXT_PUBLIC_DEV_PRIVATE_KEY as `0x${string}` | undefined;
    if (key) return privateKeyToAccount(key);
  }
  return address as `0x${string}`;
}

// F4 — the raw signer lib/zerodev.ts builds the Kernel account from. Typed
// with plain viem primitives (not @zerodev/sdk's `Signer` union) so this
// file never has to import a ZeroDev package — that stays lib/zerodev.ts's
// job alone (CONCEPT.md's module boundary). Both members of this union ARE
// valid ZeroDev signers; the caller just doesn't need to know that.
//
// Real-Magic mode hands back the raw EIP-1193 provider rather than the
// WalletClient above — that WalletClient is deliberately built without an
// `account` (see the header comment), which a signer consumer expecting a
// self-contained signer would choke on. The provider has no such gap.
export type RecurraSigner = LocalAccount | EIP1193Provider;

export function getSigner(): RecurraSigner | null {
  if (isDevWallet) {
    const key = process.env.NEXT_PUBLIC_DEV_PRIVATE_KEY as `0x${string}` | undefined;
    return key ? privateKeyToAccount(key) : null;
  }
  return magicInstance?.rpcProvider ?? null;
}

// F4 — the one Magic-specific call this file makes on the account-
// abstraction path. `magic.wallet.sign7702Authorization` is a bespoke SDK
// method, not a standard EIP-1193 RPC call reachable through the generic
// provider above, so lib/zerodev.ts can't get this for free from `getSigner()`
// — it has to ask for it explicitly, through here, to keep every
// Magic-specific call inside this one file.
//
// Maps Magic's response onto viem's `SignedAuthorization` field names
// (`contractAddress` → `address`) so the caller only ever sees generic
// viem shapes. Dev-wallet mode doesn't need this — a `LocalAccount` signs
// its own EIP-7702 authorization natively through the generic
// `RecurraSigner` path, which is why this throws instead of branching:
// being called in dev mode is a caller bug, not a valid path.
//
// Returns `yParity`, NOT `v` — found live 2026-07-15: passing Magic's `v`
// straight through as a bigint produced a garbled, wildly-oversized
// yParity in the actual wire request (verified by reading the raw
// eth_sendUserOperation payload the bundler rejected), and ZeroDev
// rejected the whole UserOp with "the recovered signer address does not
// match" — a corrupted signature, not a business error. EIP-7702
// authorizations are fundamentally yParity-based (0/1), not legacy-v
// (27/28) — Magic's SDK, built specifically for 7702, almost certainly
// already returns the correct yParity in its `v` field; something
// downstream was evidently applying a legacy `v - 27` style offset to an
// already-correct value. Normalizing explicitly here, to a plain 0/1,
// sidesteps that ambiguity regardless of which convention Magic's `v`
// numeric value actually follows.
//
// chainId is always the real chain, never 0 ("universal" cross-chain) —
// Arbitrum's 7702 delegation slot belongs to ZeroDev's Kernel specifically,
// not shared across chains (see CONCEPT.md's delegation-collision note).
export async function sign7702Authorization(params: { contractAddress: `0x${string}`; chainId: number }): Promise<{
  address: `0x${string}`;
  chainId: number;
  nonce: number;
  r: `0x${string}`;
  s: `0x${string}`;
  yParity: number;
}> {
  if (isDevWallet) {
    throw new Error('sign7702Authorization is Magic-only — dev-wallet mode signs its own authorization');
  }
  const auth = await getMagic().wallet.sign7702Authorization(params);
  // Normalizes either convention to a clean 0/1: legacy v (27/28) offsets
  // by 27; anything already 0/1 passes through untouched.
  const yParity = auth.v === 27 || auth.v === 0 ? 0 : 1;
  return {
    address: auth.contractAddress as `0x${string}`,
    chainId: auth.chainId,
    nonce: auth.nonce,
    r: auth.r as `0x${string}`,
    s: auth.s as `0x${string}`,
    yParity,
  };
}
