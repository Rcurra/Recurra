'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptions } from '@/features/subscriptions';

export default function DashboardPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const addr = localStorage.getItem('ua_address');
    if (!addr) { router.push('/'); return; }
    setAddress(addr);
  }, [router]);

  const { subscriptions, loading, error, cancel } = useSubscriptions(address);

  if (loading) return <p className="p-8">Loading...</p>;
  if (error) return <p className="p-8 text-red-500">{error}</p>;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Your Subscriptions</h1>
      {subscriptions.length === 0 ? (
        <p className="text-zinc-500">No active subscriptions.</p>
      ) : (
        <ul className="space-y-4">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="border rounded p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">Plan #{sub.planId}</p>
                <p className="text-sm text-zinc-500">
                  Next payment: {new Date(sub.nextPaymentDue).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => cancel(sub.id)}
                className="text-red-500 text-sm hover:underline"
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
