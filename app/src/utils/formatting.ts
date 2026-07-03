export function ordinalDown(down: number): string {
  return down === 1 ? "1st" : down === 2 ? "2nd" : down === 3 ? "3rd" : "4th";
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Football-convention ball spot from yards-to-end-zone (yardline_100). */
export function formatBallOn(fieldPosition: number): string {
  if (fieldPosition > 50) return `OWN ${100 - fieldPosition}`;
  if (fieldPosition === 50) return "MIDFIELD";
  return `AWAY ${fieldPosition}`;
}

/** Formats a payout multiplier for display, e.g. 1.8 -> "×1.8". */
export function formatPayout(multiplier: number): string {
  return `×${multiplier.toFixed(1)}`;
}

export type PayoutBand = "hot" | "mid" | "low";

/** Buckets a payout multiplier (1.0–2.0) for coloring: bigger payout = hotter,
 * so the enticing underdog picks pop and the safe stars read muted. Rounds to
 * the displayed 1-decimal value first so color and shown number never disagree
 * at a boundary (e.g. ×1.6 is always the same band). */
export function payoutBand(multiplier: number): PayoutBand {
  const shown = Math.round(multiplier * 10) / 10;
  if (shown >= 1.6) return "hot";
  if (shown >= 1.3) return "mid";
  return "low";
}
