// Placeholder content for screens with no real data source yet —
// session-key scope (Settings) is F4 frontend work. Receipts (Activity)
// retired 2026-07-14: SubDetailModal now shows real per-subscription
// receipts via lib/receipts.ts's on-chain scan. Shaped like the real thing
// (bigint amounts, real Date objects) so the render code that consumes
// this is the same code that'll consume the real API later — swapping the
// import is the whole migration. Every consumer must show a PREVIEW badge;
// this is never real money.

export interface MockPermission {
  sentence: string;
  expiresIn: string;
}

export const MOCK_PERMISSIONS: MockPermission[] = [
  {
    sentence: 'Recurra can charge up to 10 USDC every 30 days to 0x1f98…F984.',
    expiresIn: 'expires in 58 days',
  },
  {
    sentence: 'Recurra can charge up to 25 USDC every 30 days to 0x2546…Ec30.',
    expiresIn: 'expires in 12 days',
  },
  {
    sentence: 'Nothing else is approved — every other action needs your signature.',
    expiresIn: '',
  },
];
