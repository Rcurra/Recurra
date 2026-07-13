// Display-edge formatting — the ONLY place bigints/dates become strings.
// Amounts stay bigint (USDC 6 decimals) everywhere else, per the design rule.

const USDC_DECIMALS = 1_000_000n;

export function formatUSDC(amount: bigint): string {
  const whole = amount / USDC_DECIMALS;
  const cents = (amount % USDC_DECIMALS) / 10_000n; // 2 decimal places
  return `${whole}.${cents.toString().padStart(2, '0')}`;
}

// The input-edge counterpart — a user-typed "10.5" into the smallest-unit
// bigint the contracts speak. Null on anything that isn't a plain decimal
// (rejects negative/scientific/garbage instead of silently coercing it).
export function parseUSDC(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  return BigInt(whole) * USDC_DECIMALS + BigInt(frac.padEnd(6, '0'));
}

// Plain helper (not a component) so callers can check "is this due" without
// calling Date.now() directly in a render body (react-hooks/purity).
export function isPastDue(date: Date): boolean {
  return date.getTime() <= Date.now();
}

// "Coming up soon" — independent of whether the vault can cover it (that's
// isPastDue + a balance check's job, see the under-funded banner). This is
// pure advance notice: a fully-funded subscriber should still see a charge
// coming before it fires. Window scales with the plan's own cadence (20% of
// the interval) so a daily plan doesn't warn a day early and a monthly plan
// doesn't warn a minute early, capped at 24h so a yearly plan doesn't warn
// two months out.
export function isUpcoming(nextPaymentDue: Date, intervalSecs: number): boolean {
  const msUntilDue = nextPaymentDue.getTime() - Date.now();
  if (msUntilDue <= 0) return false; // already due — isPastDue's territory
  const thresholdMs = Math.min(24 * 60 * 60 * 1000, intervalSecs * 1000 * 0.2);
  return msUntilDue <= thresholdMs;
}

// Human time, per the microcopy law: "in 12 days", never timestamps.
export function timeUntil(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return 'due now';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} days`;
}

// Human time for the past, mirrors timeUntil for the future — same
// microcopy law, never a raw timestamp.
export function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  if (ms <= 0) return 'just now';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

// How far through the current billing cycle we are: 0 just charged, 1 due.
export function cycleProgress(nextPaymentDue: Date, intervalSecs: number): number {
  const remainingMs = nextPaymentDue.getTime() - Date.now();
  const intervalMs = intervalSecs * 1000;
  if (intervalMs <= 0) return 1;
  return Math.min(Math.max(1 - remainingMs / intervalMs, 0), 1);
}

// Normalize a plan's price to a 30-day month for comparison — display
// math only, never used for a real charge (amounts come from the plan
// on-chain, always).
export function monthlyEquivalent(amount: bigint, intervalSecs: number): bigint {
  return (amount * 2_592_000n) / BigInt(Math.max(intervalSecs, 1));
}

// The runway sentence — balance ÷ 30-day-normalized commitments, spoken
// in human time. Null when there's nothing to say (no balance yet, or no
// active commitments to measure against). Display math only.
export function runwayLabel(balance: bigint | null, monthly: bigint): string | null {
  if (balance === null || monthly <= 0n) return null;
  const totalDays = Number((balance * 30n) / monthly);
  if (totalDays < 1) return 'not enough for the next charge';
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  if (months > 0) {
    return `${months} month${months === 1 ? '' : 's'}${days > 0 ? ` ${days} day${days === 1 ? '' : 's'}` : ''}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function intervalLabel(intervalSecs: number): string {
  const day = 86_400;
  if (intervalSecs % (30 * day) === 0) {
    const months = intervalSecs / (30 * day);
    return months === 1 ? 'month' : `${months} months`;
  }
  if (intervalSecs % (7 * day) === 0) {
    const weeks = intervalSecs / (7 * day);
    return weeks === 1 ? 'week' : `${weeks} weeks`;
  }
  if (intervalSecs % day === 0) {
    const days = intervalSecs / day;
    return days === 1 ? 'day' : `${days} days`;
  }
  return `${intervalSecs}s`;
}
