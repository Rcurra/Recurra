'use client';

import { GlassPanel } from '@/components/GlassPanel';
import { Reveal } from './Reveal';
import { T } from './tokens';

// The two sides — subscriber and merchant, one card each. Copy comes from
// CONCEPT.md (trust model + the four flows); the cards restate it, they
// don't invent claims the contracts can't honor.

const SIDES = [
  {
    title: 'For subscribers',
    intro:
      'Sign in with your email, subscribe with one signature, and your funds sit in an escrow that stays yours. Every charge is verified on-chain before money moves — and whatever hasn’t been charged is withdrawable to the cent, anytime.',
    steps: [
      'Email login → smart account, no seed phrase',
      'One signature → a scoped, capped session key',
      'Fund escrow → payments run themselves',
      'Cancel + withdraw → anytime, no approval needed',
    ],
  },
  {
    title: 'For merchants',
    intro:
      'Create a plan — token, amount, interval — and get paid on schedule without chasing anyone. Each charge executes against the plan stored on-chain: amount and recipient enforced by contract, never by a server that could be wrong or hacked.',
    steps: [
      'Create a plan → token · amount · interval',
      'Subscribers fund their own escrow',
      'Get paid on schedule, on-chain',
      'Amounts come from your plan, never from calldata',
    ],
  },
] as const;

export function TwoSides() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '120px 24px 60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Reveal style={{ textAlign: 'center', maxWidth: 720 }}>
        <h2
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(20px, 2.6vw, 32px)',
            fontWeight: 400,
            lineHeight: 1.2,
            letterSpacing: '0.06em',
            margin: 0,
            color: T.headline,
          }}
        >
          Automated, but never trusted
        </h2>
        <p
                    style={{
            fontSize: 12,
            color: T.dim,
            letterSpacing: '0.18em',
            margin: '18px 0 0',
            textTransform: 'uppercase',
          }}
        >
          A scheduler triggers payments · the contracts verify every one
        </p>
      </Reveal>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
          marginTop: 56,
          width: '100%',
          maxWidth: 960,
        }}
      >
        {SIDES.map((side, i) => (
          <Reveal key={side.title} delay={i * 0.12}>
            <GlassPanel as="div" style={{ height: '100%', padding: '30px 28px', textAlign: 'left' }}>
              <h3
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  margin: 0,
                  color: T.text,
                }}
              >
                {side.title}
              </h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: T.dim, margin: '14px 0 22px' }}>
                {side.intro}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {side.steps.map((step) => (
                  <div
                    key={step}
                                        style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 14px',
                      borderRadius: 10,
                      border: `1px solid ${T.border}`,
                      fontSize: 11.5,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: T.dim,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: T.text,
                        flexShrink: 0,
                      }}
                    />
                    {step}
                  </div>
                ))}
              </div>
            </GlassPanel>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
