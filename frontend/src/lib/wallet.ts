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

import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  getAddress,
  http,
  isAddress,
  parseEventLogs,
  zeroAddress,
  type Abi,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem';
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

// Simulate-then-write, for every state-changing call in this file. Two
// failure modes this closes, both found live: (1) simulating first means a
// call that would revert (AlreadySubscribed, PlanNotActive, ...) throws its
// real decoded reason BEFORE the user signs anything — no wasted signature,
// no wasted gas. (2) `writeContract` on its own only throws for a failure
// *before* broadcast; a business-logic revert that happens on-chain still
// resolves as a normal receipt with `status: 'reverted'`. Every write here
// used to skip that check entirely, so a reverted unsubscribe/deposit/
// withdraw silently reported success — the UI would say "funded" when
// nothing moved. Checking `status` after mining is the belt-and-suspenders:
// state can still change between simulate and the tx actually landing.
async function writeContractSafely(
  walletClient: WalletClient,
  account: Address,
  params: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] },
) {
  const { request } = await getPublicClient().simulateContract({ ...params, account });
  const hash = await walletClient.writeContract({ ...request, chain: getChain(), account } as Parameters<
    WalletClient['writeContract']
  >[0]);
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`${params.functionName}() reverted on-chain despite passing simulation`);
  }
  return receipt;
}

export async function subscribe(address: string, planId: number): Promise<number> {
  const walletClient = requireWalletClient();
  const receipt = await writeContractSafely(walletClient, address as `0x${string}`, {
    address: getRegistryAddress(),
    abi: registryAbi,
    functionName: 'subscribe',
    args: [BigInt(planId)],
  });
  const [event] = parseEventLogs({ abi: registryAbi, eventName: 'Subscribed', logs: receipt.logs });
  if (!event) throw new Error('subscribe() succeeded but no Subscribed event was found in the receipt');
  return Number(event.args.subId);
}

export async function unsubscribe(address: string, subId: number): Promise<void> {
  const walletClient = requireWalletClient();
  await writeContractSafely(walletClient, address as `0x${string}`, {
    address: getRegistryAddress(),
    abi: registryAbi,
    functionName: 'unsubscribe',
    args: [BigInt(subId)],
  });
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
    await writeContractSafely(walletClient, account, {
      address: usdc,
      abi: usdcAbi,
      functionName: 'approve',
      args: [vault, amount],
    });
  }

  onStep?.('deposit');
  await writeContractSafely(walletClient, account, {
    address: vault,
    abi: vaultAbi,
    functionName: 'deposit',
    args: [usdc, amount],
  });
}

export async function withdraw(address: string, amount: bigint): Promise<void> {
  const walletClient = requireWalletClient();
  await writeContractSafely(walletClient, address as `0x${string}`, {
    address: getVaultAddress(),
    abi: vaultAbi,
    functionName: 'withdraw',
    args: [getUsdcAddress(), amount],
  });
}

// Plain-English translations for the custom errors defined in
// lib/contracts.ts's ABIs. Anything not listed here still shows the raw
// decoded error name (e.g. "NotPlanMerchant") — jargon, but a real name
// beats a hex selector; anything genuinely unrecognized falls further back
// to shortMessage in walletErrorMessage below.
const FRIENDLY_REVERTS: Record<string, string> = {
  AlreadySubscribed: "You're already subscribed to this plan.",
  PlanNotActive: 'This plan is no longer available.',
  SubscriptionNotActive: 'This subscription is already cancelled.',
  ZeroAmount: 'Enter an amount greater than zero.',
  InsufficientBalance: "Your vault doesn't have enough to cover that.",
  ERC20InsufficientBalance: "Your wallet doesn't have enough USDC for this amount.",
  ERC20InsufficientAllowance: 'Approval too low for this amount — try again.',
};

// Custom-error reverts (AlreadySubscribed, InsufficientBalance, ...) decode
// to a `ContractFunctionRevertedError` buried in the cause chain — its own
// top-level `shortMessage` is just a generic "function X reverted" wrapper,
// not the actual reason. `BaseError.walk` finds the specific nested error;
// `.data.errorName` is the decoded custom error's real name (only resolves
// if that error is declared in the ABI passed to the call — see
// lib/contracts.ts's erc20Errors/registryAbi/vaultAbi error entries).
const NETWORK_NOISE = /failed to fetch|-32603|http request failed|timed? ?out/i;
const NETWORK_MESSAGE = "Couldn't reach the network. Check your connection and try again.";

export function walletErrorMessage(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    const errorName = reverted instanceof ContractFunctionRevertedError ? reverted.data?.errorName : undefined;
    if (errorName) return FRIENDLY_REVERTS[errorName] ?? errorName;
    // transport failures surface as raw JSON-RPC noise ("RPC Error:
    // [-32603] Failed to fetch") — found live on a blocked hotspot; say
    // it like a human instead
    if (NETWORK_NOISE.test(error.shortMessage) || NETWORK_NOISE.test(error.message)) {
      return NETWORK_MESSAGE;
    }
    return error.shortMessage;
  }
  if (error instanceof Error) {
    return NETWORK_NOISE.test(error.message) ? NETWORK_MESSAGE : error.message;
  }
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
  await writeContractSafely(walletClient, address as `0x${string}`, {
    address: getUsdcAddress(),
    abi: usdcAbi,
    functionName: 'mint',
    args: [address as `0x${string}`, amount],
  });
}

export async function getUsdcBalance(address: string): Promise<bigint> {
  return getPublicClient().readContract({
    address: getUsdcAddress(),
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
}

// The one action in the app that moves money OUT of Recurra's world
// entirely — a plain ERC-20 transfer from the user's own wallet to any
// address they type. F4.5's security rules, all enforced here at the
// boundary, not just in the UI:
// - destination must be a well-formed address (checksummed via
//   getAddress) BEFORE anything is signed — a typo must fail loudly,
//   never become unrecoverable
// - explicit zero-address block, belt-and-suspenders over the token's own
// - same simulate-then-write-then-check-receipt path as every other write
// - NOT gated behind NEXT_PUBLIC_DEV_WALLET: unlike the mint faucet, a
//   plain transfer works identically in dev and real mode
//
// PERMANENT SECURITY BOUNDARY (from frontend/plan.md F4.5): when the
// ZeroDev session key lands in F4, this function must NEVER be delegated
// to it. The session key's model is a fixed allowlist of known contracts;
// "send to whatever the user typed" is fundamentally incompatible with
// an allowlist. Send always requires a fresh, full owner signature — in
// dev mode and Kernel mode alike. Not a UX preference; do not revisit.
export async function transferUsdc(from: string, to: string, amount: bigint): Promise<void> {
  if (!isAddress(to)) {
    throw new Error("That doesn't look like a valid address — check it and try again.");
  }
  const destination = getAddress(to); // checksummed, canonical
  if (destination === zeroAddress) {
    throw new Error('That is the zero address — funds sent there are gone forever.');
  }
  if (amount <= 0n) {
    throw new Error('Enter an amount greater than zero.');
  }
  const walletClient = requireWalletClient();
  await writeContractSafely(walletClient, from as `0x${string}`, {
    address: getUsdcAddress(),
    abi: usdcAbi,
    functionName: 'transfer',
    args: [destination, amount],
  });
}
