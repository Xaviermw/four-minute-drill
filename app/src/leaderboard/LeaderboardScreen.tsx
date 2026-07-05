import { useEffect, useRef, useState } from "react";
import { useManifest } from "../data/dataContext";
import { startDrive } from "../data/startDrive";
import { payoutMultiplier } from "../engine";
import { formatChallengeDate } from "../daily/dailyChallenge";
import { rosterFromIdList } from "../share/sharedLineup";
import { outcomeLabel } from "../share/shareText";
import { useGameDispatch } from "../state/GameStateProvider";
import { useMode } from "../state/ModeProvider";
import { formatBallOn, formatClock, formatPayout } from "../utils/formatting";
import { useModalBehavior } from "../utils/useModalBehavior";
import {
  fetchDailyLongestDrives,
  fetchDailyScores,
  fetchTopScores,
  fetchTopStreaks,
  type LeaderboardRow,
  type StreakRow,
} from "./leaderboardApi";
import { getCurrentUserId, isLeaderboardEnabled } from "./supabaseClient";
import "./leaderboard.css";

type Tab = "daily" | "score" | "streak";

function ScoreList({
  rows,
  userId,
  loadingId,
  onPlay,
  playLabel,
}: {
  rows: LeaderboardRow[];
  userId: string | null;
  loadingId: string | null;
  onPlay: (row: LeaderboardRow) => void;
  playLabel: string;
}) {
  return (
    <ol className="leaderboard-list">
      {rows.map((row, i) => (
        <li className={`leaderboard-row ${userId && row.user_id === userId ? "is-you" : ""}`} key={row.id}>
          <span className="lb-rank">{i + 1}</span>
          <span className="lb-name">
            {row.name}
            {userId && row.user_id === userId && <span className="lb-you">you</span>}
          </span>
          <span className="lb-ovr" title={row.spend != null ? "Team salary (of $25 cap)" : "Roster payout multiplier"}>
            {row.spend != null ? `$${row.spend}` : formatPayout(payoutMultiplier(row.team_ovr))}
          </span>
          <span className="lb-outcome">{outcomeLabel(row.outcome)}</span>
          <span className="lb-time" title="Time left when they scored">
            ⏱ {formatClock(row.time_remaining)}
          </span>
          <span className="lb-score">{row.score}</span>
          <button type="button" className="lb-play" onClick={() => onPlay(row)} disabled={loadingId !== null}>
            {loadingId === row.id ? "…" : playLabel}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Daily "longest drives" list: ranks by how far downfield the drive got,
 * showing the finishing spot instead of the score (so scoreless-but-deep drives
 * shine). A drive that reached the end zone reads "Scored". */
function DriveList({
  rows,
  userId,
  loadingId,
  onPlay,
}: {
  rows: LeaderboardRow[];
  userId: string | null;
  loadingId: string | null;
  onPlay: (row: LeaderboardRow) => void;
}) {
  return (
    <ol className="leaderboard-list">
      {rows.map((row, i) => (
        <li className={`leaderboard-row ${userId && row.user_id === userId ? "is-you" : ""}`} key={row.id}>
          <span className="lb-rank">{i + 1}</span>
          <span className="lb-name">
            {row.name}
            {userId && row.user_id === userId && <span className="lb-you">you</span>}
          </span>
          <span className="lb-outcome">{outcomeLabel(row.outcome)}</span>
          <span className="lb-reached" title="Where the drive ended">
            {row.final_field_position <= 0 ? "Scored" : `to ${formatBallOn(row.final_field_position)}`}
          </span>
          <button type="button" className="lb-play" onClick={() => onPlay(row)} disabled={loadingId !== null}>
            {loadingId === row.id ? "…" : "Try in Free Play"}
          </button>
        </li>
      ))}
    </ol>
  );
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <ol className="leaderboard-list">
      {Array.from({ length: count }, (_, i) => (
        <li className="lb-skeleton" key={i} />
      ))}
    </ol>
  );
}

export function LeaderboardScreen({ onClose }: { onClose: () => void }) {
  const { manifest } = useManifest();
  const dispatch = useGameDispatch();
  const { mode, challengeId } = useMode();
  const [tab, setTab] = useState<Tab>(mode === "daily" ? "daily" : "score");
  const [daily, setDaily] = useState<LeaderboardRow[] | null>(null);
  const [dailyDrives, setDailyDrives] = useState<LeaderboardRow[] | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [streaks, setStreaks] = useState<StreakRow[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalBehavior(modalRef, onClose);

  useEffect(() => {
    if (!isLeaderboardEnabled) {
      setDaily([]);
      setDailyDrives([]);
      setRows([]);
      setStreaks([]);
      return;
    }
    let cancelled = false;
    const fail = (err: unknown) =>
      !cancelled && setError(err instanceof Error ? err.message : "Could not load leaderboard.");
    // getCurrentUserId doesn't create a session -- only players who've already
    // played have one, so we can highlight their rows as "you".
    getCurrentUserId().then((id) => !cancelled && setUserId(id));
    fetchDailyScores(challengeId, 100).then((d) => !cancelled && setDaily(d)).catch(fail);
    fetchDailyLongestDrives(challengeId, 25).then((d) => !cancelled && setDailyDrives(d)).catch(fail);
    fetchTopScores(100).then((d) => !cancelled && setRows(d)).catch(fail);
    fetchTopStreaks(100).then((d) => !cancelled && setStreaks(d)).catch(fail);
    return () => {
      cancelled = true;
    };
  }, [challengeId]);

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

  const activeData = tab === "daily" ? daily : tab === "score" ? rows : streaks;

  return (
    <div className="leaderboard-overlay" role="dialog" aria-modal="true" aria-label="Leaderboard" onClick={onClose}>
      <div className="leaderboard-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <header className="leaderboard-modal-header">
          <h2 className="leaderboard-heading">🏆 Leaderboard</h2>
          <button type="button" className="leaderboard-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="leaderboard-tabs" role="tablist">
          {(
            [
              ["daily", "Today's Drill"],
              ["score", "All-Time"],
              ["streak", "Win Streaks"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`leaderboard-tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="leaderboard-body">
          {!isLeaderboardEnabled && (
            <p className="leaderboard-empty">
              The leaderboard isn’t set up for this build. See <code>SUPABASE_SETUP.md</code> to enable it.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {isLeaderboardEnabled && activeData === null && !error && <SkeletonRows />}

          {/* ---- Today's Drill ---- */}
          {tab === "daily" && daily !== null && (
            <>
              <p className="leaderboard-subnote">{formatChallengeDate(challengeId)} · everyone drafts the same options</p>
              {daily.length === 0 ? (
                <p className="leaderboard-empty">No scores yet today — be the first to post one.</p>
              ) : (
                <ScoreList
                  rows={daily}
                  userId={userId}
                  loadingId={loadingId}
                  onPlay={playLineup}
                  playLabel="Try in Free Play"
                />
              )}

              {/* Longest drives -- rewards marching deep even without scoring. */}
              {dailyDrives && dailyDrives.length > 0 && (
                <div className="leaderboard-section">
                  <p className="leaderboard-section-title">Longest drives</p>
                  <p className="leaderboard-subnote">How far each drive got — scoreless runs count too.</p>
                  <DriveList rows={dailyDrives} userId={userId} loadingId={loadingId} onPlay={playLineup} />
                </div>
              )}
            </>
          )}

          {/* ---- All-time (free play) ---- */}
          {tab === "score" && rows !== null && (
            rows.length === 0 ? (
              <p className="leaderboard-empty">No scores yet — be the first to put one up.</p>
            ) : (
              <ScoreList
                rows={rows}
                userId={userId}
                loadingId={loadingId}
                onPlay={playLineup}
                playLabel="Play this lineup"
              />
            )
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
                  <li className={`streak-row ${userId && row.user_id === userId ? "is-you" : ""}`} key={row.user_id}>
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
