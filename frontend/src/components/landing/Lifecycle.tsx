'use client';

import { Reveal } from './Reveal';
import { T } from './tokens';

// The lifecycle of one dollar — Recurra's signature section. Straight from
// CONCEPT.md's "lifecycle of one dollar" diagram: a vertical mono-type flow,
// hairline connectors, no code-block styling. Every claim here is one the
// contracts actually enforce -- nothing decorative the architecture can't honor.

const STEPS = [
  { label: 'YOUR USDC', detail: 'deposit() — you sign, always reversible' },
  { label: 'VAULT', detail: 'escrow. still yours. withdraw() never reverts for policy reasons' },
  { label: 'SCHEDULER SEES: SUB #7 IS DUE', detail: 'the backend — a trigger, never a trustee' },
  { label: 'EXECUTOR VERIFIES ON-CHAIN', detail: 'active? due? funded? exact amount from the plan, never from calldata' },
  { label: 'MERCHANT', detail: 'funds leave escrow only here' },
] as const;

function Connector() {
  return (
    <div
      style={{
        width: 1,
        height: 30,
        background: `linear-gradient(${T.border}, ${T.borderBright})`,
        margin: '2px 0',
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
        padding: '80px 24px 100px',
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
          Every payment retraces the same path — the executor re-derives it from
          on-chain state, so no off-chain party ever has to be trusted with the money.
        </p>
      </Reveal>

      <Reveal delay={0.15} style={{ marginTop: 56, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {STEPS.map((step, i) => (
          <div key={step.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: 'min(92vw, 460px)',
                padding: '16px 22px',
                borderRadius: 12,
                border: `1px solid ${i === 3 ? T.violetLight : T.border}`,
                background: T.cardGlass,
                textAlign: 'center',
              }}
            >
              <div
                className="numeric"
                style={{
                  fontSize: 12.5,
                  letterSpacing: '0.14em',
                  color: i === 3 ? T.violetLight : T.text,
                  fontWeight: 600,
                }}
              >
                {step.label}
              </div>
              <div style={{ fontSize: 12.5, color: T.faint, marginTop: 6, lineHeight: 1.5 }}>{step.detail}</div>
            </div>
            {i < STEPS.length - 1 && <Connector />}
          </div>
        ))}
      </Reveal>

      <Reveal delay={0.3} style={{ marginTop: 40, textAlign: 'center' }}>
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
