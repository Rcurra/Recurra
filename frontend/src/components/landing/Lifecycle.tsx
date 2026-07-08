'use client';

import { Reveal } from './Reveal';
import { T } from './tokens';

// The lifecycle of one dollar — Recurra's signature section. Straight from
// CONCEPT.md's "lifecycle of one dollar" diagram: four steps run side by
// side (they read left-to-right, like the flow itself), the fifth — where
// funds actually leave escrow — sits apart below. Every claim here is one
// the contracts actually enforce -- nothing decorative the architecture
// can't honor.

const STEPS = [
  { label: 'YOUR USDC', detail: 'deposit() — you sign, always reversible' },
  { label: 'VAULT', detail: 'escrow. still yours. withdraw() never reverts' },
  { label: 'SCHEDULER: SUB #7 IS DUE', detail: 'the backend — a trigger, never a trustee' },
  { label: 'EXECUTOR VERIFIES ON-CHAIN', detail: 'active? due? funded? exact amount from the plan' },
] as const;

const MERCHANT_STEP = { label: 'MERCHANT', detail: 'funds leave escrow only here' } as const;

function StepCard({
  label,
  detail,
  highlight = false,
  width = '100%',
}: {
  label: string;
  detail: string;
  highlight?: boolean;
  width?: string;
}) {
  return (
    <div
      style={{
        width,
        padding: '13px 18px',
        borderRadius: 12,
        border: `1px solid ${highlight ? T.violetLight : T.border}`,
        background: T.cardGlass,
        textAlign: 'center',
      }}
    >
      <div
        className="numeric"
        style={{
          fontSize: 11.5,
          letterSpacing: '0.1em',
          color: highlight ? T.violetLight : T.text,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: T.faint, marginTop: 6, lineHeight: 1.5 }}>{detail}</div>
    </div>
  );
}

function DownConnector() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: `linear-gradient(${T.border}, ${T.borderBright})`,
        margin: '3px 0',
      }}
    />
  );
}

export function Lifecycle() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '60px 24px 64px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Reveal style={{ textAlign: 'center', maxWidth: 640 }}>
        <h2
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(26px, 3.6vw, 44px)',
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: '0.01em',
            textTransform: 'uppercase',
            margin: 0,
            color: T.headline,
          }}
        >
          The lifecycle of one dollar
        </h2>
        <p style={{ fontSize: 14.5, color: T.dim, margin: '16px 0 0', lineHeight: 1.6 }}>
          Every payment follows the same steps, checked on-chain before any money
          moves — so no server, not even ours, ever has to be trusted with your funds.
        </p>
      </Reveal>

      <Reveal delay={0.15} style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
            width: '100%',
            maxWidth: 560,
          }}
        >
          {STEPS.map((step, i) => (
            <StepCard key={step.label} label={step.label} detail={step.detail} highlight={i === 3} />
          ))}
        </div>

        <DownConnector />

        <StepCard label={MERCHANT_STEP.label} detail={MERCHANT_STEP.detail} width="min(92vw, 274px)" />
      </Reveal>

      <Reveal delay={0.3} style={{ marginTop: 26, textAlign: 'center' }}>
        <p
          className="numeric"
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            color: T.dim,
            margin: 0,
          }}
        >
          withdraw the rest — anytime, to the cent
        </p>
        <p
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(16px, 2vw, 20px)',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            color: T.mint,
            margin: '10px 0 0',
          }}
        >
          Max exposure to any merchant, ever: one billing cycle
        </p>
      </Reveal>
    </section>
  );
}
