'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Subscription } from '@/types';

export function useSubscriptions(subscriber: string | null) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subscriber) return;
    setLoading(true);
    api.subscriptions
      .list()
      .then((data) => setSubscriptions(data.filter((s) => s.subscriber === subscriber)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [subscriber]);

  const cancel = async (id: number) => {
    await api.subscriptions.cancel(id);
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  };

  return { subscriptions, loading, error, cancel };
}
