import { rosterPayoutMultiplier } from "../engine";
import type { DraftedRoster } from "../types/roster";
import type { DriveLog } from "../types/simResult";
import { formatPayout } from "../utils/formatting";
import { encodeLineup, LINEUP_SLOT_ORDER } from "./lineupCode";

/** Short outcome label for the share blurb (distinct from the on-screen copy). */
const OUTCOME_LABEL: Record<string, string> = {
  WIN_TOUCHDOWN: "🟢 Touchdown",
  WIN_FIELD_GOAL: "🟢 Field goal",
  LOSS_TURNOVER: "🔴 Turnover",
  LOSS_TURNOVER_ON_DOWNS: "🔴 Turnover on downs",
  LOSS_CLOCK_EXPIRED: "🔴 Time expired",
  LOSS_MISSED_FIELD_GOAL: "🔴 Missed FG",
};

export function outcomeLabel(endReason: string): string {
  return OUTCOME_LABEL[endReason] ?? endReason;
}

/**
 * Builds the `?team=` share URL for a roster against the current page origin.
 * Returns null when the lineup can't be encoded (no shareable link, but text
 * can still be copied). `origin` is injectable for tests.
 */
export function buildShareUrl(
  roster: DraftedRoster,
  origin: string = typeof window !== "undefined" ? window.location.origin + window.location.pathname : ""
): string | null {
  const token = encodeLineup(roster);
  if (token === null) return null;
  const base = origin.replace(/[?#].*$/, "").replace(/\/$/, "");
  return `${base}/?team=${token}`;
}

/**
 * A Wordle-style emoji grid of the drive: one square per offensive snap, colored
 * by the yards gained, capped off by a marker for how it ended. Kicks/spikes are
 * folded into the terminal marker rather than shown as snaps.
 *
 *   🟩 15+ yds   🟨 4-14   ⬜ 1-3   🟥 stuffed   🏈 TD   ❌ turnover
 *   terminal: 🎯 FG good · 🚫 FG missed · 🛑 turnover on downs · 🏁 clock
 */
export function buildDriveGrid(driveLog: DriveLog): string {
  const squares: string[] = [];
  for (const p of driveLog.plays) {
    if (p.role === "kicker" || p.role === "special") continue; // kicks/spikes -> terminal marker
    if (p.outcome.isTouchdown) squares.push("🏈");
    else if (p.outcome.isTurnover) squares.push("❌");
    else if (p.outcome.yards >= 15) squares.push("🟩");
    else if (p.outcome.yards >= 4) squares.push("🟨");
    else if (p.outcome.yards >= 1) squares.push("⬜");
    else squares.push("🟥");
  }
  const terminal: Partial<Record<string, string>> = {
    WIN_FIELD_GOAL: "🎯",
    LOSS_MISSED_FIELD_GOAL: "🚫",
    LOSS_TURNOVER_ON_DOWNS: "🛑",
    LOSS_CLOCK_EXPIRED: "🏁",
  };
  const marker = terminal[driveLog.endReason];
  if (marker) squares.push(marker);
  return squares.join("");
}

/** First initial + last name, e.g. "Lamar Jackson" -> "L.Jackson". */
function shortName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return displayName;
  const last = parts[parts.length - 1];
  return `${parts[0][0]}.${last}`;
}

/**
 * Wordle/82-0-style shareable summary: a headline with the score, the outcome
 * and team OVR, the six-player lineup, and (when encodable) a "beat it" link.
 */
export function buildShareText(driveLog: DriveLog, roster: DraftedRoster, url = buildShareUrl(roster)): string {
  const payout = formatPayout(rosterPayoutMultiplier(LINEUP_SLOT_ORDER.map((slot) => roster[slot].rating)));
  const scoreLine = driveLog.won ? `${driveLog.score} pts` : "no score";
  const grid = buildDriveGrid(driveLog);
  const lines = [
    `🏈 Four Minute Drill — ${scoreLine}`,
    `${outcomeLabel(driveLog.endReason)} · ${payout} payout squad`,
  ];
  if (grid) lines.push(grid);
  lines.push(
    `QB ${shortName(roster.qb.displayName)}  RB ${shortName(roster.rb.displayName)}  WR ${shortName(
      roster.wr1.displayName
    )}`,
    `WR ${shortName(roster.wr2.displayName)}  TE ${shortName(roster.te.displayName)}  K ${shortName(
      roster.k.displayName
    )}`
  );
  if (url) lines.push(`beat it ▶ ${url}`);
  return lines.join("\n");
}
