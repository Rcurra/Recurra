// Vault feature barrel — the Overview hero card and the open vault (modal).
// VaultDoor, VaultPanel, and EscrowChart all retired with the black & white
// glass redesign: the door's job dissolved into the modal's plain column,
// the panel's into VaultHero, and the chart faked data it labelled PREVIEW
// — it returns when GET /payments gives it something true. OrbitalVault
// (the orbit-per-subscription visualization VaultHero replaced) retired
// 2026-07-17 — it stopped reading as a system and started reading as
// clutter with more than a couple of subscriptions active, capped at
// showing only 3 anyway.
export { VaultHero } from './VaultHero';
export { VaultModal } from './VaultModal';
