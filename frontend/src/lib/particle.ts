// Particle Universal Accounts — the cross-chain fund step. The ONLY file
// that may import @particle-network/universal-account-sdk.
//
// F6 implements, per the confirmed plan (CONCEPT.md "Particle UA"):
// - UA SDK in EIP-7702 mode (useEIP7702: true — track requirement),
//   delegated on SOURCE chains only (Base/Polygon, where the user's funds
//   sit). Arbitrum's 7702 slot belongs to ZeroDev Kernel and is never
//   touched by the UA (confirmed by Particle: source-chain delegation is
//   sufficient; funds spendable to any supported chain).
// - The cross-chain op: unified balance display + routing the user's
//   other-chain USDC to their address on Arbitrum, where Kernel deposits it.
// - Mainnet-only (no testnet routing) — feature-flagged, default deposit
//   path must work without it.

export const PARTICLE_ENABLED = process.env.NEXT_PUBLIC_PARTICLE_ENABLED === '1';

export async function getUnifiedBalance(_ownerAddress: string): Promise<never> {
  throw new Error('lib/particle: implemented at F6 (flag-gated)');
}

export async function routeToArbitrum(_ownerAddress: string, _amount: bigint): Promise<never> {
  throw new Error('lib/particle: implemented at F6 (flag-gated)');
}
