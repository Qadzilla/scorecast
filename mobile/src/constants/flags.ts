// Build-time feature flags.
//
// PRIZE_POOL_ENABLED — the prize pool (entry fees + payouts) is hidden for the
// v1 App Store submission so the app matches the "no stakes, bragging rights"
// store listing and avoids a real-money-gaming review flag. Flip to `true` in a
// later update to bring it back (backend + components all remain in place).
export const PRIZE_POOL_ENABLED = false;
