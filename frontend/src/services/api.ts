import type { Plan, Subscription } from '@/types';
import { getUsdcAddress } from '@/lib/contracts';

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
  active: boolean;
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

// createPlan() is permissionless on-chain and takes any ERC-20 — but this
// app prices every plan through formatUSDC's 6-decimal assumption and only
// ever funds vaults in USDC. A plan in any other token would render as a
// false "N USDC" (a merchant could list a junk 18-decimal token priced to
// look cheap), so non-USDC plans are dropped here at the boundary, once,
// rather than trusted-but-mislabeled on every page. Case-insensitive:
// the backend checksums addresses; the env var may not be.
const isUsdcPlan = (w: PlanWire): boolean => w.token.toLowerCase() === getUsdcAddress().toLowerCase();

const toPlan = (w: PlanWire): Plan => ({
  id: w.id,
  merchant: w.merchant,
  token: w.token,
  amount: BigInt(w.amount),
  intervalSecs: w.interval_secs,
  active: w.active,
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
    list: async (): Promise<Plan[]> =>
      (await get<PlanWire[]>('/plans')).filter(isUsdcPlan).map(toPlan),
    // Same boundary as list(): a non-USDC plan is "not found" to this app,
    // not a plan we'd display with the wrong currency label.
    get: async (id: number): Promise<Plan> => {
      const wire = await get<PlanWire>(`/plans/${id}`);
      if (!isUsdcPlan(wire)) throw new ApiError(404, `plan ${id} is not a USDC plan`);
      return toPlan(wire);
    },
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
