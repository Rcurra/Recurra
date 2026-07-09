// Placeholder content for screens with no real data source yet — GET
// /payments (Activity) is M4 backend work, session-key scope (Settings) is
// F4 frontend work. Shaped like the real thing (bigint amounts, real Date
// objects) so the render code that consumes this is the same code that'll
// consume the real API later — swapping the import is the whole migration.
// Every consumer must show a PREVIEW badge; this is never real money.

export interface MockReceipt {
  id: number;
  merchant: string;
  amount: bigint;
  paidAt: Date;
  txHash: string;
}

export const MOCK_RECEIPTS: MockReceipt[] = [
  {
    id: 1,
    merchant: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    amount: 10_000_000n,
    paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    txHash: '0x7a2c...9e41',
  },
  {
    id: 2,
    merchant: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    amount: 25_000_000n,
    paidAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
    txHash: '0x4b18...c203',
  },
  {
    id: 3,
    merchant: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    amount: 10_000_000n,
    paidAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
    txHash: '0x91fd...5a77',
  },
];

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
