'use client';

import { useEffect, useRef, useState } from 'react';
import type { Subscription } from '@/types';

export type ChargeEvent = { id: number; sub: Subscription };

// The charge moment, detected from data alone — no websocket, no event
// stream: nextPaymentDue advancing between polls IS a payment having fired
// (markPaid runs right before debit on-chain), so whatever triggers
// executePayment (the scheduler), this detection doesn't change. Extracted
// from the Subscriptions page (2026-07-15) so any screen wanting to react
// to a charge landing shares one polling-diff implementation instead of
// each reimplementing it.
//
// `justCharged` holds a sub's id for ~4.5s after its charge is detected —
// long enough for a glow/pulse to read, short enough to feel momentary.
// `chargeEvents` is the toast queue: each entry self-removes after 5s.
export function useChargeDetection(subscriptions: Subscription[]) {
  const prevDueRef = useRef<Map<number, number>>(new Map());
  const [justCharged, setJustCharged] = useState<Set<number>>(new Set());
  const [chargeEvents, setChargeEvents] = useState<ChargeEvent[]>([]);

  useEffect(() => {
    const prev = prevDueRef.current;
    const next = new Map<number, number>();
    const charged: Subscription[] = [];
    for (const s of subscriptions) {
      const dueMs = s.nextPaymentDue.getTime();
      next.set(s.id, dueMs);
      const prevMs = prev.get(s.id);
      if (prevMs !== undefined && dueMs > prevMs) charged.push(s);
    }
    prevDueRef.current = next;
    if (charged.length === 0) return;

    // Deferred a tick (react-hooks/set-state-in-effect) — don't call
    // setState synchronously inside the effect body.
    setTimeout(() => {
      setJustCharged((old) => {
        const merged = new Set(old);
        charged.forEach((s) => merged.add(s.id));
        return merged;
      });
      charged.forEach((s) => {
        const eventId = Date.now() + s.id;
        setChargeEvents((old) => [...old, { id: eventId, sub: s }]);
        setTimeout(() => {
          setChargeEvents((old) => old.filter((e) => e.id !== eventId));
        }, 5000);
      });
    }, 0);

    charged.forEach((s) => {
      setTimeout(() => {
        setJustCharged((old) => {
          const copy = new Set(old);
          copy.delete(s.id);
          return copy;
        });
      }, 4500);
    });
  }, [subscriptions]);

  return { justCharged, chargeEvents };
}
