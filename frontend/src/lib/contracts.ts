// Contract addresses + the minimal ABIs lib/wallet.ts writes through.
// Hand-written per function actually called (mirrors services/api.ts's
// hand-mirrored wire shapes) rather than importing the full Forge artifact —
// keeps this file readable as the one place naming the on-chain surface.

function requireAddress(name: string, value: string | undefined): `0x${string}` {
  if (!value) {
    throw new Error(`${name} is not set — see .env.local.example`);
  }
  return value as `0x${string}`;
}

export function getRegistryAddress(): `0x${string}` {
  return requireAddress('NEXT_PUBLIC_REGISTRY_ADDRESS', process.env.NEXT_PUBLIC_REGISTRY_ADDRESS);
}

export function getVaultAddress(): `0x${string}` {
  return requireAddress('NEXT_PUBLIC_VAULT_ADDRESS', process.env.NEXT_PUBLIC_VAULT_ADDRESS);
}

export function getUsdcAddress(): `0x${string}` {
  return requireAddress('NEXT_PUBLIC_USDC_ADDRESS', process.env.NEXT_PUBLIC_USDC_ADDRESS);
}

// Standard OpenZeppelin IERC20Errors — MockUSDC inherits OZ's ERC20, so a
// transferFrom short on balance/allowance reverts with one of these, not a
// registry/vault error. Needed on BOTH usdcAbi (direct approve/mint calls)
// and vaultAbi (deposit/withdraw call into the token internally and bubble
// its revert unchanged) — without it here, viem can't name the error and
// walletErrorMessage falls back to a raw "reverted with signature 0x...".
const erc20Errors = [
  {
    name: 'ERC20InsufficientBalance',
    type: 'error',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'balance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
  {
    name: 'ERC20InsufficientAllowance',
    type: 'error',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'allowance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
  { name: 'ERC20InvalidSender', type: 'error', inputs: [{ name: 'sender', type: 'address' }] },
  { name: 'ERC20InvalidReceiver', type: 'error', inputs: [{ name: 'receiver', type: 'address' }] },
  { name: 'ERC20InvalidApprover', type: 'error', inputs: [{ name: 'approver', type: 'address' }] },
  { name: 'ERC20InvalidSpender', type: 'error', inputs: [{ name: 'spender', type: 'address' }] },
] as const;

// SubscriptionRegistry — subscribe/unsubscribe only; markPaid/isDue/plan
// reads stay the backend's and services/api.ts's job.
export const registryAbi = [
  {
    name: 'subscribe',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'planId', type: 'uint256' }],
    outputs: [{ name: 'subId', type: 'uint256' }],
  },
  {
    name: 'unsubscribe',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subId', type: 'uint256' }],
    outputs: [],
  },
  // Read off the receipt so subscribe() can return the real subId — the
  // function's own return value isn't retrievable from a submitted tx.
  {
    name: 'Subscribed',
    type: 'event',
    inputs: [
      { name: 'subId', type: 'uint256', indexed: true },
      { name: 'subscriber', type: 'address', indexed: true },
      { name: 'planId', type: 'uint256', indexed: true },
    ],
  },
  // Every revert subscribe()/unsubscribe() can throw — without these listed
  // here, a revert shows as a raw selector instead of e.g. "AlreadySubscribed".
  { name: 'InvalidPlanParams', type: 'error', inputs: [] },
  { name: 'PlanNotActive', type: 'error', inputs: [] },
  { name: 'AlreadySubscribed', type: 'error', inputs: [] },
  { name: 'NotPlanMerchant', type: 'error', inputs: [] },
  { name: 'NotSubscriber', type: 'error', inputs: [] },
  { name: 'SubscriptionNotActive', type: 'error', inputs: [] },
] as const;

// SubscriptionVault — deposit/withdraw + the balances read the reservoir
// card needs before F5's real vault-balance endpoint lands.
export const vaultAbi = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'balances',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'subscriber', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  { name: 'ZeroAmount', type: 'error', inputs: [] },
  { name: 'InsufficientBalance', type: 'error', inputs: [] },
  ...erc20Errors,
] as const;

// MockUSDC — standard ERC-20 plus the open mint() faucet (dev/testnet only).
export const usdcAbi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  ...erc20Errors,
] as const;
