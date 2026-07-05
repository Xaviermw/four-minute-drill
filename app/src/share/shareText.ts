import type { DraftedRoster } from "../types/roster";
import type { DriveLog } from "../types/simResult";
import { CAP } from "../draft/pricing";
import { encodeGhostParam } from "./ghost";
import { encodeLineup } from "./lineupCode";

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
 * When a drive log (and optionally the sharer's name) is provided, the link
 * also carries the ghost -- the exact (seed, choices) of that drive -- so the
 * receiver races it. Returns null when the lineup can't be encoded (no
 * shareable link, but text can still be copied). `origin` is injectable for tests.
 */
export function buildShareUrl(
  roster: DraftedRoster,
  origin: string = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "",
  driveLog?: DriveLog,
  sharerName?: string
): string | null {
  const token = encodeLineup(roster);
  if (token === null) return null;
  const base = origin.replace(/[?#].*$/, "").replace(/\/$/, "");
  let url = `${base}/?team=${token}`;
  const ghost = driveLog ? encodeGhostParam(driveLog) : null;
  if (ghost) {
    url += `&g=${ghost}`;
    const name = sharerName?.trim().slice(0, 20);
    if (name) url += `&by=${encodeURIComponent(name)}`;
  }
  return url;
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
 * and cap spend, the six-player lineup, and (when encodable) a race-my-drive
 * link carrying the ghost. `spend` is the team's total salary; when omitted
 * the cap line is dropped. Pass `url: null` to omit the link.
 */
export function buildShareText(
  driveLog: DriveLog,
  roster: DraftedRoster,
  spend?: number,
  url: string | null | undefined = undefined,
  cap = CAP,
  sharerName?: string
): string {
  if (url === undefined) url = buildShareUrl(roster, undefined, driveLog, sharerName);
  const scoreLine = driveLog.score > 0 ? `${driveLog.score} pts` : "no score";
  const grid = buildDriveGrid(driveLog);
  const lines = [`🏈 Four Minute Drill — ${scoreLine}`];
  if (spend !== undefined) {
    lines.push(`${outcomeLabel(driveLog.endReason)} · built for $${spend} of $${cap}`);
    if (spend < cap) lines.push(`💰 $${cap - spend} under the cap`);
  } else {
    lines.push(outcomeLabel(driveLog.endReason));
  }
  if (grid) lines.push(grid);
  lines.push(
    `QB ${shortName(roster.qb.displayName)}  RB ${shortName(roster.rb.displayName)}  WR ${shortName(
      roster.wr1.displayName
    )}`,
    `WR ${shortName(roster.wr2.displayName)}  TE ${shortName(roster.te.displayName)}  K ${shortName(
      roster.k.displayName
    )}`
  );
  if (url) lines.push(`${url.includes("&g=") ? "race my drive" : "beat it"} ▶ ${url}`);
  return lines.join("\n");
}
