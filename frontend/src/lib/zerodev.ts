// ZeroDev — the smart-account layer. The ONLY file that may import
// @zerodev/sdk / @zerodev/permissions.
//
// F4 implements:
// - 7702 Kernel account from the Magic EOA (same address), lazily on first
//   subscribe. Arbitrum's delegation slot belongs to Kernel, permanently.
// - Session key at subscribe time, generated in the browser and scoped:
//   callable contracts = vault + registry, spend cap = the user's funding
//   amount, expiry = a few intervals. Validated by Kernel's permission
//   modules AT THE ACCOUNT LAYER — session keys never touch our contracts
//   (M0 decision; there is no on-chain registerSessionKey).
// - One batched UserOp: subscribe + approve + deposit under ONE signature;
//   ZeroDev paymaster sponsors gas.
//
// Until F4, features call the F3 signer abstraction (plain EOA writes on
// anvil) behind the same interface — swapping it for Kernel must not touch
// feature code.

export interface SessionKeyScope {
  vaultAddress: string;
  registryAddress: string;
  spendCap: bigint; // == the funding amount the user chose
  expiresAt: Date;
}

export async function subscribeAndFund(
  _planId: number,
  _fundingAmount: bigint,
  _scope: SessionKeyScope,
): Promise<never> {
  throw new Error('lib/zerodev: implemented at F4');
}
