import type { StreakUpdate } from "../../leaderboard/leaderboardApi";
import type { DailyStreakState } from "../../daily/dailyStreak";
import "./result.css";

/** Free-play win-streak feedback: shows the active run on a win, or the run
 * that just ended on a loss. */
export function FreeStreakBanner({ streak }: { streak: StreakUpdate }) {
  if (streak.won) {
    if (streak.streak_wins < 1) return null;
    const isBest = streak.streak_points === streak.best_points && streak.streak_wins >= 2;
    return (
      <div className="streak-banner active">
        🔥{" "}
        {streak.streak_wins === 1
          ? "Win streak started"
          : `${streak.streak_wins}-win streak · ${streak.streak_points} pts banked`}
        {isBest && <span className="streak-best"> · new best!</span>}
      </div>
    );
  }
  if (streak.streak_wins >= 1) {
    return (
      <div className="streak-banner ended">
        Streak over — you’d banked <strong>{streak.streak_points}</strong> over {streak.streak_wins} win
        {streak.streak_wins === 1 ? "" : "s"}.
      </div>
    );
  }
  return null;
}

/** Wordle-style daily-day streak feedback. */
export function DailyStreakBadge({ days, best, state }: { days: number; best: number; state: DailyStreakState }) {
  if (state === "active") {
    return (
      <div className="streak-banner active">
        🔥 {days === 1 ? "Daily streak started — Day 1" : `${days}-day daily streak!`}
        {best > days && <span className="streak-best"> · best {best}</span>}
      </div>
    );
  }
  if (state === "ended") {
    return (
      <div className="streak-banner ended">
        💔 Your <strong>{days}-day</strong> daily streak ends here.
      </div>
    );
  }
  return null;
}
