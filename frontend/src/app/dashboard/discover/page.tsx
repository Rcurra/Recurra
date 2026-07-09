'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Plan } from '@/types';
import { GlassCard } from '@/components/GlassCard';
import { formatUSDC, intervalLabel, shortAddress } from '@/lib/format';

export default function DiscoverPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.plans
      .list()
      .then(setPlans)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="numeric mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-faint" style={{ animation: 'fadeUp 0.7s ease both' }}>
        Discover
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && plans.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-10 text-center">
          <p className="text-sm text-ink-muted">No plans yet.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" style={{ animation: 'fadeUp 0.7s ease both 0.12s' }}>
        {plans.map((plan) => (
          <GlassCard key={plan.id} hairline className="p-5 transition hover:border-[#282c39]">
            <p className="numeric text-xl font-semibold text-ink">
              {formatUSDC(plan.amount)} <span className="text-sm font-normal text-ink-muted">USDC</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">every {intervalLabel(plan.intervalSecs)}</p>
            <p className="numeric mt-3 text-[11px] text-ink-faint">merchant {shortAddress(plan.merchant)}</p>
            <button
              disabled
              title="Arrives with F3 — writes go through your account"
              className="mt-4 w-full rounded-lg bg-mint px-4 py-2.5 text-sm font-medium text-canvas opacity-40"
            >
              Subscribe
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
