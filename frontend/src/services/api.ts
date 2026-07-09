import type { Plan, Subscription } from '@/types';

// The ONLY file that talks to the backend. Two jobs:
// 1. GET-only, structurally: the API is a read-only index layer (M0) —
//    user-authority writes go through the wallet, never through HTTP.
//    There is deliberately no POST/DELETE helper here.
// 2. Boundary translation: the backend emits snake_case JSON with string
//    amounts and ISO timestamps; app code receives camelCase, bigint, Date.

// Same-origin by default — next.config.ts proxies /api/* to the backend,
// which sidesteps CORS entirely (the Rust API has no CORS layer, and the
// browser blocks cross-port fetches curl happily allows).
const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

// Wire shapes — mirror backend/src/models/mod.rs exactly. Touch only in
// lockstep with a backend model change.
interface PlanWire {
  id: number;
  merchant: string;
  token: string;
  amount: string;
  interval_secs: number;
}

interface SubscriptionWire {
  id: number;
  plan_id: number;
  subscriber: string;
  session_key: string | null;
  next_payment_due: string;
  active: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const toPlan = (w: PlanWire): Plan => ({
  id: w.id,
  merchant: w.merchant,
  token: w.token,
  amount: BigInt(w.amount),
  intervalSecs: w.interval_secs,
});

const toSubscription = (w: SubscriptionWire): Subscription => ({
  id: w.id,
  planId: w.plan_id,
  subscriber: w.subscriber,
  sessionKey: w.session_key,
  nextPaymentDue: new Date(w.next_payment_due),
  active: w.active,
});

export const api = {
  plans: {
    list: async (): Promise<Plan[]> => (await get<PlanWire[]>('/plans')).map(toPlan),
    get: async (id: number): Promise<Plan> => toPlan(await get<PlanWire>(`/plans/${id}`)),
  },
  subscriptions: {
    // `subscriber` filters server-side (the cheap per-subscriber path);
    // omitting it walks every subscription — dashboard should always pass it.
    list: async (subscriber?: string): Promise<Subscription[]> => {
      const query = subscriber ? `?subscriber=${encodeURIComponent(subscriber)}` : '';
      return (await get<SubscriptionWire[]>(`/subscriptions${query}`)).map(toSubscription);
    },
    get: async (id: number): Promise<Subscription> =>
      toSubscription(await get<SubscriptionWire>(`/subscriptions/${id}`)),
  },
};
