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
  fetchMySeason,
  fetchMyStreak,
  fetchSeasonTable,
  fetchTopScores,
  fetchTopStreaks,
  isNetworkError,
  isSeasonLive,
  SEASON_LABEL,
  SEASON_START,
  type SeasonRow,
  type LeaderboardRow,
  type StreakRow,
} from "./leaderboardApi";
import { getCurrentUserId, isLeaderboardEnabled } from "./supabaseClient";
import "./leaderboard.css";

type Tab = "daily" | "season" | "score" | "streak";

function scoredDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function ScoreList({
  rows,
  userId,
  loadingId,
  onPlay,
  playLabel,
  showDate = false,
}: {
  rows: LeaderboardRow[];
  userId: string | null;
  loadingId: string | null;
  onPlay: (row: LeaderboardRow) => void;
  playLabel: string;
  /** All-time board: show when each score was posted (daily is one date). */
  showDate?: boolean;
}) {
  return (
    <ol className="leaderboard-list">
      {rows.map((row, i) => (
        <li className={`leaderboard-row ${userId && row.user_id === userId ? "is-you" : ""}`} key={row.id}>
          <span className="lb-rank">{i + 1}</span>
          <span className="lb-name">
            {row.name}
            {userId && row.user_id === userId && <span className="lb-you">you</span>}
            {showDate && <span className="lb-date">{scoredDate(row.created_at)}</span>}
          </span>
          <span className="lb-ovr" title={row.spend != null ? "Team salary (of $25 cap)" : "Roster payout multiplier"}>
            {row.spend != null ? `$${row.spend}` : formatPayout(payoutMultiplier(row.team_ovr))}
          </span>
          <span className="lb-outcome">
            {outcomeLabel(row.outcome).split(" ")[0]}
            <span className="lb-outcome-label"> {outcomeLabel(row.outcome).split(" ").slice(1).join(" ")}</span>
          </span>
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
          <span className="lb-outcome">
            {outcomeLabel(row.outcome).split(" ")[0]}
            <span className="lb-outcome-label"> {outcomeLabel(row.outcome).split(" ").slice(1).join(" ")}</span>
          </span>
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
  const [myStreak, setMyStreak] = useState<StreakRow | null>(null);
  const [season, setSeason] = useState<SeasonRow[] | null>(null);
  const [mySeason, setMySeason] = useState<{ row: SeasonRow; rank: number | null } | null>(null);
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
      setSeason([]);
      return;
    }
    let cancelled = false;
    // Network-level failures (offline, or the backend napping) get a human
    // line instead of the browser's raw "Failed to fetch".
    const fail = (err: unknown) =>
      !cancelled &&
      setError(
        isNetworkError(err) || !(err instanceof Error) || !err.message
          ? "The leaderboard is unreachable right now — scores are safe, check back soon."
          : err.message
      );
    // getCurrentUserId doesn't create a session -- only players who've already
    // played have one, so we can highlight their rows as "you".
    getCurrentUserId().then((id) => !cancelled && setUserId(id));
    fetchDailyScores(challengeId, 100).then((d) => !cancelled && setDaily(d)).catch(fail);
    fetchDailyLongestDrives(challengeId, 25).then((d) => !cancelled && setDailyDrives(d)).catch(fail);
    fetchTopScores(100).then((d) => !cancelled && setRows(d)).catch(fail);
    fetchTopStreaks(100).then((d) => !cancelled && setStreaks(d)).catch(fail);
    fetchMyStreak().then((d) => !cancelled && setMyStreak(d)).catch(() => {});
    fetchSeasonTable(100).then((d) => !cancelled && setSeason(d)).catch(fail);
    fetchMySeason().then((d) => !cancelled && setMySeason(d)).catch(() => {});
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

  const activeData = tab === "daily" ? daily : tab === "season" ? season : tab === "score" ? rows : streaks;

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
              ["season", "Season"],
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

          {/* ---- Season (cumulative daily-drill points) ---- */}
          {tab === "season" && season !== null && (
            <>
              <p className="leaderboard-subnote">
                {isSeasonLive(challengeId)
                  ? `${SEASON_LABEL} · every daily drill adds to your total · a loss still banks its yards`
                  : `The ${SEASON_LABEL} starts ${formatChallengeDate(SEASON_START)} — every daily drill from opening day counts.`}
              </p>
              {mySeason && (
                <p className={`lb-claim-nudge ${mySeason.rank !== null ? "is-season-me" : ""}`}>
                  {mySeason.rank !== null ? (
                    <>
                      Your season: <b>{mySeason.row.season_points} pts</b> · {mySeason.row.days_played} drill
                      {mySeason.row.days_played === 1 ? "" : "s"} · <b>#{mySeason.rank}</b>
                    </>
                  ) : (
                    <>
                      You've banked <b>{mySeason.row.season_points} pts</b> over {mySeason.row.days_played} drill
                      {mySeason.row.days_played === 1 ? "" : "s"} — but it's unlisted. Put a name on your next
                      daily to claim your spot on the season table.
                    </>
                  )}
                </p>
              )}
              {season.length === 0 ? (
                <p className="leaderboard-empty">
                  {isSeasonLive(challengeId)
                    ? "No season scores yet — today's drill is the first chance to get on the table."
                    : `Today's drill doesn't count yet — the ${SEASON_LABEL} kicks off ${formatChallengeDate(SEASON_START)}. From opening day, every daily adds to your season total. Warm up now.`}
                </p>
              ) : (
                <ol className="leaderboard-list">
                  {season.map((row, i) => (
                    <li className={`streak-row ${userId && row.user_id === userId ? "is-you" : ""}`} key={row.user_id}>
                      <span className="lb-rank">{i + 1}</span>
                      <span className="lb-name">
                        {row.name}
                        {userId && row.user_id === userId && <span className="lb-you">you</span>}
                      </span>
                      <span className="lb-wins">
                        {row.days_played} drill{row.days_played === 1 ? "" : "s"}
                      </span>
                      <span className="lb-score">{row.season_points}</span>
                    </li>
                  ))}
                </ol>
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
                showDate
              />
            )
          )}

          {/* ---- Win streaks ---- */}
          {tab === "streak" && myStreak && (!myStreak.name || myStreak.name === "Anonymous") && myStreak.best_points > 0 && (
            <p className="lb-claim-nudge">
              🔥 You've banked <b>{myStreak.best_points} pts</b> ({myStreak.best_wins} win
              {myStreak.best_wins === 1 ? "" : "s"}) — but it's unlisted. Put a name on your next winning drive to
              claim your spot.
            </p>
          )}
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
