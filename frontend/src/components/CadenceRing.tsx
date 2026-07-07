import { useId } from 'react';

// The Pulse — Recurra's signature element. A thin arc that fills across the
// billing cycle: empty just after a charge, full when the next one is due.
// It only ever animates something true (nextPaymentDue progress), per the
// design rule: nothing decorative the architecture can't honor.
export function CadenceRing({
  progress,
  size = 44,
  strokeWidth = 3,
  breathing = false,
}: {
  progress: number; // 0 = just charged, 1 = due now
  size?: number;
  strokeWidth?: number;
  breathing?: boolean;
}) {
  const gradientId = useId();
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`-rotate-90${breathing ? ' breathe' : ''}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--mint)" />
          <stop offset="100%" stopColor="var(--violet)" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--line)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        strokeLinecap="round"
      />
    </svg>
  );
}
