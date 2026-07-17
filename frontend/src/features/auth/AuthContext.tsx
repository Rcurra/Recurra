'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loginWithEmail, logout as logoutFn, restoreSession } from '@/lib/magic';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  address: string | null;
  // Display-only (see lib/magic.ts's Session type) — never gate trust
  // decisions on this, Magic's own session is the real source of truth.
  // Surfaces which account is active so Settings/the login screen can show
  // something a human can actually tell accounts apart by, instead of a
  // truncated address.
  email: string | null;
  status: AuthStatus;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Session state, app-wide. Mounted once at the root layout so both the
// login screen and the dashboard route guard read the same source of
// truth — restoreSession() is the real check (asks Magic itself in the
// real-auth path, not just a cached localStorage value), run once on boot.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((session) => {
        if (cancelled) return;
        setAddress(session?.address ?? null);
        setEmail(session?.email ?? null);
        setStatus(session ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string) => {
    const session = await loginWithEmail(email); // throws on failure — caller shows the error
    setAddress(session.address);
    setEmail(session.email);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logoutFn();
    setAddress(null);
    setEmail(null);
    setStatus('unauthenticated');
  }, []);

  return <AuthContext.Provider value={{ address, email, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
