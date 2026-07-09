// F3's signer abstraction — direct viem writes against the deployed
// contracts, dev-mode only. F4 re-points these same four calls at the
// Kernel account behind the identical function signatures (the CONCEPT.md
// dev-mode promise): feature code imports this file, never viem itself.
//
// Every function takes the connected address explicitly (from useAuth())
// rather than reading it off the wallet client, because the real-Magic
// client is built without an `account` (see lib/magic.ts). Passing the
// address as a plain string per-call works for both paths: anvil
// auto-signs its own unlocked dev accounts over http(), and Magic's
// custom() transport signs via its own provider — same account-as-string
// override either way.

import { BaseError, createPublicClient, http, parseEventLogs, type PublicClient } from 'viem';
import { getChain } from './chain';
import { getWalletClient } from './magic';
import {
  getRegistryAddress,
  getUsdcAddress,
  getVaultAddress,
  registryAbi,
  usdcAbi,
  vaultAbi,
} from './contracts';

let publicClient: PublicClient | null = null;

function getPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({ chain: getChain(), transport: http() });
  }
  return publicClient;
}

function requireWalletClient() {
  const walletClient = getWalletClient();
  if (!walletClient) throw new Error('Not logged in — no wallet client available');
  return walletClient;
}

export async function subscribe(address: string, planId: number): Promise<number> {
  const walletClient = requireWalletClient();
  const hash = await walletClient.writeContract({
    account: address as `0x${string}`,
    chain: getChain(),
    address: getRegistryAddress(),
    abi: registryAbi,
    functionName: 'subscribe',
    args: [BigInt(planId)],
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  const [event] = parseEventLogs({ abi: registryAbi, eventName: 'Subscribed', logs: receipt.logs });
  if (!event) throw new Error('subscribe() succeeded but no Subscribed event was found in the receipt');
  return Number(event.args.subId);
}

export async function unsubscribe(address: string, subId: number): Promise<void> {
  const walletClient = requireWalletClient();
  const hash = await walletClient.writeContract({
    account: address as `0x${string}`,
    chain: getChain(),
    address: getRegistryAddress(),
    abi: registryAbi,
    functionName: 'unsubscribe',
    args: [BigInt(subId)],
  });
  await getPublicClient().waitForTransactionReceipt({ hash });
}

// Approve only if the current allowance is short, then deposit — two
// signatures in dev mode (three counting a prior subscribe); F4 batches
// this whole sequence into the one-signature UserOp. onStep is optional,
// purely for a caller that wants to show "step 2 of 3" progress (the
// subscribe flow's signature-collapse stub) — skipped entirely if the
// allowance already covers the amount.
export async function approveAndDeposit(
  address: string,
  amount: bigint,
  onStep?: (step: 'approve' | 'deposit') => void,
): Promise<void> {
  const walletClient = requireWalletClient();
  const usdc = getUsdcAddress();
  const vault = getVaultAddress();
  const account = address as `0x${string}`;

  const allowance = await getPublicClient().readContract({
    address: usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args: [account, vault],
  });

  if (allowance < amount) {
    onStep?.('approve');
    const approveHash = await walletClient.writeContract({
      account,
      chain: getChain(),
      address: usdc,
      abi: usdcAbi,
      functionName: 'approve',
      args: [vault, amount],
    });
    await getPublicClient().waitForTransactionReceipt({ hash: approveHash });
  }

  onStep?.('deposit');
  const depositHash = await walletClient.writeContract({
    account,
    chain: getChain(),
    address: vault,
    abi: vaultAbi,
    functionName: 'deposit',
    args: [usdc, amount],
  });
  await getPublicClient().waitForTransactionReceipt({ hash: depositHash });
}

export async function withdraw(address: string, amount: bigint): Promise<void> {
  const walletClient = requireWalletClient();
  const hash = await walletClient.writeContract({
    account: address as `0x${string}`,
    chain: getChain(),
    address: getVaultAddress(),
    abi: vaultAbi,
    functionName: 'withdraw',
    args: [getUsdcAddress(), amount],
  });
  await getPublicClient().waitForTransactionReceipt({ hash });
}

// Custom-error reverts (AlreadySubscribed, InsufficientBalance, ...) surface
// through viem as a BaseError whose shortMessage names the actual error —
// that's more useful to a user than the wrapped RPC/ABI-encoding noise.
export function walletErrorMessage(error: unknown): string {
  if (error instanceof BaseError) return error.shortMessage;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

// Dev-mode stand-in for F5's real vault-balance endpoint — reads the chain
// directly until that backend surface lands (per F2's open backend ask).
export async function getVaultBalance(address: string): Promise<bigint> {
  return getPublicClient().readContract({
    address: getVaultAddress(),
    abi: vaultAbi,
    functionName: 'balances',
    args: [address as `0x${string}`, getUsdcAddress()],
  });
}

// MockUSDC's mint() is open to anyone — anvil/testnet only, never a real
// deploy target. The "MockUSDC faucet behind flag" F3 item; callers gate
// this on NEXT_PUBLIC_DEV_WALLET, same flag the dev-signer path already uses.
export async function mintTestUsdc(address: string, amount: bigint): Promise<void> {
  const walletClient = requireWalletClient();
  const hash = await walletClient.writeContract({
    account: address as `0x${string}`,
    chain: getChain(),
    address: getUsdcAddress(),
    abi: usdcAbi,
    functionName: 'mint',
    args: [address as `0x${string}`, amount],
  });
  await getPublicClient().waitForTransactionReceipt({ hash });
}

export async function getUsdcBalance(address: string): Promise<bigint> {
  return getPublicClient().readContract({
    address: getUsdcAddress(),
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
}
