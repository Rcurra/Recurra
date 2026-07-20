// Magic — email-OTP login → EOA. The ONLY file that may import magic-sdk.
// Also owns session persistence (localStorage) so nothing outside this file
// needs to know how a session is stored, in either mode below.
//
// Two paths, chosen by NEXT_PUBLIC_DEV_WALLET:
// - dev-wallet ('1'): signs with a local anvil key, no Magic quota spent.
//   loginWithEmail ignores the email for auth (always the same fixed key) —
//   it's only kept as a display label, so a tester juggling several "test
//   accounts" in dev mode has something to tell them apart by.
// - real Magic: email-OTP via Magic's own hosted UI (magic.auth.loginWithEmailOTP),
//   wrapped as an EIP-1193 provider → viem WalletClient. Lazy: the Magic
//   client is only constructed on this path, so the placeholder
//   NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY never gets touched while dev mode is on.
//
// EIP-7702 signing (F4) is core magic-sdk (`magic.wallet.sign7702Authorization`
// / `send7702Transaction`) — NOT something @magic-ext/evm provides. That
// extension adds multi-chain switching (`magic.evm.switchChain`), which F6
// made load-bearing: Magic signs 7702 authorizations against its CONNECTED
// chain and errors (-32603 "Error signing", found live 2026-07-19) when
// asked to sign for a chain it isn't on — so Particle's source/destination
// mainnet auths (Base, Arbitrum One) each need a switch-sign-switch-back
// dance, the exact pattern Particle's own Magic demo
// (Particle-Network/ua-7702-magic-demo) uses.

import { EVMExtension } from '@magic-ext/evm';
import { Magic } from 'magic-sdk';
import { createWalletClient, custom, http, type EIP1193Provider, type WalletClient } from 'viem';
import { privateKeyToAccount, type LocalAccount } from 'viem/accounts';
import { getChain } from './chain';

const STORAGE_KEY = 'recurra_address';
// Display-only — never used for auth decisions, Magic's own session is the
// source of truth for that. Lets Settings/the login screen show WHICH
// account is active instead of a cryptic truncated address, the real ask
// behind "I've used more than one email testing and can't tell them apart."
const STORAGE_KEY_EMAIL = 'recurra_email';
const isDevWallet = process.env.NEXT_PUBLIC_DEV_WALLET === '1';
// Dev-wallet mode signs EVERYONE in with the same well-known anvil key —
// fine on a laptop, catastrophic in a deployed build (every visitor would
// share one wallet, and its funds). A production build refuses the flag at
// module load rather than quietly falling back to Magic: NEXT_PUBLIC_* is
// inlined at build time, so this makes `next build` itself fail loudly on
// the misconfiguration instead of shipping it.
if (isDevWallet && process.env.NODE_ENV === 'production') {
  throw new Error(
    'NEXT_PUBLIC_DEV_WALLET=1 in a production build — the shared dev key must never ship. Unset it and rebuild.',
  );
}

export type Session = { address: string; email: string | null };

let walletClient: WalletClient | null = null;
let magicInstance: MagicClient | null = null;

// Constructed lazily — only on the real-Magic path, on first use — so the
// placeholder NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY never gets touched while
// NEXT_PUBLIC_DEV_WALLET=1.
function buildMagic(key: string) {
  const chain = getChain();
  return new Magic(key, {
    network: { rpcUrl: chain.rpcUrls.default.http[0], chainId: chain.id },
    // Every chain sign7702Authorization may switchChain to: the app chain
    // (default — everything except UA auth signing stays here) plus the
    // mainnet chains Particle UA quotes span today (source Base,
    // destination Arbitrum One). switchChain refuses chains not listed, so
    // extend this list if the UA's funds ever sit on ETH/BSC/XLayer.
    extensions: [
      new EVMExtension([
        { rpcUrl: chain.rpcUrls.default.http[0], chainId: chain.id, default: true },
        { rpcUrl: 'https://mainnet.base.org', chainId: 8453 },
        { rpcUrl: 'https://arb1.arbitrum.io/rpc', chainId: 42161 },
      ]),
    ],
  });
}
type MagicClient = ReturnType<typeof buildMagic>;

function getMagic(): MagicClient {
  if (!magicInstance) {
    const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
    if (!key || key === 'pk_live_...') {
      throw new Error('NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY is not set — add a real key or set NEXT_PUBLIC_DEV_WALLET=1');
    }
    magicInstance = buildMagic(key);
  }
  return magicInstance;
}

// Dev mode's account is always the same fixed anvil key regardless of what's
// typed — but the email typed at login is still worth remembering as a
// label, purely so a tester juggling several "accounts" in dev mode has
// something on screen to tell them apart by. Never affects which key signs.
async function loginDev(email: string): Promise<Session> {
  const key = process.env.NEXT_PUBLIC_DEV_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) {
    throw new Error('NEXT_PUBLIC_DEV_PRIVATE_KEY is not set — see .env.local.example');
  }
  const account = privateKeyToAccount(key);
  walletClient = createWalletClient({ account, chain: getChain(), transport: http() });
  localStorage.setItem(STORAGE_KEY, account.address);
  localStorage.setItem(STORAGE_KEY_EMAIL, email);
  return { address: account.address, email };
}

// The EOA address lives at wallets.ethereum.publicAddress in this SDK
// version, not top-level (verified against the installed types — an
// earlier version of this file assumed a flat `publicAddress`, which
// doesn't typecheck against what's actually installed). `email` comes from
// the same call — Magic's own verified record, not whatever was typed into
// the form, so it's trustworthy to display even on session restore.
async function getMagicSession(magic: MagicClient): Promise<Session | null> {
  const { email, wallets } = await magic.user.getInfo();
  const address = wallets.ethereum?.publicAddress;
  return address ? { address, email: email ?? null } : null;
}

async function loginMagic(email: string): Promise<Session> {
  const magic = getMagic();
  await magic.auth.loginWithEmailOTP({ email }); // Magic's own hosted UI handles the OTP code
  walletClient = createWalletClient({ chain: getChain(), transport: custom(magic.rpcProvider) });
  const session = await getMagicSession(magic);
  if (!session) throw new Error('Magic login succeeded but returned no address');
  localStorage.setItem(STORAGE_KEY, session.address);
  if (session.email) localStorage.setItem(STORAGE_KEY_EMAIL, session.email);
  return session;
}

export async function loginWithEmail(email: string): Promise<Session> {
  return isDevWallet ? loginDev(email) : loginMagic(email);
}

export async function restoreSession(): Promise<Session | null> {
  if (isDevWallet) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const key = process.env.NEXT_PUBLIC_DEV_PRIVATE_KEY as `0x${string}` | undefined;
    if (key) {
      const account = privateKeyToAccount(key);
      walletClient = createWalletClient({ account, chain: getChain(), transport: http() });
    }
    return { address: stored, email: localStorage.getItem(STORAGE_KEY_EMAIL) };
  }

  const magic = getMagic();
  const loggedIn = await magic.user.isLoggedIn();
  if (!loggedIn) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_EMAIL);
    return null;
  }
  walletClient = createWalletClient({ chain: getChain(), transport: custom(magic.rpcProvider) });
  const session = await getMagicSession(magic);
  if (session) {
    localStorage.setItem(STORAGE_KEY, session.address);
    if (session.email) localStorage.setItem(STORAGE_KEY_EMAIL, session.email);
  }
  return session;
}

export async function logout(): Promise<void> {
  if (!isDevWallet) {
    await getMagic().user.logout();
  }
  walletClient = null;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY_EMAIL);
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
//
// `nonce` is optional and passed straight through to Magic (its SDK types
// document it) — Particle's userOps specify the exact nonce each auth must
// be signed at, so the UA path always provides it; the Kernel path (F4)
// keeps omitting it and Magic derives its own, unchanged.
export async function sign7702Authorization(params: {
  contractAddress: `0x${string}`;
  chainId: number;
  nonce?: number;
}): Promise<{
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
  const magic = getMagic();
  // Magic signs against its connected chain and rejects a mismatched
  // chainId outright (-32603 "Error signing"), so hop to the target chain
  // for the signature — and always hop back, even on failure: the rest of
  // the app (vault, Kernel path) assumes Magic stays on the app chain.
  const appChainId = getChain().id;
  const needsSwitch = params.chainId !== appChainId;
  if (needsSwitch) await magic.evm.switchChain(params.chainId);
  let auth;
  try {
    auth = await magic.wallet.sign7702Authorization(params);
  } finally {
    if (needsSwitch) await magic.evm.switchChain(appChainId);
  }
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

// Installs an EIP-7702 delegation on `chainId` with a Type-4 SELF-transaction
// (to: own address, empty calldata, the signed authorization riding along) —
// Particle UA's pre-delegation step for wallets that can't sign the
// chain-agnostic (chainId 0) authorization Particle asks for inline. Magic is
// such a wallet: handing per-chain signatures back inline gets the whole
// userOp bundle rejected with AA24 (found live 2026-07-19), so delegation has
// to be installed on-chain FIRST, after which Particle's quotes come back
// eip7702Delegated and need no authorization at all. Pattern verbatim from
// Particle-Network/ua-7702-magic-demo's ensureDelegated.
//
// `nonce` must be the value Particle's getEIP7702Auth reports PLUS ONE: the
// Type-4 tx itself spends the account's current nonce, so the authorization
// tucked inside it is validated against the next one.
//
// Magic's raw authorization response goes straight into send7702Transaction —
// its own wire shape (v, not yParity), no viem normalization wanted here.
// The EOA pays that chain's gas: this is the one step that needs a little
// native ETH on the delegating chain.
export async function send7702SelfDelegation(params: {
  ownerAddress: `0x${string}`;
  chainId: number;
  contractAddress: `0x${string}`;
  nonce: number;
}): Promise<{ transactionHash: string }> {
  if (isDevWallet) {
    throw new Error('send7702SelfDelegation is Magic-only — dev-wallet mode signs Particle auths inline');
  }
  const magic = getMagic();
  const appChainId = getChain().id;
  await magic.evm.switchChain(params.chainId);
  try {
    const authorization = await magic.wallet.sign7702Authorization({
      contractAddress: params.contractAddress,
      chainId: params.chainId,
      nonce: params.nonce,
    });
    const { transactionHash } = await magic.wallet.send7702Transaction({
      to: params.ownerAddress,
      data: '0x',
      authorizationList: [authorization],
    });
    return { transactionHash };
  } finally {
    await magic.evm.switchChain(appChainId);
  }
}
