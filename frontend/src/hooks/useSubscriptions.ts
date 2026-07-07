'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Subscription } from '@/types';

// Read hook over the backend's per-subscriber path. Cancel is NOT here:
// unsubscribe is a user-signed wallet transaction (arrives at F3 via the
// signer abstraction) — after any write, call refetch(); the chain via the
// backend is the only truth.
export function useSubscriptions(subscriber: string | null) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!subscriber) return;
    setLoading(true);
    setError(null);
    api.subscriptions
      .list(subscriber) // server-side filter — the cheap path
      .then(setSubscriptions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [subscriber]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { subscriptions, loading, error, refetch };
}
