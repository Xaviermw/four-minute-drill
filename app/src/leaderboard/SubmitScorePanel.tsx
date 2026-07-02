import { useState } from "react";
import type { DraftedRoster } from "../types/roster";
import type { DriveLog } from "../types/simResult";
import { buildSubmission, submitScore } from "./leaderboardApi";
import { isLeaderboardEnabled } from "./supabaseClient";
import "./leaderboard.css";

/**
 * Shown on a winning result when the leaderboard is configured: a short name
 * input + submit. On success it shows the all-time rank and locks (no resubmit).
 */
export function SubmitScorePanel({
  driveLog,
  roster,
  onView,
}: {
  driveLog: DriveLog;
  roster: DraftedRoster;
  onView: () => void;
}) {
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const [rank, setRank] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only winning drives with points are worth a leaderboard slot.
  if (!isLeaderboardEnabled || !driveLog.won || driveLog.score <= 0) return null;

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name first.");
      return;
    }
    setState("submitting");
    setError(null);
    try {
      const { rank: newRank } = await submitScore(buildSubmission(trimmed, driveLog, roster));
      setRank(newRank);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="submit-panel done">
        <p className="submit-rank">
          #{rank} <span>all-time</span>
        </p>
        <p className="submit-done-sub">Your score is on the board.</p>
        <button type="button" className="ghost-button" onClick={onView}>
          View leaderboard
        </button>
      </div>
    );
  }

  return (
    <div className="submit-panel">
      <p className="eyebrow submit-title">Put it on the board</p>
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
