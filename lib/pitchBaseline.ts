/**
 * Pitch-deck baseline figures — "Pitch Deck Omelo · May 2026".
 *
 * These numbers are layered ON TOP of the live database values:
 *
 *     displayed = realAccumulated + baseline
 *
 * So every headline reads at deck levels today and keeps climbing as real
 * data lands in the DB (a live demo ticks upward). To change what the
 * dashboard shows, edit ONE number here — nothing else in the app
 * hardcodes these figures.
 *
 * Rates (check-in %, retention %) have nothing to "accumulate", so they are
 * displayed as the deck value directly via PITCH_RATES.
 */
export const PITCH_BASELINE = {
  /** deck: "Conversations 130K+"  → added to real total_messages */
  conversations: 130_000,
  /** deck: "Pets registered 10,300+" → added to real total_pets */
  petsRegistered: 10_300,
  /** deck: "DAU 1,900" → added to real daily-active-users */
  dau: 1_900,
  /** deck: "WAU 3,100" → real WAU isn't tracked, so this shows as-is */
  wau: 3_100,
  /** deck: "MAU 4,050" → added to real monthly-active-users */
  mau: 4_050,
  /** new signups on the last day → added to real */
  newUsersLastDay: 120,
  /** returning users on the last day → added to real */
  returningUsersLastDay: 1_150,
} as const;

export const PITCH_RATES = {
  /** deck: "Daily check-in rate 60%" */
  dailyCheckIn: 60,
  /** deck: "Week 3 retention 46%" */
  week3Retention: 46,
  /** onboarding completion % shown on the Onboarding card */
  onboardingCompletion: 88,
} as const;

/**
 * Total Users is scaled to Pets Registered: multi-pet households mean slightly
 * fewer parents than pets. Tune the ratio to move the headline together with
 * the pets figure (10,300 pets × 0.87 ≈ 9,000 users).
 */
export const PITCH_USERS_PER_PET = 0.87;
export function pitchTotalUsers(): number {
  return Math.round(PITCH_BASELINE.petsRegistered * PITCH_USERS_PER_PET);
}

/** Add a deck baseline on top of a live value, tolerating null/undefined. */
export function withBaseline(real: number | null | undefined, baseline: number): number {
  return (real ?? 0) + baseline;
}
