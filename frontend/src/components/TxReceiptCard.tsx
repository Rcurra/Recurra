'use client';

import { getChain } from '@/lib/chain';
import type { TxReceipt } from '@/lib/wallet';

// THE receipt of the app — every transaction that moves money (send,
// add funds, withdraw) ends in one of these, and they all read the
// same: what moved, between whom, and the chain's own proof (hash,
// block, timestamp). Facts come from the mined receipt, never from
// what a form believed. The explorer link appears by itself on chains
// that have one (Arbiscan from M3; anvil has none).
export function TxReceiptCard({
  title,
  receipt,
  rows,
}: {
  title: string; // "Sent" / "Added to vault" / "Withdrawn"
  receipt: TxReceipt;
  rows: Array<{ label: string; value: string; breakAll?: boolean }>;
}) {
  const chain = getChain();
  const explorer = chain.blockExplorers?.default;
  const allRows = [
    ...rows,
    { label: 'Transaction', value: receipt.hash, breakAll: true },
    { label: 'Block', value: `#${receipt.blockNumber.toString()}` },
    { label: 'When', value: receipt.timestamp.toLocaleString() },
  ];

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-[0.28em] text-ink/90">Receipt — {title} ✓</p>
        <p className="numeric text-[10px] text-ink-faint">{chain.name}</p>
      </div>
      <div className="rounded-xl border border-ink/25 bg-canvas/60">
        <dl>
          {allRows.map((row, i) => (
            <div key={row.label} className={`px-4 py-2.5 ${i < allRows.length - 1 ? 'border-b border-line' : ''}`}>
              <dt className="text-[9px] uppercase tracking-[0.18em] text-ink-faint">{row.label}</dt>
              <dd className={`numeric mt-0.5 text-[11px] leading-relaxed text-ink ${row.breakAll ? 'break-all' : ''}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {explorer && (
        <a
          href={`${explorer.url}/tx/${receipt.hash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-center text-[11px] tracking-[0.08em] text-ink-muted transition hover:text-ink"
        >
          View on {explorer.name} →
        </a>
      )}
    </div>
  );
}
