'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithEmail } from '@/features/auth';
import { CadenceRing } from '@/components/CadenceRing';

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="breathe mb-8">
          <CadenceRing progress={0.72} size={72} strokeWidth={3.5} />
        </div>

        <h1 className="mb-2 text-2xl font-semibold tracking-[0.25em] text-ink">RECURRA</h1>
        <p className="mb-12 text-sm text-ink-muted">Set it. Forget it. Own it.</p>

        <label htmlFor="email" className="mb-2 w-full text-xs uppercase tracking-wider text-ink-faint">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && email && handleLogin()}
          className="mb-4 w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
        />
        <button
          onClick={handleLogin}
          disabled={loading || !email}
          className="w-full rounded-lg bg-mint px-6 py-3 text-sm font-medium text-canvas transition hover:brightness-110 disabled:opacity-40"
        >
          {loading ? 'Checking your email…' : 'Continue with email'}
        </button>

        <p className="mt-6 text-xs text-ink-faint">No seed phrase. No downloads. Just your email.</p>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>
    </main>
  );
}
