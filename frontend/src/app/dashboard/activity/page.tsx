import { redirect } from 'next/navigation';

// Activity moved into the Subscriptions page (third tab). Anyone landing
// on the old URL — stale browser tab, old bookmark — gets taken there
// instead of a 404.
export default function ActivityRedirect() {
  redirect('/dashboard/subscriptions?tab=activity');
}
