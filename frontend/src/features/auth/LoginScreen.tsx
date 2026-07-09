'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RecurraMark } from '@/components/RecurraMark';
import { Starfield } from '@/components/Starfield';
import { useAuth } from './AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Login = Magic email OTP, nothing else. Zero signatures — browsing is free;
// the 7702 upgrade + session key happen lazily at first subscribe (F4).
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email);
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

      {/* same nav as the landing: mark + name, glass pill, links home */}
      <Link
        href="/"
        className="fixed top-[18px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-line bg-surface/75 px-[18px] py-2 backdrop-blur-[10px]"
      >
        <RecurraMark size={28} />
        <span className="numeric text-sm font-semibold tracking-[0.16em] text-ink">RECURRA</span>
      </Link>

      <div className="relative z-10 w-full max-w-sm">
        <div
          className="relative overflow-hidden rounded-2xl border border-line bg-surface/75 p-8 backdrop-blur-xl"
          style={{ animation: 'fadeUp 0.7s ease both' }}
        >
          {/* gradient hairline, same signature as the vault card */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, var(--mint), var(--violet), transparent)' }}
          />

          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5" style={{ animation: 'fadeUp 0.7s ease both 0.1s' }}>
              <RecurraMark size={64} spin />
            </div>
            <div style={{ animation: 'fadeUp 0.7s ease both 0.18s' }}>
              <p className="numeric mb-2 text-[10px] uppercase tracking-[0.28em] text-ink-faint">
                Welcome to Recurra
              </p>
              <h1 className="text-xl font-semibold text-ink">Sign in with email</h1>
              <p className="numeric mt-2 text-[11.5px] leading-relaxed tracking-[0.06em] text-ink-muted">
                One email. One signature, later.
                <br />
                Payments run themselves after that.
              </p>
            </div>
          </div>

          <div style={{ animation: 'fadeUp 0.7s ease both 0.26s' }}>
            <label htmlFor="email" className="numeric mb-2 block text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              autoFocus
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && email && handleLogin()}
              className="mb-4 w-full rounded-xl border border-line bg-canvas/80 px-4 py-3.5 text-sm text-ink transition placeholder:text-ink-faint focus:border-mint/60 focus:shadow-[0_0_0_3px_rgba(0,229,160,0.08)] focus:outline-none"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading || !email}
            className="w-full rounded-xl bg-mint px-6 py-3.5 text-sm font-semibold text-canvas transition hover:shadow-[0_6px_24px_-8px_var(--mint)] hover:brightness-110 disabled:opacity-40 disabled:hover:shadow-none"
            style={{ animation: 'fadeUp 0.7s ease both 0.34s' }}
          >
            {loading ? 'Checking your email…' : 'Continue'}
          </button>

          {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}

          <div className="mt-7 border-t border-line pt-5" style={{ animation: 'fadeUp 0.7s ease both 0.42s' }}>
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

        <p
          className="numeric mt-6 text-center text-[10px] uppercase tracking-[0.2em] text-ink-faint"
          style={{ animation: 'fadeUp 0.7s ease both 0.5s' }}
        >
          Powered by Magic · secured by your inbox
        </p>
      </div>
    </main>
  );
}
