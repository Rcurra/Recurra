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
import { createWalletClient, custom, http, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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
