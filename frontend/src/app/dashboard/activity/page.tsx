import { formatUSDC, shortAddress, timeAgo } from '@/lib/format';
import { MOCK_RECEIPTS } from '@/lib/mockData';

export default function ActivityPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-1 flex items-center gap-2" style={{ animation: 'fadeUp 0.7s ease both' }}>
        <p className="numeric text-[11px] uppercase tracking-[0.24em] text-ink-faint">Activity</p>
        <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
          PREVIEW
        </span>
      </div>
      <p className="mb-6 text-xs text-ink-faint">
        Sample receipts — real payment history arrives with F5.
      </p>

      <ul className="space-y-3" style={{ animation: 'fadeUp 0.7s ease both 0.12s' }}>
        {MOCK_RECEIPTS.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-5 rounded-2xl border border-line bg-surface/75 p-5 backdrop-blur-xl"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-mint" style={{ boxShadow: '0 0 8px var(--mint)' }} />
            <div className="min-w-0 flex-1">
              <p className="numeric text-[15px] font-medium text-ink">{formatUSDC(r.amount)} USDC</p>
              <p className="mt-1 text-xs text-ink-muted">
                paid to <span className="numeric">{shortAddress(r.merchant)}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="numeric text-xs text-ink-muted">{timeAgo(r.paidAt)}</p>
              <p
                title="Arrives with F5 — real receipts link to Arbiscan"
                className="numeric mt-1 cursor-not-allowed text-[11px] text-ink-faint opacity-60"
              >
                {r.txHash}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
