// Auth feature barrel — re-exports everything consumers need.
// Login is Magic ONLY (email OTP → EOA). The Particle UA is NOT part of
// auth — it appears solely inside the fund step (F6, flag-gated).
export { AuthProvider, useAuth } from './AuthContext';
export { LoginScreen } from './LoginScreen';
export { AccountChip } from './AccountChip';
