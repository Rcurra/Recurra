'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loginWithEmail, logout as logoutFn, restoreSession } from '@/lib/magic';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  address: string | null;
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
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((addr) => {
        if (cancelled) return;
        setAddress(addr);
        setStatus(addr ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string) => {
    const addr = await loginWithEmail(email); // throws on failure — caller shows the error
    setAddress(addr);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logoutFn();
    setAddress(null);
    setStatus('unauthenticated');
  }, []);

  return <AuthContext.Provider value={{ address, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
