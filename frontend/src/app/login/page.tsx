'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithEmail } from '@/features/auth';
import { CadenceRing } from '@/components/CadenceRing';
import { Ambient } from '@/components/Ambient';

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
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-6">
      <Ambient />

      <div className="relative w-full max-w-sm">
        {/* the pulse, oversized and faint, floating behind the panel */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 opacity-25">
          <CadenceRing progress={0.72} size={280} strokeWidth={1.5} />
        </div>

        <div className="relative rounded-2xl border border-line bg-surface/80 p-8 backdrop-blur-xl">
          <div className="mb-8 flex flex-col items-center">
            <div className="breathe mb-6">
              <CadenceRing progress={0.72} size={56} strokeWidth={3} />
            </div>
            <h1 className="text-xl font-semibold tracking-[0.25em] text-ink">RECURRA</h1>
            <p className="mt-1.5 text-sm text-ink-muted">Set it. Forget it. Own it.</p>
          </div>

          <label htmlFor="email" className="mb-2 block text-xs uppercase tracking-wider text-ink-faint">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && email && handleLogin()}
            className="mb-4 w-full rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
          />
          <button
            onClick={handleLogin}
            disabled={loading || !email}
            className="w-full rounded-lg bg-mint px-6 py-3 text-sm font-medium text-canvas transition hover:brightness-110 disabled:opacity-40"
          >
            {loading ? 'Checking your email…' : 'Continue with email'}
          </button>

          {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          No seed phrase. No downloads. Just your email.
        </p>
      </div>
    </main>
  );
}
