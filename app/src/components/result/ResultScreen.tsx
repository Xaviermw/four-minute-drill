import { useEffect, useRef, useState, type CSSProperties } from "react";
import { trackEvent } from "../../analytics/track";
import { useManifest } from "../../data/dataContext";
import { startDrive } from "../../data/startDrive";
import { DriveRecap } from "./DriveRecap";
import { SharePanel } from "../../share/SharePanel";
import { SubmitScorePanel } from "../../leaderboard/SubmitScorePanel";
import { getStoredName, recordDrive, type StreakUpdate } from "../../leaderboard/leaderboardApi";
import { isNameAllowed } from "../../leaderboard/nameFilter";
import { useLeaderboardUI } from "../../leaderboard/LeaderboardUI";
import { useGameDispatch, useGameState } from "../../state/GameStateProvider";
import { useMode } from "../../state/ModeProvider";
import { isRookie, markRookieDone } from "../../state/rookie";
import { LINEUP_SLOT_ORDER } from "../../share/lineupCode";
import { formatChallengeDate } from "../../daily/dailyChallenge";
import { dailyStreakDisplay, recordDailyWin, type DailyStreakState } from "../../daily/dailyStreak";
import { DailyStreakBadge, FreeStreakBanner } from "./StreakBanners";
import { burstConfetti } from "../../utils/confetti";
import { useCountUp } from "../../utils/useCountUp";
import type { DriveLog } from "../../types/simResult";
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
  const { mode, challengeId, saveDaily, markSubmitted, setMode } = useMode();
  const isDaily = mode === "daily";
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [freeStreak, setFreeStreak] = useState<StreakUpdate | null>(null);
  const [daily, setDaily] = useState<{ days: number; best: number; state: DailyStreakState } | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  // Was this the rookie's first-ever drive? Captured at mount, BEFORE the record
  // effect graduates them -- drives the "Play Today's Drill" conversion CTA.
  const wasRookie = useRef(isRookie()).current;
  // Count up the actual score -- a scoreless drive still banks marginal yardage
  // points, so a "loss" can land above zero.
  const displayScore = useCountUp(state.phase === "result" ? state.driveLog.score : 0);
  // Celebrate a win once (StrictMode-safe via the drive-log-identity ref).
  const confettiLog = useRef<DriveLog | null>(null);
  useEffect(() => {
    if (state.phase !== "result" || !state.driveLog.won) return;
    if (confettiLog.current === state.driveLog) return;
    confettiLog.current = state.driveLog;
    if (heroRef.current) burstConfetti(heroRef.current);
  }, [state]);
  // Record each finished drive exactly once (guarded by drive-log identity so
  // re-renders / StrictMode don't double-count). Daily drives are banked to the
  // one-shot record + the daily-day streak; free-play drives feed the win-streak
  // board (whose updated value we show back to the player).
  const recordedLog = useRef<DriveLog | null>(null);
  useEffect(() => {
    if (state.phase !== "result") return;
    if (recordedLog.current === state.driveLog) return;
    recordedLog.current = state.driveLog;
    trackEvent("drive_completed", {
      mode,
      won: state.driveLog.won,
      endReason: state.driveLog.endReason,
      score: state.driveLog.score,
      rookie: wasRookie,
    });
    // Any completed drive graduates a rookie: the daily unlocks as the default
    // and the teaching hints retire from the next drive on.
    markRookieDone();
    if (mode === "daily") {
      saveDaily({
        challengeId,
        driveLog: state.driveLog,
        rosterIds: LINEUP_SLOT_ORDER.map((slot) => state.roster[slot].gsisId),
        submitted: false,
      });
      if (state.driveLog.won) recordDailyWin(challengeId);
      setDaily(dailyStreakDisplay(challengeId, state.driveLog.won));
    } else {
      // Don't propagate a disallowed stored name to the streak row; the server
      // keeps the prior/Anonymous name when we send "".
      const storedName = getStoredName();
      void recordDrive(state.driveLog, isNameAllowed(storedName) ? storedName : "").then(setFreeStreak);
    }
  }, [state, mode, challengeId, saveDaily, wasRookie]);

  if (state.phase !== "result") return null;
  const { driveLog, roster } = state;
  const lastPlay = driveLog.plays[driveLog.plays.length - 1];

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
      <div ref={heroRef} className={`result-hero ${driveLog.won ? "win" : "loss"}`}>
        <span className="eyebrow">
          {isDaily ? `Today's Drill · ${formatChallengeDate(challengeId)}` : driveLog.won ? "Drive result" : "Drive over"}
        </span>
        <h1 className="result-headline">{END_REASON_TEXT[driveLog.endReason]}</h1>
        <p className="result-sub">{END_REASON_SUB[driveLog.endReason]}</p>
        <div className="result-score">
          <span className={`result-score-num ${driveLog.score > 0 ? "" : "zero"}`}>
            {driveLog.score > 0 ? `+${displayScore}` : "0"}
          </span>
          <span className="result-score-unit">points</span>
        </div>
      </div>

      {!driveLog.won && lastPlay && <p className="fatal-play">{lastPlay.description}</p>}

      {daily && <DailyStreakBadge days={daily.days} best={daily.best} state={daily.state} />}
      {freeStreak && <FreeStreakBanner streak={freeStreak} />}

      {driveLog.won ? (
        <div className="score-receipt">
          <p className="eyebrow score-receipt-title">How you scored it</p>
          <ul className="score-breakdown-items">
            <li style={{ "--i": 0 } as CSSProperties}>
              <span>{driveLog.scoreBreakdown.baseLabel}</span>
              <span>{driveLog.scoreBreakdown.basePoints} pts</span>
            </li>
            <li style={{ "--i": 1 } as CSSProperties}>
              <span>Time bonus · less time left = more</span>
              <span>&times;{driveLog.scoreBreakdown.clockMultiplier.toFixed(2)}</span>
            </li>
            <li className="score-breakdown-total" style={{ "--i": 2 } as CSSProperties}>
              <span>Final score</span>
              <span>{driveLog.scoreBreakdown.total} pts</span>
            </li>
          </ul>
        </div>
      ) : driveLog.score > 0 ? (
        // Scoreless drive that still banked yardage points.
        <div className="score-receipt">
          <p className="eyebrow score-receipt-title">Credit for the drive</p>
          <ul className="score-breakdown-items">
            <li style={{ "--i": 0 } as CSSProperties}>
              <span>Drive · {driveLog.scoreBreakdown.driveYards} yds advanced</span>
              <span>{driveLog.scoreBreakdown.drivePoints} pts</span>
            </li>
            <li className="score-breakdown-total" style={{ "--i": 1 } as CSSProperties}>
              <span>Final score</span>
              <span>{driveLog.scoreBreakdown.total} pts</span>
            </li>
          </ul>
        </div>
      ) : null}

      <SubmitScorePanel
        driveLog={driveLog}
        roster={roster}
        onView={openLeaderboard}
        challengeId={isDaily ? challengeId : null}
        onSubmitted={isDaily ? markSubmitted : undefined}
      />

      <SharePanel driveLog={driveLog} roster={roster} />

      {replayError && <p className="error">{replayError}</p>}
      {!isDaily && wasRookie ? (
        // The conversion moment: practice is done, funnel them into the daily
        // while they're warm. This is the whole point of the rookie drive.
        <div className="continue-cta rookie-cta">
          <p className="continue-cta-hook">
            {driveLog.won
              ? "Practice is over — and you're already scoring. Today's Drill counts."
              : "That was practice. The real one's waiting — everyone gets the same board."}
          </p>
          <button type="button" className="cta-button continue-cta-button" onClick={() => setMode("daily")}>
            Play Today's Drill →
          </button>
          <button type="button" className="ghost-button" onClick={() => dispatch({ type: "RESTART" })}>
            One more practice
          </button>
        </div>
      ) : isDaily ? (
        <div className="result-actions">
          <button type="button" className="cta-button" onClick={openLeaderboard}>
            Today's Leaderboard
          </button>
          <button type="button" className="ghost-button" onClick={() => setMode("free")}>
            Play Free Mode
          </button>
        </div>
      ) : driveLog.won ? (
        // Won in Free Play -> push hard to run it back and grow the streak.
        <div className="continue-cta">
          <p className="continue-cta-hook">
            {freeStreak && freeStreak.streak_wins >= 2
              ? `${freeStreak.streak_wins} in a row · ${freeStreak.streak_points} pts banked — keep the streak alive.`
              : "On the board! Run it back and start a win streak."}
          </p>
          <button type="button" className="cta-button continue-cta-button" disabled={replaying} onClick={handleReplaySameLineup}>
            {replaying ? "Loading…" : "Run It Back →"}
          </button>
          <button type="button" className="ghost-button" onClick={() => dispatch({ type: "RESTART" })}>
            New Draft
          </button>
        </div>
      ) : (
        <div className="result-actions">
          <button type="button" className="cta-button" disabled={replaying} onClick={handleReplaySameLineup}>
            {replaying ? "Loading…" : "Run It Back"}
          </button>
          <button type="button" className="ghost-button" onClick={() => dispatch({ type: "RESTART" })}>
            New Draft
          </button>
        </div>
      )}

      <DriveRecap driveLog={driveLog} />
    </div>
  );
}
