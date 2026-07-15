'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GlassPanel } from '@/components/GlassPanel';
import { InlineError } from '@/components/InlineError';
import { LoadingLine } from '@/components/LoadingLine';
import { TickerLine } from '@/components/TickerLine';
import { RecurraMark } from '@/components/RecurraMark';
import { Starfield } from '@/components/Starfield';
import { useAuth } from './AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// If the login service never answers (bad network, blocked provider —
// found live: carrier hotspots 403 at Magic's edge and the SDK just
// hangs), surface it instead of spinning forever.
const LOGIN_TIMEOUT_MS = 30_000;

// Login = Magic email OTP, nothing else. Zero signatures — browsing is
// free; the 7702 upgrade + session key happen lazily at first subscribe
// (F4). Black & white glass, same universe as the landing.
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  // A just-succeeded login flips AuthContext's status to 'authenticated'
  // the instant the OTP resolves — a render or two before router.push()
  // actually finishes navigating away. Without this flag, that gap shows
  // the welcome-back card ("you're already signed in") for a genuinely
  // fresh login, which reads as if the OTP was skipped. Found live
  // 2026-07-14. Set only on the success path, deliberately never reset —
  // this component unmounts on navigation, so there's nothing to reset for.
  const [redirecting, setRedirecting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Two error channels, deliberately: the form shows only login errors,
  // the welcome-back card only sign-out errors. Found live: a login that
  // timed out but then SUCCEEDED in the background flipped the view to
  // welcome-back with the stale timeout complaint still showing — an
  // error about a login that worked, on a screen it didn't belong to.
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { login, logout, status, address } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    if (!EMAIL_PATTERN.test(email)) {
      setLoginError('Enter a valid email address');
      return;
    }
    setLoading(true);
    setLoginError(null);
    try {
      await Promise.race([
        login(email),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('login-timeout')), LOGIN_TIMEOUT_MS),
        ),
      ]);
      // Success: swap straight to the redirecting state, never back to the
      // idle form — router.push below unmounts this screen shortly after,
      // so `loading` has no legitimate false state left to reach.
      setRedirecting(true);
      router.push('/dashboard');
    } catch (err) {
      setLoading(false);
      setLoginError(
        err instanceof Error && err.message === 'login-timeout'
          ? "Couldn't reach the login service. Check your connection and try again — hotspots and VPNs sometimes block it."
          : err instanceof Error
            ? err.message
            : 'Login failed',
      );
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await Promise.race([
        logout(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('logout-timeout')), 10_000),
        ),
      ]);
      // fresh form after a real sign-out — no leftovers from last time
      setLoginError(null);
      setEmail('');
    } catch {
      setSignOutError("Couldn't reach the login service to sign out. Check your connection and try again.");
    } finally {
      setSigningOut(false);
    }
  }

  // A live session isn't silently redirected — that's disorienting and
  // hides the only way to switch accounts. Say it, and offer the choice.
  // Excludes `redirecting`: a login that just succeeded IS an
  // already-authenticated status the instant it resolves, but it isn't a
  // "you were already signed in" situation — it's this exact action
  // finishing. Different screen, same underlying boolean.
  const welcomeBack = status === 'authenticated' && address && !redirecting;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-6">
      <Starfield stars={320} shootingStars orbit nebula />

      {/* same anatomy as the landing: just the mark, floating top-left,
          linking home. No bar — the universe owns the top edge. */}
      <Link
        href="/"
        aria-label="Back to the landing page"
        className="fixed top-[22px] left-[clamp(20px,4vw,48px)] z-20 flex"
        style={{ lineHeight: 0 }}
      >
        <RecurraMark size={30} spin />
      </Link>

      <div className="relative z-10 w-full max-w-sm">
        <GlassPanel hairline className="p-8" style={{ animation: 'fadeUp 0.7s ease both' }}>
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5" style={{ animation: 'fadeUp 0.7s ease both 0.1s' }}>
              <RecurraMark size={64} spin />
            </div>
            <div style={{ animation: 'fadeUp 0.7s ease both 0.18s' }}>
              {/* the grand welcome — first words anyone reads in the app,
                  wearing the light sweep */}
              <p className="shimmer mb-2.5 text-[11.5px] uppercase tracking-[0.34em]">
                Welcome to Recurra
              </p>
              <h1
                className="text-lg text-ink"
                style={{ fontFamily: 'var(--font-display), sans-serif', letterSpacing: '0.08em' }}
              >
                {redirecting ? 'Verified' : welcomeBack ? 'Welcome back' : 'Sign in'}
              </h1>
              {redirecting ? (
                <p className="mt-3 text-[12px] font-light leading-relaxed tracking-[0.04em] text-ink-muted">
                  Taking you to your dashboard
                </p>
              ) : welcomeBack ? (
                <p className="mt-3 text-[12px] font-light leading-relaxed tracking-[0.04em] text-ink-muted">
                  You&rsquo;re already signed in as
                  <br />
                  <span className="numeric text-ink">{`${address.slice(0, 6)}…${address.slice(-4)}`}</span>
                </p>
              ) : (
                <p className="mt-3 text-[12px] font-light leading-relaxed tracking-[0.04em] text-ink-muted">
                  One email. One signature, later.
                  <br />
                  Payments run themselves after that.
                </p>
              )}
            </div>
          </div>

          {redirecting ? (
            <div style={{ animation: 'fadeUp 0.3s ease both' }}>
              <LoadingLine label="loading your dashboard…" />
            </div>
          ) : welcomeBack ? (
            <div style={{ animation: 'fadeUp 0.7s ease both 0.26s' }}>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold tracking-[0.06em] text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)]"
              >
                Continue to dashboard
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="mt-3 w-full rounded-xl border border-line bg-canvas/50 px-6 py-3 text-[12px] font-light tracking-[0.06em] text-ink-muted transition hover:border-ink/30 hover:text-ink disabled:opacity-50"
              >
                {signingOut ? 'Signing out…' : 'Sign out & use a different email'}
              </button>
              {signOutError && (
                <div className="mt-4" style={{ animation: 'fadeUp 0.3s ease both' }}>
                  <InlineError message={signOutError} />
                </div>
              )}
            </div>
          ) : (
            <>
          <div style={{ animation: 'fadeUp 0.7s ease both 0.26s' }}>
            <label htmlFor="email" className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              autoFocus
              disabled={loading}
              onChange={(e) => {
                setEmail(e.target.value);
                if (loginError) setLoginError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && email && !loading && handleLogin()}
              className="mb-4 w-full rounded-xl border border-line bg-canvas/70 px-4 py-3.5 text-sm text-ink transition placeholder:text-ink-faint focus:border-ink/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06)] focus:outline-none disabled:opacity-60"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading || !email}
            className="w-full rounded-xl bg-ink px-6 py-3.5 text-sm font-semibold tracking-[0.06em] text-canvas transition hover:shadow-[0_6px_28px_-8px_rgba(255,255,255,0.5)] disabled:opacity-40 disabled:hover:shadow-none"
            style={{ animation: 'fadeUp 0.7s ease both 0.34s' }}
          >
            {loading ? 'Checking your email…' : 'Continue'}
          </button>

          <p className="mt-3 text-center text-[10.5px] font-light tracking-[0.06em] text-ink-faint">
            We&rsquo;ll email you a one-time code — no password, ever.
          </p>

          {loginError && (
            <div className="mt-4" style={{ animation: 'fadeUp 0.3s ease both' }}>
              <InlineError message={loginError} />
            </div>
          )}
            </>
          )}

          {/* the selling point, streaming — the card's closing line rides
              the ticker (its own hairlines stand in for a divider) */}
          <div className="mt-7" style={{ animation: 'fadeUp 0.7s ease both 0.42s' }}>
            <TickerLine message="No seed phrase · Fees covered · Withdraw anytime" />
          </div>
        </GlassPanel>

        {/* the credit line earns its billing — we're proud of the stack */}
        <p
          className="mt-6 text-center text-[11px] uppercase tracking-[0.22em] text-ink/80"
          style={{ animation: 'fadeUp 0.7s ease both 0.5s' }}
        >
          Powered by Magic · secured by your inbox
        </p>
      </div>
    </main>
  );
}
