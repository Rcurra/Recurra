'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Subscription } from '@/types';

// Read hook over the backend's per-subscriber path. Cancel is NOT here:
// unsubscribe is a user-signed wallet transaction (arrives at F3 via the
// signer abstraction) — after any write, call refetch(); the chain via the
// backend is the only truth.
//
// loading starts true and flips false when the first fetch settles;
// refetch() re-runs the effect via a nonce instead of calling setState
// synchronously inside it (react-hooks/set-state-in-effect). Refetches
// are deliberately background — the stale list stays visible while the
// fresh one loads, no flash.
export function useSubscriptions(subscriber: string | null) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!subscriber) return;
    let cancelled = false;
    api.subscriptions
      .list(subscriber) // server-side filter — the cheap path
      .then((list) => {
        if (cancelled) return;
        setSubscriptions(list);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subscriber, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { subscriptions, loading, error, refetch };
}
