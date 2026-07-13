'use client';

import { GlassPanel } from '@/components/GlassPanel';
import { Reveal } from './Reveal';
import { T } from './tokens';

// Built on — one line per sponsor stack, straight from CONCEPT.md's
// "where each stack lives" table. Wordmark-free, same restraint as the
// hero's old partner strip: the names carry it, not logos.

const STACK = [
  { name: 'Magic', role: 'Email login → smart account, no seed phrase' },
  { name: 'ZeroDev', role: 'Session keys — the "sign once" of the pitch' },
  { name: 'Openfort', role: 'TEE signing — the executor key never in plaintext' },
  { name: 'Particle', role: 'Fund the vault from any chain' },
  { name: 'Arbitrum', role: 'Where the ledger and the law live' },
] as const;

export function BuiltOn() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '40px 24px 100px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Reveal style={{ textAlign: 'center' }}>
        <p
                    style={{
            fontSize: 11,
            letterSpacing: '0.24em',
            color: T.faint,
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Built on
        </p>
      </Reveal>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginTop: 28,
          width: '100%',
          maxWidth: 980,
        }}
      >
        {STACK.map((s, i) => (
          <Reveal key={s.name} delay={i * 0.06}>
            <GlassPanel as="div" style={{ height: '100%', padding: '18px 20px', borderRadius: 12, textAlign: 'left' }}>
              <div style={{ fontSize: 13, letterSpacing: '0.06em', color: T.text, fontWeight: 600 }}>
                {s.name}
              </div>
              <div style={{ fontSize: 12.5, color: T.dim, marginTop: 6, lineHeight: 1.5 }}>{s.role}</div>
            </GlassPanel>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
