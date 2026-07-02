import { useState } from "react";
import { useManifest } from "../../data/dataContext";
import { startDrive } from "../../data/startDrive";
import { DriveFieldVisualizer } from "../drive/DriveFieldVisualizer";
import { PlayByPlayFeed } from "../drive/PlayByPlayFeed";
import { SharePanel } from "../../share/SharePanel";
import { SubmitScorePanel } from "../../leaderboard/SubmitScorePanel";
import { useLeaderboardUI } from "../../leaderboard/LeaderboardUI";
import { useGameDispatch, useGameState } from "../../state/GameStateProvider";
import "../drive/drive.css";
import "./result.css";

const END_REASON_TEXT: Record<string, string> = {
  WIN_TOUCHDOWN: "Touchdown!",
  WIN_FIELD_GOAL: "Field goal is good!",
  LOSS_TURNOVER: "Turnover",
  LOSS_TURNOVER_ON_DOWNS: "Turnover on downs",
  LOSS_CLOCK_EXPIRED: "Time expired",
  LOSS_MISSED_FIELD_GOAL: "No good",
};

const END_REASON_SUB: Record<string, string> = {
  WIN_TOUCHDOWN: "You found the end zone.",
  WIN_FIELD_GOAL: "You split the uprights.",
  LOSS_TURNOVER: "The drive ends short.",
  LOSS_TURNOVER_ON_DOWNS: "Couldn't convert. The drive ends short.",
  LOSS_CLOCK_EXPIRED: "The clock beat you.",
  LOSS_MISSED_FIELD_GOAL: "The kick sails wide. The drive ends short.",
};

export function ResultScreen() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const { manifest } = useManifest();
  const { open: openLeaderboard } = useLeaderboardUI();
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  if (state.phase !== "result") return null;
  const { driveLog, roster } = state;
  const lastPlay = driveLog.plays[driveLog.plays.length - 1];
  const finalFieldPosition = lastPlay ? Math.max(0, lastPlay.fieldPosition - lastPlay.outcome.yards) : 50;

  async function handleReplaySameLineup() {
    if (!manifest) return;
    setReplaying(true);
    setReplayError(null);
    try {
      const { scenario, session } = await startDrive(roster, manifest);
      dispatch({ type: "DRIVE_STARTED", roster, scenario, session });
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : String(err));
      setReplaying(false);
    }
  }

  return (
    <div className="screen result-screen">
      <div className={`result-hero ${driveLog.won ? "win" : "loss"}`}>
        <span className="eyebrow">{driveLog.won ? "Drive result" : "Drive over"}</span>
        <h1 className="result-headline">{END_REASON_TEXT[driveLog.endReason]}</h1>
        <p className="result-sub">{END_REASON_SUB[driveLog.endReason]}</p>
        {driveLog.won ? (
          <div className="result-score">
            <span className="result-score-num">+{driveLog.score}</span>
            <span className="result-score-unit">points</span>
          </div>
        ) : (
          <div className="result-score">
            <span className="result-score-num zero">0</span>
            <span className="result-score-unit">points</span>
          </div>
        )}
      </div>

      {driveLog.won && (
        <div className="score-receipt">
          <p className="eyebrow score-receipt-title">How you scored it</p>
          <ul className="score-breakdown-items">
            <li>
              <span>{driveLog.scoreBreakdown.baseLabel}</span>
              <span>{driveLog.scoreBreakdown.basePoints} pts</span>
            </li>
            <li>
              <span>Roster strength bonus</span>
              <span>&times;{driveLog.scoreBreakdown.rosterMultiplier.toFixed(2)}</span>
            </li>
            <li>
              <span>Time bonus · less time left = more</span>
              <span>&times;{driveLog.scoreBreakdown.clockMultiplier.toFixed(2)}</span>
            </li>
            <li className="score-breakdown-total">
              <span>Final score</span>
              <span>{driveLog.scoreBreakdown.total} pts</span>
            </li>
          </ul>
        </div>
      )}

      <p className="roster-credit">
        {roster.qb.displayName} to {roster.wr1.displayName}, {roster.wr2.displayName}, {roster.te.displayName},{" "}
        {roster.rb.displayName} out of the backfield, and {roster.k.displayName} on special teams.
      </p>

      <SubmitScorePanel driveLog={driveLog} roster={roster} onView={openLeaderboard} />

      <SharePanel driveLog={driveLog} roster={roster} />

      <DriveFieldVisualizer fieldPosition={finalFieldPosition} />

      <div className="drive-log">
        <p className="eyebrow drive-log-heading">Drive log</p>
        <PlayByPlayFeed plays={driveLog.plays} />
      </div>

      {replayError && <p className="error">{replayError}</p>}
      <div className="result-actions">
        <button type="button" className="cta-button" disabled={replaying} onClick={handleReplaySameLineup}>
          {replaying ? "Loading…" : "Run It Back"}
        </button>
        <button type="button" className="ghost-button" onClick={() => dispatch({ type: "RESTART" })}>
          New Draft
        </button>
      </div>
    </div>
  );
}
