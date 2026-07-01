import type { CreateSubscriptionPayload, Subscription } from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  subscriptions: {
    list: () => request<Subscription[]>('/subscriptions'),
    get: (id: number) => request<Subscription>(`/subscriptions/${id}`),
    create: (payload: CreateSubscriptionPayload) =>
      request<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(payload) }),
    cancel: (id: number) =>
      request<void>(`/subscriptions/${id}`, { method: 'DELETE' }),
  },
};
