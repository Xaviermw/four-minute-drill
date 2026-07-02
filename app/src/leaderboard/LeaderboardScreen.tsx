import { useEffect, useState } from "react";
import { useManifest } from "../data/dataContext";
import { startDrive } from "../data/startDrive";
import { rosterFromIdList } from "../share/sharedLineup";
import { useGameDispatch } from "../state/GameStateProvider";
import { outcomeLabel } from "../share/shareText";
import { formatClock } from "../utils/formatting";
import { fetchTopScores, fetchTopStreaks, type LeaderboardRow, type StreakRow } from "./leaderboardApi";
import { getCurrentUserId, isLeaderboardEnabled } from "./supabaseClient";
import "./leaderboard.css";

type Tab = "score" | "streak";

export function LeaderboardScreen({ onClose }: { onClose: () => void }) {
  const { manifest } = useManifest();
  const dispatch = useGameDispatch();
  const [tab, setTab] = useState<Tab>("score");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [streaks, setStreaks] = useState<StreakRow[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLeaderboardEnabled) {
      setRows([]);
      setStreaks([]);
      return;
    }
    let cancelled = false;
    // getCurrentUserId doesn't create a session -- only players who've already
    // played have one, so we can highlight their rows as "you".
    getCurrentUserId().then((id) => !cancelled && setUserId(id));
    fetchTopScores(100)
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load leaderboard."));
    fetchTopStreaks(100)
      .then((data) => !cancelled && setStreaks(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load streaks."));
    return () => {
      cancelled = true;
    };
  }, []);

  async function playLineup(row: LeaderboardRow) {
    if (!manifest) return;
    const roster = rosterFromIdList(
      row.roster.map((p) => p.gsisId),
      manifest
    );
    if (!roster) {
      setError("This lineup can't be loaded (a player is no longer available).");
      return;
    }
    setLoadingId(row.id);
    try {
      const { scenario, session } = await startDrive(roster, manifest);
      dispatch({ type: "DRIVE_STARTED", roster, scenario, session });
      onClose();
    } catch {
      setLoadingId(null);
      setError("Could not start that lineup.");
    }
  }

  const activeData = tab === "score" ? rows : streaks;

  return (
    <div className="leaderboard-overlay" role="dialog" aria-modal="true" aria-label="Leaderboard" onClick={onClose}>
      <div className="leaderboard-modal" onClick={(e) => e.stopPropagation()}>
        <header className="leaderboard-modal-header">
          <h2 className="leaderboard-heading">🏆 Leaderboard</h2>
          <button type="button" className="leaderboard-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="leaderboard-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "score"}
            className={`leaderboard-tab ${tab === "score" ? "active" : ""}`}
            onClick={() => setTab("score")}
          >
            Top Scores
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "streak"}
            className={`leaderboard-tab ${tab === "streak" ? "active" : ""}`}
            onClick={() => setTab("streak")}
          >
            Win Streaks
          </button>
        </div>

        <div className="leaderboard-body">
          {!isLeaderboardEnabled && (
            <p className="leaderboard-empty">
              The leaderboard isn’t set up for this build. See <code>SUPABASE_SETUP.md</code> to enable it.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {isLeaderboardEnabled && activeData === null && !error && <p className="leaderboard-empty">Loading…</p>}

          {/* ---- Top scores ---- */}
          {tab === "score" && rows !== null && rows.length === 0 && !error && (
            <p className="leaderboard-empty">No scores yet — be the first to put one up.</p>
          )}
          {tab === "score" && rows && rows.length > 0 && (
            <ol className="leaderboard-list">
              {rows.map((row, i) => (
                <li className={`leaderboard-row ${userId && row.user_id === userId ? "is-you" : ""}`} key={row.id}>
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name">
                    {row.name}
                    {userId && row.user_id === userId && <span className="lb-you">you</span>}
                  </span>
                  <span className="lb-ovr" title="Team overall">
                    {row.team_ovr} OVR
                  </span>
                  <span className="lb-outcome">{outcomeLabel(row.outcome)}</span>
                  <span className="lb-time" title="Time left when they scored">
                    ⏱ {formatClock(row.time_remaining)}
                  </span>
                  <span className="lb-score">{row.score}</span>
                  <button
                    type="button"
                    className="lb-play"
                    onClick={() => playLineup(row)}
                    disabled={loadingId !== null}
                  >
                    {loadingId === row.id ? "…" : "Play this lineup"}
                  </button>
                </li>
              ))}
            </ol>
          )}

          {/* ---- Win streaks ---- */}
          {tab === "streak" && streaks !== null && streaks.length === 0 && !error && (
            <p className="leaderboard-empty">
              No streaks yet. Win drives back-to-back — a loss ends the run and banks your points.
            </p>
          )}
          {tab === "streak" && streaks && streaks.length > 0 && (
            <>
              <p className="leaderboard-subnote">Points banked across a run of consecutive wins. A loss resets it.</p>
              <ol className="leaderboard-list">
                {streaks.map((row, i) => (
                  <li
                    className={`streak-row ${userId && row.user_id === userId ? "is-you" : ""}`}
                    key={row.user_id}
                  >
                    <span className="lb-rank">{i + 1}</span>
                    <span className="lb-name">
                      {row.name}
                      {userId && row.user_id === userId && <span className="lb-you">you</span>}
                    </span>
                    <span className="lb-wins">
                      {row.best_wins} win{row.best_wins === 1 ? "" : "s"}
                    </span>
                    <span className="lb-score">{row.best_points}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
