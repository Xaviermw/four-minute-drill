import { useEffect, useRef, useState } from "react";
import { useManifest } from "../data/dataContext";
import { startDrive } from "../data/startDrive";
import { payoutMultiplier } from "../engine";
import { formatChallengeDate } from "../daily/dailyChallenge";
import { weekLabel, weekNumberFor, weekStartFor } from "../daily/season";
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
  fetchMyWeek,
  fetchSeasonTable,
  fetchTopStreaks,
  fetchWeekTable,
  fetchWeekWinners,
  isNetworkError,
  isSeasonLive,
  SEASON_END,
  SEASON_LABEL,
  SEASON_START,
  type SeasonRow,
  type LeaderboardRow,
  type StreakRow,
  type WeekRow,
} from "./leaderboardApi";
import { getCurrentUserId, isLeaderboardEnabled } from "./supabaseClient";
import "./leaderboard.css";

type Tab = "daily" | "week" | "season" | "streak";

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
  // Free play's home is the streak board (the all-time free-play table was
  // retired for the weekly race, owner call 2026-09-16).
  const [tab, setTab] = useState<Tab>(mode === "daily" ? "daily" : "streak");
  const [daily, setDaily] = useState<LeaderboardRow[] | null>(null);
  const [dailyDrives, setDailyDrives] = useState<LeaderboardRow[] | null>(null);
  const [week, setWeek] = useState<WeekRow[] | null>(null);
  const [winners, setWinners] = useState<WeekRow[]>([]);
  const [myWeek, setMyWeek] = useState<{ row: WeekRow; rank: number | null } | null>(null);
  const [streaks, setStreaks] = useState<StreakRow[] | null>(null);
  const [myStreak, setMyStreak] = useState<StreakRow | null>(null);
  const [season, setSeason] = useState<SeasonRow[] | null>(null);
  const [mySeason, setMySeason] = useState<{ row: SeasonRow; rank: number | null } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalBehavior(modalRef, onClose);

  const live = isSeasonLive(challengeId);
  const seasonOver = challengeId > SEASON_END;
  const weekStart = weekStartFor(challengeId);
  const weekNo = weekNumberFor(weekStart);

  useEffect(() => {
    if (!isLeaderboardEnabled) {
      setDaily([]);
      setDailyDrives([]);
      setWeek([]);
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
    const thisWeek = weekStartFor(challengeId);
    // getCurrentUserId doesn't create a session -- only players who've already
    // played have one, so we can highlight their rows as "you".
    getCurrentUserId().then((id) => !cancelled && setUserId(id));
    fetchDailyScores(challengeId, 100).then((d) => !cancelled && setDaily(d)).catch(fail);
    fetchDailyLongestDrives(challengeId, 25).then((d) => !cancelled && setDailyDrives(d)).catch(fail);
    fetchWeekTable(thisWeek, 100).then((d) => !cancelled && setWeek(d)).catch(fail);
    fetchWeekWinners(thisWeek).then((d) => !cancelled && setWinners(d)).catch(() => {});
    fetchMyWeek(thisWeek).then((d) => !cancelled && setMyWeek(d)).catch(() => {});
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

  const activeData = tab === "daily" ? daily : tab === "week" ? week : tab === "season" ? season : streaks;

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
              ["week", "This Week"],
              ["season", "Season"],
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

          {/* ---- This Week (NFL week, Thursday to Wednesday) ---- */}
          {tab === "week" && week !== null && (
            <>
              <p className="leaderboard-subnote">
                {live
                  ? `Week ${weekNo} · ${weekLabel(weekStart)} · a fresh race every Thursday · a loss still banks its yards`
                  : seasonOver
                    ? `The ${SEASON_LABEL} is over — the winners below stand.`
                    : `Weekly races begin with the ${SEASON_LABEL} on ${formatChallengeDate(SEASON_START)} — a fresh table every Thursday.`}
              </p>
              {live && myWeek && (
                <p className={`lb-claim-nudge ${myWeek.rank !== null ? "is-season-me" : ""}`}>
                  {myWeek.rank !== null ? (
                    <>
                      Your week: <b>{myWeek.row.week_points} pts</b> · {myWeek.row.days_played} drill
                      {myWeek.row.days_played === 1 ? "" : "s"} · <b>#{myWeek.rank}</b>
                    </>
                  ) : (
                    <>
                      You've banked <b>{myWeek.row.week_points} pts</b> this week over {myWeek.row.days_played} drill
                      {myWeek.row.days_played === 1 ? "" : "s"} — but it's unlisted. Put a name on your next daily to
                      claim your spot.
                    </>
                  )}
                </p>
              )}
              {week.length === 0 ? (
                <p className="leaderboard-empty">
                  {live
                    ? "No scores yet this week — today's drill is the first chance to lead it."
                    : seasonOver
                      ? "No week in progress."
                      : `Today's drill doesn't count yet — the ${SEASON_LABEL} kicks off ${formatChallengeDate(SEASON_START)}. Warm up now.`}
                </p>
              ) : (
                <ol className="leaderboard-list">
                  {week.map((row, i) => (
                    <li className={`streak-row ${userId && row.user_id === userId ? "is-you" : ""}`} key={row.user_id}>
                      <span className="lb-rank">{i + 1}</span>
                      <span className="lb-name">
                        {row.name}
                        {userId && row.user_id === userId && <span className="lb-you">you</span>}
                      </span>
                      <span className="lb-wins">
                        {row.days_played} drill{row.days_played === 1 ? "" : "s"}
                      </span>
                      <span className="lb-score">{row.week_points}</span>
                    </li>
                  ))}
                </ol>
              )}

              {/* Past winners -- announced by Coach Bot every Thursday morning. */}
              {winners.length > 0 && (
                <div className="leaderboard-section">
                  <p className="leaderboard-section-title">Weekly winners</p>
                  <p className="leaderboard-subnote">Most points over the week · ties go to the cheaper squad</p>
                  <ol className="leaderboard-list">
                    {winners.map((row) => (
                      <li
                        className={`streak-row winner-row ${userId && row.user_id === userId ? "is-you" : ""}`}
                        key={row.week_start}
                      >
                        <span className="lb-rank lb-week">Wk {weekNumberFor(row.week_start)}</span>
                        <span className="lb-name">
                          🏆 {row.name}
                          {userId && row.user_id === userId && <span className="lb-you">you</span>}
                        </span>
                        <span className="lb-wins">{weekLabel(row.week_start)}</span>
                        <span className="lb-score">{row.week_points}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}

          {/* ---- Season (cumulative daily-drill points) ---- */}
          {tab === "season" && season !== null && (
            <>
              <p className="leaderboard-subnote">
                {live
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
                  {live
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
