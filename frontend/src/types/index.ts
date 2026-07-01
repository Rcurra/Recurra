export interface Plan {
  id: number;
  merchant: string;
  token: string;
  amount: string;     // wei string
  intervalSecs: number;
}

export interface Subscription {
  id: number;
  planId: number;
  subscriber: string;
  sessionKey: string;
  nextPaymentDue: string; // ISO 8601 datetime
  active: boolean;
}

export interface CreateSubscriptionPayload {
  planId: number;
  subscriber: string;
  sessionKey: string;
}
