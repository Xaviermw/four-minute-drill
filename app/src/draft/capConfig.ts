import { CAP } from "./pricing";

/** A day's cap, plus an optional theme label shown on the draft. */
export interface CapConfig {
  cap: number;
  label?: string;
}

/**
 * Theme-day specials keyed by challenge date (YYYY-MM-DD, ET) — e.g. a
 * "$15 Tightwad Tuesday". Empty by default: every daily uses the standard $25.
 * Add an entry to schedule a variant; nothing else changes (prices are
 * rank-based and cap-independent — only affordability and the displayed cap
 * move). Owner picks the calendar.
 */
const SPECIALS: Record<string, CapConfig> = {
  // "2026-09-15": { cap: 15, label: "Tightwad Tuesday" },
};

/** The cap (and optional theme label) for a challenge. Free play (null) always
 * uses the standard cap. `specials` is injectable for tests. */
export function capForChallenge(
  challengeId: string | null,
  specials: Record<string, CapConfig> = SPECIALS
): CapConfig {
  if (challengeId && specials[challengeId]) return specials[challengeId];
  return { cap: CAP };
}
