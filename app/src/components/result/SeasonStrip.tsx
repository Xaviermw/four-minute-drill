import { useEffect, useState } from "react";
import { formatChallengeDate } from "../../daily/dailyChallenge";
import { fetchMySeason, isSeasonLive, SEASON_LABEL, SEASON_START, type SeasonRow } from "../../leaderboard/leaderboardApi";
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
