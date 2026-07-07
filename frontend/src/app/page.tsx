'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithEmail } from '@/features/auth';

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
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-2">Recurra</h1>
      <p className="text-zinc-500 mb-8 text-sm">Set it. Forget it. Own it.</p>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 rounded w-80 mb-4"
      />
      <button
        onClick={handleLogin}
        disabled={loading || !email}
        className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Checking your email…' : 'Continue with email'}
      </button>
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </main>
  );
}
