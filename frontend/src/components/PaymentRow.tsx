'use client';

import { getChain } from '@/lib/chain';
import { formatUSDC, shortAddress, timeAgo } from '@/lib/format';
import type { Payment } from '@/types';

// One charge in the Activity feed — collapsed, the same quiet line as
// ReceiptListRow; tapped, it opens into the charge's facts (hairline rows,
// the modals' grammar) with the explorer link as one fact among them.
// Deliberately NOT a bare link like ReceiptListRow: an activity feed is
// where you come to understand a charge, and being yanked straight to
// Arbiscan answers a question nobody asked yet. The explorer stays one
// tap away — just labeled, inside the details, after the app's own answer.
//
// open/onToggle are controlled by the feed, not local state, so the list
// behaves as an accordion — opening a row closes the previous one. One
// charge is the thing being inspected at a time; two open fact sheets is
// clutter, and the feed owning the state is what makes that rule possible.
export function PaymentRow({
  payment,
  cadence,
  open,
  onToggle,
}: {
  payment: Payment;
  cadence?: string; // "every 30 days" — omitted when the plan isn't loaded
  open: boolean;
  onToggle: () => void;
}) {
  const explorer = getChain().blockExplorers?.default;

  const facts: { label: string; value: string }[] = [
    { label: 'Subscription', value: `#${payment.subId}` },
    ...(cadence ? [{ label: 'Cadence', value: cadence }] : []),
    { label: 'Merchant', value: shortAddress(payment.merchant) },
    { label: 'Amount', value: `${formatUSDC(payment.amount)} USDC` },
    { label: 'Charged', value: payment.timestamp.toLocaleString() },
    { label: 'Block', value: payment.blockNumber.toString() },
    { label: 'Transaction', value: shortAddress(payment.txHash) },
  ];

  return (
    <div className="rounded-xl border border-line bg-canvas/40 transition hover:border-ink/30">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink/50" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] capitalize text-ink">charged — sub #{payment.subId}</p>
          <p className="numeric mt-0.5 text-[11px] text-ink-faint">{shortAddress(payment.merchant)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="numeric text-[13px] text-ink">{formatUSDC(payment.amount)} USDC</p>
          <p className="numeric mt-0.5 text-[10px] text-ink-faint">{timeAgo(payment.timestamp)}</p>
        </div>
        <svg
          width="9"
          height="6"
          viewBox="0 0 9 6"
          className={`shrink-0 text-ink-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M1 1 L4.5 4.5 L8 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-3" style={{ animation: 'fadeUp 0.25s ease both' }}>
          <dl>
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
                <dt className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">{f.label}</dt>
                <dd className="numeric truncate text-xs text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
          {explorer && (
            <a
              href={`${explorer.url}/tx/${payment.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-[11px] text-ink-muted underline-offset-4 transition hover:text-ink hover:underline"
            >
              View on {explorer.name} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
