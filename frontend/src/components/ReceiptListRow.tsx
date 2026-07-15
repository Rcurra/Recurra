'use client';

import { getChain } from '@/lib/chain';
import { shortAddress, timeAgo } from '@/lib/format';
import type { TxReceipt } from '@/lib/wallet';

// A single line of history — the compact counterpart to TxReceiptCard, for
// contexts showing MANY receipts at once (a subscription's full lifecycle,
// the vault's whole history) where stacking the full detailed card per
// entry read as clutter, not information (found live 2026-07-15).
// TxReceiptCard stays exactly as it is for the single, prominent "you just
// did this" moment (Send/Add funds/Withdraw/Subscribe's done screen) —
// this is for "here's what already happened," where the full hash/block/
// timestamp breakdown belongs one click away on the explorer, not
// repeated inline for every row.
export function ReceiptListRow({
  title,
  amount,
  counterparty,
  receipt,
}: {
  title: string; // "subscribed" / "charged" / "withdrawn" / "cancelled"
  amount?: string; // pre-formatted, e.g. "25.00 USDC" — omit to hide
  counterparty?: string; // full address; shown truncated
  receipt: TxReceipt;
}) {
  const chain = getChain();
  const explorer = chain.blockExplorers?.default;
  const href = explorer ? `${explorer.url}/tx/${receipt.hash}` : undefined;

  const row = (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-canvas/40 px-4 py-3 transition hover:border-ink/30">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink/50" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] capitalize text-ink">{title}</p>
        {counterparty && <p className="numeric mt-0.5 text-[11px] text-ink-faint">{shortAddress(counterparty)}</p>}
      </div>
      <div className="shrink-0 text-right">
        {amount && <p className="numeric text-[13px] text-ink">{amount}</p>}
        <p className="numeric mt-0.5 text-[10px] text-ink-faint">{timeAgo(receipt.timestamp)}</p>
      </div>
    </div>
  );

  if (!href) return row;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block" title="View on explorer">
      {row}
    </a>
  );
}
