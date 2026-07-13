'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassPanel } from '@/components/GlassPanel';
import { InlineError } from '@/components/InlineError';
import { LoadingLine } from '@/components/LoadingLine';
import { formatUSDC, parseUSDC } from '@/lib/format';
import { getUsdcBalance, transferUsdc, walletErrorMessage } from '@/lib/wallet';

type Phase = 'idle' | 'confirm' | 'sending' | 'done' | 'error';

// The wallet, opened — the door out of Recurra's world. Everything else
// in the app keeps funds inside a custody chain the user can always walk
// back (vault -> wallet, cancel, withdraw); this modal is where money
// leaves entirely. Three jobs:
//   1. show the wallet's own USDC balance (distinct from the vault's)
//   2. show the FULL address + copy — that IS the receive story
//   3. send USDC anywhere, behind a confirmation that tells the truth:
//      this one cannot be undone.
// Portaled to <body> with a fixed backdrop — the two modal lessons paid
// for in blood elsewhere, applied from birth here.
export function WalletModal({
  open,
  address,
  onClose,
}: {
  open: boolean;
  address: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !address) return null;
  return <WalletModalContent key={address} address={address} onClose={onClose} />;
}

function WalletModalContent({ address, onClose }: { address: string; onClose: () => void }) {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [to, setTo] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refetchBalance = useCallback(() => {
    getUsdcBalance(address)
      .then(setBalance)
      .catch(() => {}); // balance line degrades gracefully
  }, [address]);

  useEffect(() => {
    refetchBalance();
  }, [refetchBalance]);

  const amount = parseUSDC(amountInput);
  const busy = phase === 'sending';
  const canReview =
    !busy && phase !== 'done' && to.trim() !== '' && amount !== null && amount > 0n &&
    balance !== null && amount <= balance;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the address is on screen in full, selectable
    }
  }

  async function handleSend() {
    if (amount === null) return;
    setError(null);
    setPhase('sending');
    try {
      await transferUsdc(address, to.trim(), amount);
      setPhase('done');
      refetchBalance();
    } catch (e) {
      setError(walletErrorMessage(e));
      setPhase('error');
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Your wallet"
    >
      {/* fixed, not absolute — the veil must not scroll away with content */}
      <div className="fixed inset-0 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-auto w-full max-w-sm" style={{ animation: 'fadeUp 0.35s ease both' }}>
        <GlassPanel hairline className="p-6">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full border border-line px-2.5 py-1 text-sm text-ink-muted transition hover:border-ink/50 hover:text-ink"
          >
            ×
          </button>

          <p className="text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            Wallet — yours, beyond Recurra
          </p>

          {/* ── balance ── */}
          <p className="numeric mt-5 text-4xl font-light text-ink">
            {balance === null ? '—' : formatUSDC(balance)}
            <span className="pl-2 text-base text-ink-muted">USDC</span>
          </p>
          <p className="mt-1.5 text-[11px] font-light text-ink-muted">
            in your wallet itself — your vault is separate, withdraw it from Overview first.
          </p>

          {/* ── the receive story: the full address, nothing hidden ── */}
          <div className="mt-5">
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Your address — anyone can send USDC here
            </p>
            <button
              onClick={handleCopy}
              className="numeric w-full break-all rounded-xl border border-line bg-canvas/60 px-4 py-3 text-left text-[11.5px] leading-relaxed text-ink transition hover:border-ink/40"
              title="Copy address"
            >
              {address}
              <span className="mt-1.5 block text-[10px] tracking-[0.14em] text-ink-faint">
                {copied ? 'COPIED ✓' : 'TAP TO COPY'}
              </span>
            </button>
          </div>

          {/* ── send — the door out ── */}
          {phase !== 'confirm' && (
            <div className="mt-6">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Send USDC anywhere
              </p>
              <input
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  if (error) setError(null);
                }}
                disabled={busy}
                placeholder="destination address (0x…)"
                className="numeric mb-2 w-full rounded-xl border border-line bg-canvas/60 px-4 py-3 text-xs text-ink transition placeholder:text-ink-faint focus:border-ink/40 focus:outline-none disabled:opacity-60"
              />
              <div className="mb-3 flex gap-2">
                <input
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={busy}
                  inputMode="decimal"
                  placeholder="amount"
                  className="numeric w-full rounded-xl border border-line bg-canvas/60 px-4 py-3 text-xs text-ink transition placeholder:text-ink-faint focus:border-ink/40 focus:outline-none disabled:opacity-60"
                />
                <button
                  onClick={() => balance !== null && setAmountInput(formatUSDC(balance))}
                  disabled={busy || balance === null}
                  className="shrink-0 rounded-xl border border-line px-4 text-[11px] tracking-[0.08em] text-ink-muted transition hover:border-ink/40 hover:text-ink disabled:opacity-50"
                >
                  Max
                </button>
              </div>

              <button
                onClick={() => setPhase('confirm')}
                disabled={!canReview}
                className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-semibold tracking-[0.04em] text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)] disabled:opacity-40 disabled:hover:shadow-none"
              >
                {phase === 'done' ? 'Sent ✓' : busy ? 'Sending…' : 'Review send'}
              </button>

              {phase === 'done' && (
                <p className="numeric mt-2 text-center text-[11px] text-ink-muted">
                  On its way. Your balance is updated above.
                </p>
              )}
              {amount !== null && balance !== null && amount > balance && (
                <p className="mt-2 text-center text-[11px] text-ink-faint">
                  That&rsquo;s more than your wallet holds.
                </p>
              )}
              {error && (
                <div className="mt-3">
                  <InlineError message={error} />
                </div>
              )}
            </div>
          )}

          {/* ── the confirmation — the one place the copy says the
              opposite of "you can undo this anytime" ── */}
          {phase === 'confirm' && amount !== null && (
            <div className="mt-6">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Confirm — read the address, all of it
              </p>
              <div className="rounded-xl border border-ink/25 bg-canvas/60 px-4 py-3">
                <p className="numeric text-lg text-ink">
                  {formatUSDC(amount)} <span className="text-xs text-ink-muted">USDC</span>
                </p>
                <p className="numeric mt-2 break-all text-[11.5px] leading-relaxed text-ink">{to.trim()}</p>
              </div>
              <p className="mt-3 text-center text-[11px] font-light text-ink/90">
                Unlike everything else in Recurra, this cannot be undone.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setPhase('idle')}
                  className="flex-1 rounded-full border border-line px-5 py-2.5 text-sm text-ink-muted transition hover:border-ink/40 hover:text-ink"
                >
                  Back
                </button>
                <button
                  onClick={handleSend}
                  className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)]"
                >
                  Send it
                </button>
              </div>
            </div>
          )}

          {balance === null && (
            <div className="mt-4">
              <LoadingLine label="reading your wallet…" />
            </div>
          )}
        </GlassPanel>
      </div>
    </div>,
    document.body,
  );
}
