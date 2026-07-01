// Auth feature barrel — re-exports everything consumers need.
// Keep heavy SDK imports inside the individual modules so they're tree-shaken.
export { getMagic, loginWithEmail, logout } from '@/lib/magic';
export { createUniversalAccount } from '@/lib/particle';
