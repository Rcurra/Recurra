'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithEmail } from '@/features/auth';
import { RecurraMark } from '@/components/RecurraMark';
import { Starfield } from '@/components/Starfield';

// Login = Magic email OTP, nothing else. Zero signatures — browsing is free;
// the 7702 upgrade + session key happen lazily at first subscribe (F4).
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const address = await loginWithEmail(email);
      localStorage.setItem('recurra_address', address);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-6">
      <Starfield />

      {/* same nav as the landing: just the mark and the name */}
      <nav className="fixed top-[22px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5">
        <RecurraMark size={28} />
        <span className="numeric text-sm font-semibold tracking-[0.16em] text-ink">RECURRA</span>
      </nav>

      <div className="relative z-10 w-full max-w-sm" style={{ animation: 'fadeUp 0.8s ease both' }}>
        <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/75 p-8 backdrop-blur-xl">
          {/* gradient hairline, same signature as the vault card */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, var(--mint), var(--violet), transparent)' }}
          />

          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5">
              <RecurraMark size={64} spin />
            </div>
            <p className="numeric mb-2 text-[10px] uppercase tracking-[0.28em] text-ink-faint">
              Welcome to Recurra
            </p>
            <h1 className="text-xl font-semibold text-ink">Sign in with email</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              One email. One signature, later.
              <br />
              Payments run themselves after that.
            </p>
          </div>

          <label htmlFor="email" className="numeric mb-2 block text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && email && handleLogin()}
            className="mb-4 w-full rounded-xl border border-line bg-canvas/80 px-4 py-3.5 text-sm text-ink transition placeholder:text-ink-faint focus:border-mint/60 focus:shadow-[0_0_0_3px_rgba(0,229,160,0.08)] focus:outline-none"
          />
          <button
            onClick={handleLogin}
            disabled={loading || !email}
            className="w-full rounded-xl bg-mint px-6 py-3.5 text-sm font-semibold text-canvas transition hover:shadow-[0_6px_24px_-8px_var(--mint)] hover:brightness-110 disabled:opacity-40 disabled:hover:shadow-none"
          >
            {loading ? 'Checking your email…' : 'Continue'}
          </button>

          {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}

          <div className="mt-7 border-t border-line pt-5">
            <div className="flex items-center justify-center gap-4">
              {['No seed phrase', 'Fees covered', 'Withdraw anytime'].map((line) => (
                <span key={line} className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                  <span className="h-1 w-1 rounded-full bg-mint/70" />
                  {line}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="numeric mt-6 text-center text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Powered by Magic · secured by your inbox
        </p>
      </div>
    </main>
  );
}
