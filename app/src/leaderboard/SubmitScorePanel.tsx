import { useState } from "react";
import { trackEvent } from "../analytics/track";
import type { DraftedRoster } from "../types/roster";
import { finalFieldPosition, type DriveLog } from "../types/simResult";
import {
  buildSubmission,
  fetchDailyDrivePercentile,
  getStoredName,
  setStoredName,
  submitScore,
} from "./leaderboardApi";
import { isNameAllowed } from "./nameFilter";
import { isLeaderboardEnabled } from "./supabaseClient";
import "./leaderboard.css";

/**
 * Shown when the leaderboard is configured: a short name input + submit. Free
 * play only takes winning scores; the Daily takes every completed drive (so a
 * loss still lands on the "Longest drives" board). On success it shows the rank
 * (a win) or how far the drive ranked (a loss), and locks (no resubmit).
 */
export function SubmitScorePanel({
  driveLog,
  roster,
  onView,
  challengeId = null,
  onSubmitted,
}: {
  driveLog: DriveLog;
  roster: DraftedRoster;
  onView: () => void;
  /** When set, the score goes on that day's Daily Challenge board. */
  challengeId?: string | null;
  onSubmitted?: () => void;
}) {
  const [name, setName] = useState(getStoredName);
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const [rank, setRank] = useState<number | null>(null);
  const [percentile, setPercentile] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDaily = challengeId != null;
  const scored = driveLog.won && driveLog.score > 0;
  // Free play only wants winning scores; the Daily logs every drive.
  if (!isLeaderboardEnabled || (!isDaily && !scored)) return null;

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name first.");
      return;
    }
    if (!isNameAllowed(trimmed)) {
      setError("Pick a different name.");
      return;
    }
    setState("submitting");
    setError(null);
    setStoredName(trimmed); // remember for the streak board + next time
    try {
      const { rank: newRank } = await submitScore(buildSubmission(trimmed, driveLog, roster, challengeId));
      setRank(newRank);
      trackEvent("score_submitted", { mode: isDaily ? "daily" : "free", scored, rank: newRank });
      // A scoreless daily drive ranks by how far it drove, not its (zero) score.
      if (isDaily && !scored) {
        const pct = await fetchDailyDrivePercentile(challengeId, finalFieldPosition(driveLog)).catch(() => null);
        setPercentile(pct);
      }
      setState("done");
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="submit-panel done">
        {scored ? (
          <>
            <p className="submit-rank">
              #{rank} <span>{isDaily ? "today" : "all-time"}</span>
            </p>
            <p className="submit-done-sub">Your score is on the board.</p>
          </>
        ) : (
          <>
            <p className="submit-rank drive">
              {percentile != null ? `Top ${Math.max(1, Math.round((1 - percentile) * 100))}%` : "Logged"}
              <span>longest drives</span>
            </p>
            <p className="submit-done-sub">
              {percentile != null
                ? "That's how far your drive ranks today."
                : "Your drive is on today's board."}
            </p>
          </>
        )}
        <button type="button" className="ghost-button" onClick={onView}>
          View leaderboard
        </button>
      </div>
    );
  }

  return (
    <div className="submit-panel">
      <p className="eyebrow submit-title">{scored ? "Put it on the board" : "Log your drive"}</p>
      <div className="submit-row">
        <input
          className="submit-input"
          type="text"
          maxLength={20}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={state === "submitting"}
        />
        <button type="button" className="cta-button" onClick={handleSubmit} disabled={state === "submitting"}>
          {state === "submitting" ? "Submitting…" : "Submit"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <button type="button" className="leaderboard-link" onClick={onView}>
        or just view the leaderboard
      </button>
    </div>
  );
}
