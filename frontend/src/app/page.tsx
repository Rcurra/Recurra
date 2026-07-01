'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithEmail, getMagic } from '@/features/auth';
import { createUniversalAccount } from '@/lib/particle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true);
    try {
      await loginWithEmail(email);
      const magicProvider = await getMagic().wallet.getProvider();
      const { address } = await createUniversalAccount(magicProvider);
      localStorage.setItem('ua_address', address);
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-2">Recurra</h1>
      <p className="text-zinc-500 mb-8 text-sm">Fund once. Approve once. Pay forever.</p>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 rounded w-80 mb-4"
      />
      <button
        onClick={handleLogin}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Sending link...' : 'Login with Magic'}
      </button>
    </main>
  );
}
