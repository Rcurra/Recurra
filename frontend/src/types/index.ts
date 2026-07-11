// App-facing shapes. The backend speaks snake_case JSON with string amounts;
// services/api.ts translates at the boundary so everything past it is
// idiomatic TS: camelCase, bigint amounts (USDC 6-decimals, formatted only
// at the display edge), real Date objects.

export interface Plan {
  id: number;
  merchant: string; // checksummed address
  token: string; // ERC-20 address
  amount: bigint; // token smallest units per interval
  intervalSecs: number;
  // Merchant kill switch (deactivatePlan). False means new subscribe()
  // calls revert PlanNotActive — a browse list must filter on this.
  active: boolean;
}

export interface Subscription {
  id: number;
  planId: number;
  subscriber: string; // checksummed address
  // Always null in v1: session keys live at the ZeroDev account layer,
  // never on-chain (M0). Field kept because the API keeps it for shape
  // stability.
  sessionKey: string | null;
  nextPaymentDue: Date;
  active: boolean;
}
