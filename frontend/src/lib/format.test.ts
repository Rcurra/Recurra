import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cycleProgress,
  formatUSDC,
  intervalLabel,
  monthlyEquivalent,
  shortAddress,
  timeAgo,
  timeUntil,
} from './format';

// The display-math layer is the only place bigints/dates become strings —
// exactly the code where an off-by-one turns into a wrong balance on
// screen. Pure functions, so they get real tests.

describe('formatUSDC', () => {
  it('formats whole amounts', () => {
    expect(formatUSDC(10_000_000n)).toBe('10.00');
  });
  it('pads cents', () => {
    expect(formatUSDC(10_050_000n)).toBe('10.05');
  });
  it('handles zero', () => {
    expect(formatUSDC(0n)).toBe('0.00');
  });
  it('truncates below a cent (never invents money)', () => {
    expect(formatUSDC(10_009_999n)).toBe('10.00');
  });
  it('handles large escrows without float loss', () => {
    expect(formatUSDC(123_456_789_000_000n)).toBe('123456789.00');
  });
});

describe('time words', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('timeUntil: due now when past', () => {
    expect(timeUntil(new Date('2026-07-09T11:00:00Z'))).toBe('due now');
  });
  it('timeUntil: minutes, then hours, then days', () => {
    expect(timeUntil(new Date('2026-07-09T12:30:00Z'))).toBe('in 30 minutes');
    expect(timeUntil(new Date('2026-07-09T15:00:00Z'))).toBe('in 3 hours');
    expect(timeUntil(new Date('2026-07-14T12:00:00Z'))).toBe('in 5 days');
  });
  it('timeAgo mirrors timeUntil into the past', () => {
    expect(timeAgo(new Date('2026-07-09T11:30:00Z'))).toBe('30 minutes ago');
    expect(timeAgo(new Date('2026-07-09T09:00:00Z'))).toBe('3 hours ago');
    expect(timeAgo(new Date('2026-07-04T12:00:00Z'))).toBe('5 days ago');
  });
});

describe('cycleProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('is 0 just after a charge', () => {
    const due = new Date('2026-08-08T12:00:00Z'); // full 30d interval remaining
    expect(cycleProgress(due, 30 * 86_400)).toBeCloseTo(0, 5);
  });
  it('is 0.5 mid-cycle', () => {
    const due = new Date('2026-07-24T12:00:00Z'); // 15 of 30 days left
    expect(cycleProgress(due, 30 * 86_400)).toBeCloseTo(0.5, 5);
  });
  it('clamps at 1 when overdue', () => {
    expect(cycleProgress(new Date('2026-07-01T00:00:00Z'), 30 * 86_400)).toBe(1);
  });
});

describe('intervalLabel', () => {
  it('names months, weeks, days', () => {
    expect(intervalLabel(30 * 86_400)).toBe('month');
    expect(intervalLabel(90 * 86_400)).toBe('3 months');
    expect(intervalLabel(7 * 86_400)).toBe('week');
    expect(intervalLabel(86_400)).toBe('day');
  });
  it('falls back to raw seconds (the 60s demo plan)', () => {
    expect(intervalLabel(60)).toBe('60s');
  });
});

describe('monthlyEquivalent', () => {
  it('is identity for a 30-day plan', () => {
    expect(monthlyEquivalent(10_000_000n, 30 * 86_400)).toBe(10_000_000n);
  });
  it('scales a weekly plan up', () => {
    // 5 USDC/week ≈ 21.43 USDC/month (30/7)
    expect(monthlyEquivalent(5_000_000n, 7 * 86_400)).toBe(21_428_571n);
  });
  it('never divides by zero', () => {
    expect(monthlyEquivalent(1_000_000n, 0)).toBe(2_592_000_000_000n);
  });
});

describe('shortAddress', () => {
  it('keeps the checksummed head and tail', () => {
    expect(shortAddress('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC')).toBe('0x3C44…93BC');
  });
});
