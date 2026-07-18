'use client';

import { useState } from 'react';
import { InlineError } from '@/components/InlineError';
import { parseUSDC } from '@/lib/format';
import { PARTICLE_ENABLED, getUnifiedBalance, routeToArbitrum } from '@/lib/particle';
import { walletErrorMessage } from '@/lib/wallet';

// F6's cross-chain fund step — a separate demo beat from the main deposit
// flow above it, not a replacement. Particle's Universal Accounts are
// mainnet-only (no testnet anywhere in their stack); this whole panel is
// invisible unless NEXT_PUBLIC_PARTICLE_ENABLED=1, and the default deposit
// path in VaultModal works identically whether this exists or not.
export function ParticleFundAside({ address, onRouted }: { address: string | null; onRouted: () => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [amount, setAmount] = useState('');
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routedId, setRoutedId] = useState<string | null>(null);

  if (!PARTICLE_ENABLED) return null;

  async function handleCheck() {
    if (!address) return;
    setChecking(true);
    setError(null);
    try {
      const { totalUsd } = await getUnifiedBalance(address);
      setBalance(totalUsd);
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  async function handleRoute() {
    if (!address) return;
    const amountUnits = parseUSDC(amount);
    if (amountUnits === null || amountUnits <= 0n) return;
    setRouting(true);
    setError(null);
    setRoutedId(null);
    try {
      const { transactionId } = await routeToArbitrum(address, amountUnits);
      setRoutedId(transactionId);
      setAmount('');
      onRouted();
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setRouting(false);
    }
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        Or fund from another chain
      </p>
      <p className="mb-3 text-[11px] font-light text-ink-muted">
        Pay from whatever chain already holds your USDC — it lands at your real address on Arbitrum
        One mainnet. A separate live moment from the vault above (that&apos;s still on Sepolia for
        this demo) — real funds, real chains, no testnet here.
      </p>

      <button
        onClick={handleCheck}
        disabled={checking || !address}
        className="numeric mb-3 w-full rounded-xl border border-line bg-canvas/60 px-4 py-3 text-left text-xs text-ink transition hover:border-ink/40 disabled:opacity-50"
      >
        {checking ? 'Checking…' : balance !== null ? `Cross-chain balance: $${balance.toFixed(2)}` : 'Check cross-chain balance'}
      </button>

      <div className="mb-3 flex gap-2">
        <div className="flex w-full items-center gap-2 rounded-xl border border-line bg-canvas/60 px-4 py-3 transition focus-within:border-ink/40">
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (error) setError(null);
            }}
            disabled={routing}
            placeholder="0.00"
            inputMode="decimal"
            className="numeric w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
          />
          <span className="numeric shrink-0 text-xs text-ink-faint">USDC</span>
        </div>
        <button
          onClick={handleRoute}
          disabled={routing || !address || !((parseUSDC(amount) ?? 0n) > 0n)}
          className="shrink-0 rounded-xl border border-ink/30 bg-canvas/40 px-4 text-[11px] tracking-[0.08em] text-ink transition hover:border-ink/60 disabled:opacity-40"
        >
          {routing ? 'Routing…' : 'Route to Arbitrum'}
        </button>
      </div>

      {routedId && (
        <p className="text-[11px] text-ink-muted">
          On its way — track it at{' '}
          <a
            href={`https://universalx.app/activity/details?id=${routedId}`}
            target="_blank"
            rel="noreferrer"
            className="text-ink underline decoration-dotted underline-offset-2"
          >
            universalx.app
          </a>
          .
        </p>
      )}
      {error && (
        <div className="mt-2">
          <InlineError message={error} />
        </div>
      )}
    </div>
  );
}
