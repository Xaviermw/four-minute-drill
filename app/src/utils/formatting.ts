export function ordinalDown(down: number): string {
  return down === 1 ? "1st" : down === 2 ? "2nd" : down === 3 ? "3rd" : "4th";
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type RatingBand = "elite" | "good" | "solid" | "weak";

/** Maps an overall rating (40-99) to a color band used across player cards. */
export function ratingBand(rating: number): RatingBand {
  if (rating >= 85) return "elite";
  if (rating >= 75) return "good";
  if (rating >= 65) return "solid";
  return "weak";
}
