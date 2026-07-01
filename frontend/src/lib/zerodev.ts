// ZeroDev session key helpers.
// A session key lets the backend debit the user without asking them to sign
// each time — it's scoped to a specific merchant, amount cap, and expiry.

export interface SessionKeyParams {
  merchantAddress: string;
  vaultAddress: string;
  tokenAddress: string;
  amountPerPeriod: bigint;
  validUntil: Date;
}

// TODO (Day 13): implement using @zerodev/sdk + @zerodev/permissions
// Returns the session key address that gets stored on-chain in PaymentExecutor.
export async function createSessionKey(
  _smartAccountClient: unknown,
  _params: SessionKeyParams,
): Promise<string> {
  throw new Error('createSessionKey not yet implemented');
}
