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
] as const;
