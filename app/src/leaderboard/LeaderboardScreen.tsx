import { useEffect, useState } from "react";
import { useManifest } from "../data/dataContext";
import { startDrive } from "../data/startDrive";
import { rosterFromIdList } from "../share/sharedLineup";
import { useGameDispatch } from "../state/GameStateProvider";
import { outcomeLabel } from "../share/shareText";
import { fetchTopScores, type LeaderboardRow } from "./leaderboardApi";
import { getCurrentUserId, isLeaderboardEnabled } from "./supabaseClient";
import "./leaderboard.css";

export function LeaderboardScreen({ onClose }: { onClose: () => void }) {
  const { manifest } = useManifest();
  const dispatch = useGameDispatch();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLeaderboardEnabled) {
      setRows([]);
      return;
    }
    let cancelled = false;
    // getCurrentUserId doesn't create a session -- only players who've already
    // submitted have one, so we can highlight their rows as "you".
    getCurrentUserId().then((id) => !cancelled && setUserId(id));
    fetchTopScores(100)
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load leaderboard."));
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

  return (
    <div className="leaderboard-overlay" role="dialog" aria-modal="true" aria-label="Leaderboard">
      <div className="leaderboard-modal">
        <header className="leaderboard-modal-header">
          <h2 className="leaderboard-heading">🏆 Top Drives</h2>
          <button type="button" className="leaderboard-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="leaderboard-body">
          {!isLeaderboardEnabled && (
            <p className="leaderboard-empty">
              The leaderboard isn’t set up for this build. See <code>SUPABASE_SETUP.md</code> to enable it.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {isLeaderboardEnabled && rows === null && !error && <p className="leaderboard-empty">Loading scores…</p>}
          {isLeaderboardEnabled && rows !== null && rows.length === 0 && !error && (
            <p className="leaderboard-empty">No scores yet — be the first to put one up.</p>
          )}

          {rows && rows.length > 0 && (
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
        </div>
      </div>
    </div>
  );
}
