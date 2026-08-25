import { useEffect, useState } from "react";
import { formatChallengeDate } from "../../daily/dailyChallenge";
import {
  fetchMySeason,
  hasReminder,
  isNetworkError,
  isSeasonLive,
  SEASON_LABEL,
  SEASON_START,
  subscribeReminder,
  type SeasonRow,
} from "../../leaderboard/leaderboardApi";
import { isLeaderboardEnabled } from "../../leaderboard/supabaseClient";

/**
 * "Your season" -- the number tomorrow's visit feeds (docs/season-score-spec.md).
 * Accumulation framing only: what you've built, never what you missed (the
 * daily streak carries the attendance pressure). Pre-season it teases opening
 * day; in-season it shows the running total + rank, refetching after a submit.
 */
export function SeasonStrip({
  challengeId,
  refreshKey,
  onView,
}: {
  challengeId: string;
  refreshKey: number;
  onView: () => void;
}) {
  const [mine, setMine] = useState<{ row: SeasonRow; rank: number | null } | null | undefined>(undefined);
  const live = isSeasonLive(challengeId);
  // Opening-day reminder (owner call 2026-08-24): one email, no list. State
  // is per device -- once asked, the form never reappears.
  const [email, setEmail] = useState("");
  const [reminder, setReminder] = useState<"idle" | "saving" | "done" | "error">(() => (hasReminder() ? "done" : "idle"));
  const [reminderError, setReminderError] = useState<string | null>(null);

  async function askForReminder(e: React.FormEvent) {
    e.preventDefault();
    setReminder("saving");
    setReminderError(null);
    try {
      await subscribeReminder(email);
      setReminder("done");
    } catch (err) {
      setReminder("error");
      setReminderError(
        isNetworkError(err) ? "Can't reach the server right now — try again in a bit." : err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  useEffect(() => {
    if (!isLeaderboardEnabled || !live) return;
    let cancelled = false;
    fetchMySeason()
      .then((d) => !cancelled && setMine(d))
      .catch(() => !cancelled && setMine(null));
    return () => {
      cancelled = true;
    };
  }, [live, refreshKey]);

  if (!isLeaderboardEnabled) return null;

  if (!live) {
    const daysOut = Math.max(0, Math.ceil((Date.parse(`${SEASON_START}T04:00:00Z`) - Date.now()) / 86_400_000));
    return (
      <div className="season-strip pre">
        <span className="season-strip-label">{SEASON_LABEL}</span>
        <span className="season-strip-body">
          Kicks off in <b>{daysOut} day{daysOut === 1 ? "" : "s"}</b> ({formatChallengeDate(SEASON_START)}). Today
          is a warm-up — from opening day, every daily adds to your season total.
        </span>
        {reminder === "done" ? (
          <span className="season-remind-done">✓ You're on the list — one email on opening day, then we forget you.</span>
        ) : (
          <form className="season-remind" onSubmit={askForReminder}>
            <input
              type="email"
              className="season-remind-input"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="Email for the opening-day reminder"
            />
            <button type="submit" className="season-remind-button" disabled={reminder === "saving"}>
              {reminder === "saving" ? "…" : "Remind me on opening day"}
            </button>
            <span className="season-remind-fine">One email. That's it.</span>
            {reminderError && <span className="season-remind-error">{reminderError}</span>}
          </form>
        )}
      </div>
    );
  }
  if (!mine) return null; // nothing recorded yet this season (or still loading)

  const { row, rank } = mine;
  return (
    <button type="button" className="season-strip live" onClick={onView}>
      <span className="season-strip-label">{SEASON_LABEL}</span>
      <span className="season-strip-body">
        <b>{row.season_points.toLocaleString()} pts</b> · {row.days_played} drill{row.days_played === 1 ? "" : "s"}
        {rank !== null ? (
          <>
            {" "}
            · <b>#{rank}</b>
          </>
        ) : (
          <> · unranked — name your next daily to claim a spot</>
        )}
      </span>
      <span className="season-strip-cta">Season table ▸</span>
    </button>
  );
}
