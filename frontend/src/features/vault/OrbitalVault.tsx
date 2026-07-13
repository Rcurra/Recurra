'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GlassPanel } from '@/components/GlassPanel';
import { RecurraMark } from '@/components/RecurraMark';
import { formatUSDC, cycleProgress, monthlyEquivalent, runwayLabel, timeUntil } from '@/lib/format';
import type { Plan, Subscription } from '@/types';

// The vault hero, in the landing's grammar: numbers and actions on the
// left, the system on the right. The system is a flat orrery — the app's
// own cadence-ring language, layered: each subscription is a thin
// concentric circle whose bright arc IS the billing cycle (filling
// clockwise from the top; full circle = charge due), with a moon riding
// the arc's head. The vault is the quiet core they all circle. Flat and
// instrument-like on purpose — volumetric objects belong to the landing's
// open space, not inside a glass panel. When the scheduler fires, the
// arc completes its lap and the ring flashes: the pulse.

const VIEW = 400;
const C = VIEW / 2;
const MAX_ORBITS = 3;
const ringRadius = (i: number) => 74 + i * 34;

type OrbitSub = { sub: Subscription; plan: Plan };

function ringXY(r: number, progress: number) {
  const theta = -Math.PI / 2 + progress * Math.PI * 2;
  return { x: C + r * Math.cos(theta), y: C + r * Math.sin(theta) };
}

export function OrbitalVault({
  balance,
  orbiting,
  totalActive,
  onOpenVault,
}: {
  balance: bigint | null;
  orbiting: OrbitSub[]; // active subs w/ plans, sorted soonest-first
  totalActive: number;
  onOpenVault: () => void;
}) {
  const shown = orbiting.slice(0, MAX_ORBITS);
  const overflow = totalActive - shown.length;

  // charge detection — when a sub's nextPaymentDue advances between polls
  // (that's literally markPaid), flash its ring for a few seconds
  const prevDue = useRef<Map<number, number>>(new Map());
  const [flashing, setFlashing] = useState<Set<number>>(new Set());
  useEffect(() => {
    const next = new Map<number, number>();
    const nowFlashing: number[] = [];
    for (const { sub } of shown) {
      const t = sub.nextPaymentDue.getTime();
      const prev = prevDue.current.get(sub.id);
      if (prev !== undefined && t > prev) nowFlashing.push(sub.id);
      next.set(sub.id, t);
    }
    prevDue.current = next;
    if (nowFlashing.length) {
      // deferred — synchronous setState in an effect cascades renders
      const start = setTimeout(() => setFlashing((s) => new Set([...s, ...nowFlashing])), 0);
      const stop = setTimeout(
        () => setFlashing((s) => new Set([...s].filter((x) => !nowFlashing.includes(x)))),
        3200,
      );
      return () => {
        clearTimeout(start);
        clearTimeout(stop);
      };
    }
  }, [shown]);

  const monthly = shown.reduce((sum, o) => sum + monthlyEquivalent(o.plan.amount, o.plan.intervalSecs), 0n);
  const runway = runwayLabel(balance, monthly);

  return (
    <GlassPanel hairline className="relative">
      <style>{`
        @keyframes ringFlash {
          0% { stroke: rgba(255,255,255,0.95); }
          100% { stroke: rgba(255,255,255,0.1); }
        }
        @keyframes coreBreathe { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }
      `}</style>

      <div className="flex flex-wrap items-center gap-x-12 gap-y-4 px-8 py-7 lg:flex-nowrap">
        {/* ── ground control — the numbers, the promise, the actions ── */}
        <div className="flex min-w-[280px] flex-1 flex-col items-start">
          <p className="text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            Vault — your escrow, always yours
          </p>

          <p className="numeric mt-6 text-5xl font-light text-ink">
            {balance === null ? '—' : formatUSDC(balance)}
            <span className="pl-2 text-lg text-ink-muted">USDC</span>
          </p>

          {runway ? (
            <p className="mt-3 text-xs tracking-[0.06em] text-ink-muted">
              covers everything for {runway}
            </p>
          ) : (
            <p className="mt-3 text-xs tracking-[0.06em] text-ink/90">
              {shown.length === 0
                ? 'fund it once — everything recurring pays itself from here'
                : ' '}
            </p>
          )}
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            withdraw anytime — it never stops being yours
          </p>

          <div className="mt-7 flex gap-2.5">
            <button
              onClick={onOpenVault}
              className="rounded-full bg-ink px-6 py-2.5 text-[11.5px] font-semibold tracking-[0.08em] text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)]"
            >
              Add funds
            </button>
            <button
              onClick={onOpenVault}
              className="rounded-full border border-ink/30 bg-canvas/40 px-6 py-2.5 text-[11.5px] tracking-[0.08em] text-ink backdrop-blur-xl transition hover:border-ink/60"
            >
              Withdraw
            </button>
          </div>

          {shown.length === 0 && (
            <p className="mt-5 text-[11px] text-ink-faint">
              <Link href="/dashboard/discover" className="text-ink-muted underline-offset-4 transition hover:text-ink hover:underline">
                Browse plans
              </Link>{' '}
              to set up your first subscription.
            </p>
          )}
          {overflow > 0 && (
            <Link
              href="/dashboard/subscriptions"
              className="mt-5 text-[10px] tracking-[0.14em] text-ink-faint transition hover:text-ink"
            >
              +{overflow} MORE ORBIT{overflow === 1 ? '' : 'S'} →
            </Link>
          )}
        </div>

        {/* ── the orrery — every cycle, seen from above. An instrument
            with no signal is clutter: it only appears once something
            actually orbits. ── */}
        {shown.length > 0 && (
        <div className="relative mx-auto w-full max-w-[340px] flex-shrink lg:mx-0">
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="block h-auto w-full overflow-visible" aria-hidden>
            <defs>
              <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* the vault core's light — the mark itself is overlaid in HTML */}
            <circle cx={C} cy={C} r={46} fill="url(#core-glow)" style={{ animation: 'coreBreathe 6s ease-in-out infinite' }} />

            {shown.map((o, i) => {
              const r = ringRadius(i);
              const p = cycleProgress(o.sub.nextPaymentDue, o.plan.intervalSecs);
              const moon = ringXY(r, p);
              // fixed legend anchor per ring, alternating east/west,
              // clear of the arcs' start point at the top
              const east = i % 2 === 0;
              const a = ringXY(r, east ? 0.31 : 0.69);
              const isFlashing = flashing.has(o.sub.id);
              return (
                <g key={o.sub.id}>
                  {/* the full lap, faint */}
                  <circle
                    cx={C}
                    cy={C}
                    r={r}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                    style={isFlashing ? { animation: 'ringFlash 3.2s ease-out both' } : undefined}
                  />
                  {/* the elapsed arc — the cycle filling toward its charge */}
                  <circle
                    cx={C}
                    cy={C}
                    r={r}
                    fill="none"
                    stroke={`rgba(255,255,255,${0.6 - i * 0.12})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={`${Math.max(p * 100, 0.5)} 100`}
                    transform={`rotate(-90 ${C} ${C})`}
                  />
                  {/* the moon at the arc's head */}
                  <circle cx={moon.x} cy={moon.y} r={4.5 - i * 0.5} fill="#FFFFFF" opacity={0.95 - i * 0.1} />
                  <circle cx={moon.x} cy={moon.y} r={8.5 - i * 0.5} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                  {/* pinned legend — rings wander, labels don't */}
                  <text
                    x={a.x + (east ? 13 : -13)}
                    y={a.y + 3.5}
                    textAnchor={east ? 'start' : 'end'}
                    fill="rgba(255,255,255,0.55)"
                    fontSize="10.5"
                    letterSpacing="0.1em"
                    style={{ fontFamily: 'var(--font-app-mono), monospace' }}
                  >
                    {`${formatUSDC(o.plan.amount)} · ${timeUntil(o.sub.nextPaymentDue).replace('in ', '')}`}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* the core — the mark at the center of the system it powers,
              turning at its own patient pace */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <RecurraMark size={34} spin />
          </div>
        </div>
        )}
      </div>
    </GlassPanel>
  );
}
