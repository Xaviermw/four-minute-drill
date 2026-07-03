import { useEffect, useState } from "react";
import { useManifest } from "../data/dataContext";
import { useLeaderboardUI } from "../leaderboard/LeaderboardUI";
import { SubmitScorePanel } from "../leaderboard/SubmitScorePanel";
import { SharePanel } from "../share/SharePanel";
import { rosterFromIdList } from "../share/sharedLineup";
import { useMode } from "../state/ModeProvider";
import { formatChallengeDate, secondsUntilNextChallenge } from "./dailyChallenge";
import type { DailyRecord } from "./dailyState";
import "../components/result/result.css";
import "./daily.css";

function formatCountdown(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Shown when the player has already used today's one shot: their result, a
 * chance to share / submit if they haven't, and a countdown to the next drill. */
export function DailyDone({ record }: { record: DailyRecord }) {
  const { manifest } = useManifest();
  const { challengeId, setMode, markSubmitted } = useMode();
  const { open: openLeaderboard } = useLeaderboardUI();
  const [remaining, setRemaining] = useState(() => secondsUntilNextChallenge());

  useEffect(() => {
    const t = setInterval(() => setRemaining(secondsUntilNextChallenge()), 1000);
    return () => clearInterval(t);
  }, []);

  const { driveLog } = record;
  const roster = manifest ? rosterFromIdList(record.rosterIds, manifest) : null;

  return (
    <div className="screen result-screen">
      <div className={`result-hero ${driveLog.won ? "win" : "loss"}`}>
        <span className="eyebrow">Today's Drill · {formatChallengeDate(challengeId)}</span>
        <h1 className="result-headline">{driveLog.won ? "That's a wrap for today" : "Better luck tomorrow"}</h1>
        <p className="result-sub">You get one shot at the daily.</p>
        <div className="result-score">
          <span className={`result-score-num ${driveLog.won ? "" : "zero"}`}>
            {driveLog.won ? `+${driveLog.score}` : "0"}
          </span>
          <span className="result-score-unit">points</span>
        </div>
      </div>

      {roster ? (
        <>
          {!record.submitted && (
            <SubmitScorePanel
              driveLog={driveLog}
              roster={roster}
              onView={openLeaderboard}
              challengeId={challengeId}
              onSubmitted={markSubmitted}
            />
          )}
          <SharePanel driveLog={driveLog} roster={roster} />
        </>
      ) : (
        <p className="hint">This lineup can no longer be displayed.</p>
      )}

      <p className="daily-countdown">
        Next drill in <strong>{formatCountdown(remaining)}</strong>
      </p>

      <div className="result-actions">
        <button type="button" className="cta-button" onClick={openLeaderboard}>
          Today's Leaderboard
        </button>
        <button type="button" className="ghost-button" onClick={() => setMode("free")}>
          Play Free Mode
        </button>
      </div>
    </div>
  );
}
