import type { DraftedRoster } from "../types/roster";
import { finalFieldPosition, type DriveChoice, type DriveLog } from "../types/simResult";
import { teamOverall } from "../utils/rosterStats";
import { LINEUP_SLOT_ORDER } from "../share/lineupCode";
import { getFirstTouchSource } from "../analytics/source";
import { ensureAnonSession, getCurrentUserId, getSupabase } from "./supabaseClient";

const TABLE = "scores";

/** One drafted player as stored on a leaderboard row (enough to rebuild the
 * lineup and render it without re-reading the manifest). */
export interface LeaderboardPlayer {
  gsisId: string;
  name: string;
  position: string;
  rating: number;
}

/** A row as read back from Supabase. */
export interface LeaderboardRow {
  id: string;
  created_at: string;
  name: string;
  score: number;
  outcome: string;
  team_ovr: number;
  /** Game clock (seconds) left when they scored -- less is more clutch. */
  time_remaining: number;
  /** Yards to the end zone where the drive ended (0 = scored). Drives the
   * "Longest drives" board -- lower is further. */
  final_field_position: number;
  /** Total cap salary of the team. Null on legacy (pre-cap) rows. */
  spend: number | null;
  roster: LeaderboardPlayer[];
  seed: number;
  choices: DriveChoice[];
  /** The (anonymous) user who submitted it -- used to highlight "you". */
  user_id: string | null;
  /** Daily Challenge id (ET date) this score is for, or null for free play. */
  challenge_date: string | null;
  /** First-touch acquisition tag (utm_source), or null for organic/legacy. */
  source: string | null;
}

/** The payload we insert (server fills id/created_at). */
export interface LeaderboardSubmission {
  name: string;
  score: number;
  outcome: string;
  team_ovr: number;
  time_remaining: number;
  final_field_position: number;
  spend: number | null;
  roster: LeaderboardPlayer[];
  seed: number;
  choices: DriveChoice[];
  challenge_date: string | null;
  /** First-touch acquisition tag (utm_source), or null for organic. */
  source: string | null;
}

function rosterToPlayers(roster: DraftedRoster): LeaderboardPlayer[] {
  return LINEUP_SLOT_ORDER.map((slot) => {
    const p = roster[slot];
    return { gsisId: p.gsisId, name: p.displayName, position: p.position, rating: p.rating };
  });
}

/** Builds the insert payload from a finished drive + the name the player typed.
 * Pass `challengeId` for a Daily Challenge score; omit for free play. `spend` is
 * the team's cap salary (omit only if pricing is unavailable). */
export function buildSubmission(
  name: string,
  driveLog: DriveLog,
  roster: DraftedRoster,
  challengeId: string | null = null,
  spend: number | null = null
): LeaderboardSubmission {
  return {
    name: name.trim().slice(0, 20),
    score: driveLog.score,
    outcome: driveLog.endReason,
    team_ovr: teamOverall(roster),
    time_remaining: driveLog.clockSecondsRemaining,
    final_field_position: finalFieldPosition(driveLog),
    spend,
    roster: rosterToPlayers(roster),
    seed: driveLog.seed,
    choices: driveLog.choices,
    challenge_date: challengeId,
    source: getFirstTouchSource(),
  };
}

/**
 * True when an error means "couldn't reach Supabase at all" (device offline,
 * or the free-tier project paused and its DNS removed). supabase-js flattens
 * the underlying fetch TypeError into a plain Error whose MESSAGE carries the
 * browser's network phrasing, so this has to sniff text, per browser family.
 */
export function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
}

/** Inserts a score and returns its all-time rank (1 = best). Throws on failure. */
export async function submitScore(entry: LeaderboardSubmission): Promise<{ rank: number }> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Leaderboard is not configured.");

  // Sign in anonymously first so the row is owned by a stable user id (the DB
  // defaults scores.user_id to auth.uid(), and RLS requires an authed session).
  await ensureAnonSession();

  const { error } = await supabase.from(TABLE).insert(entry);
  if (error) throw new Error(error.message);

  // Rank = number of strictly-better scores + 1, within the same board (this
  // day's daily scores, or the all-time free-play board). Ties share the lower
  // rank -- good enough for a casual leaderboard.
  // Legacy pre-cap rows (null spend) are off the boards (owner call
  // 2026-08-07) -- exclude them from rank math too, or "#4" counts ghosts
  // of the old economy.
  let q = supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gt("score", entry.score)
    .not("spend", "is", null);
  q = entry.challenge_date ? q.eq("challenge_date", entry.challenge_date) : q.is("challenge_date", null);
  const { count, error: countError } = await q;
  if (countError) throw new Error(countError.message);

  return { rank: (count ?? 0) + 1 };
}

/** Fetches the top scores, highest first. Returns [] when disabled. */
export async function fetchTopScores(limit = 100): Promise<LeaderboardRow[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .is("challenge_date", null) // all-time board excludes daily-challenge scores
    .not("spend", "is", null) // and legacy pre-cap rows (the old x1.1-chip era)
    .order("score", { ascending: false })
    .order("spend", { ascending: true }) // tie-break: cheaper roster outranks (owner call)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardRow[];
}

/** Fetches today's Daily Challenge scores, highest first. */
export async function fetchDailyScores(challengeId: string, limit = 100): Promise<LeaderboardRow[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("challenge_date", challengeId)
    .order("score", { ascending: false })
    .order("spend", { ascending: true }) // tie-break: cheaper roster outranks (owner call)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardRow[];
}

/** Fetches today's Daily Challenge entries ranked by how far the drive got
 * (smallest final_field_position first). Includes scoreless drives, so a loss
 * that marched deep still lands on this board. */
export async function fetchDailyLongestDrives(challengeId: string, limit = 100): Promise<LeaderboardRow[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("challenge_date", challengeId)
    .order("final_field_position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardRow[];
}

/** Where a drive stands among today's field: the fraction of entries it reached
 * or beat (0-1), by yards driven. 1.0 = furthest. Returns null when disabled or
 * there's no field yet. Counts the caller's own already-submitted entry, so call
 * it after submitting for an inclusive "top X%". */
export async function fetchDailyDrivePercentile(
  challengeId: string,
  finalPosition: number
): Promise<number | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;

  const total = supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("challenge_date", challengeId);
  // Entries this drive reached or beat = those that ended no closer to the end
  // zone (final_field_position >= ours). Lower position = further downfield.
  const beaten = supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("challenge_date", challengeId)
    .gte("final_field_position", finalPosition);

  const [{ count: totalCount, error: e1 }, { count: beatenCount, error: e2 }] = await Promise.all([total, beaten]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  if (!totalCount) return null;
  return (beatenCount ?? 0) / totalCount;
}

/** Headline counts for today's field: how many drives were logged and how many
 * scored. Two head-count queries; used for the "Today's field" line on
 * DailyDone. Returns zeros when the leaderboard is disabled. */
export async function fetchDailyFieldSummary(challengeId: string): Promise<{ total: number; scored: number }> {
  const supabase = await getSupabase();
  if (!supabase) return { total: 0, scored: 0 };

  const totalQ = supabase.from(TABLE).select("id", { count: "exact", head: true }).eq("challenge_date", challengeId);
  const scoredQ = supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("challenge_date", challengeId)
    .gt("score", 0);

  const [{ count: total, error: e1 }, { count: scored, error: e2 }] = await Promise.all([totalQ, scoredQ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  return { total: total ?? 0, scored: scored ?? 0 };
}

// ---- Win-streak leaderboard ----
// A streak is consecutive winning drives; its value is the points banked during
// the run. A loss resets it. The server (record_drive RPC) does the aggregation
// atomically so it can't race across drives.

const STREAK_TABLE = "streaks";
const NAME_KEY = "fmd_name";

/** One player's streak row. */
export interface StreakRow {
  user_id: string;
  name: string;
  best_points: number;
  best_wins: number;
  current_points: number;
  current_wins: number;
}

/** The display name the player last submitted, remembered so streak rows and
 * the submit box carry it without re-asking. */
export function getStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim().slice(0, 20));
  } catch {
    /* ignore storage failures */
  }
}

/** The streak after recording a drive. On a win, streak_* is the now-active
 * run; on a loss, it's the run that just ended (pre-reset). */
export interface StreakUpdate {
  won: boolean;
  streak_points: number;
  streak_wins: number;
  best_points: number;
  best_wins: number;
}

/** Records a finished drive into the caller's streak (win extends + banks
 * points, loss resets) and returns the resulting streak so the UI can show it.
 * No-op (null) when the leaderboard is disabled; never throws to the caller (a
 * failed streak update shouldn't disrupt the result screen). */
export async function recordDrive(driveLog: DriveLog, name: string): Promise<StreakUpdate | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    await ensureAnonSession();
    const { data, error } = await supabase.rpc("record_drive", {
      p_won: driveLog.won,
      p_points: driveLog.score,
      p_name: name.trim().slice(0, 20) || null,
      p_source: getFirstTouchSource(),
    });
    if (error) throw error;
    return (data as StreakUpdate) ?? null;
  } catch {
    /* streak tracking is best-effort */
    return null;
  }
}

/** The viewer's own streak row (named or not), for the claim-your-spot nudge
 * on the streak board. Null when they've never recorded a free-play drive. */
export async function fetchMyStreak(): Promise<StreakRow | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from(STREAK_TABLE)
    .select("user_id,name,best_points,best_wins,current_points,current_wins")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as StreakRow) ?? null;
}

/** Fetches the top win-streaks by banked points, highest first. Named players
 * only (owner call 2026-08-05): a wall of "Anonymous" is anti-social-proof,
 * and the unlisted-streak nudge turns claiming a name into the engagement
 * hook. Streaks are still TRACKED for everyone -- display-level filter only. */
export async function fetchTopStreaks(limit = 100): Promise<StreakRow[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(STREAK_TABLE)
    .select("user_id,name,best_points,best_wins,current_points,current_wins")
    .gt("best_points", 0)
    .not("name", "is", null)
    .neq("name", "Anonymous")
    .order("best_points", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as StreakRow[];
}

// ---- Season Score (docs/season-score-spec.md) ------------------------------

/** Season window -- keep in lockstep with migration 011's view constants. */
export const SEASON_START = "2026-09-10";
export const SEASON_END = "2027-01-05";
export const SEASON_LABEL = "2026 Season";

export function isSeasonLive(challengeId: string): boolean {
  return challengeId >= SEASON_START && challengeId <= SEASON_END;
}

export interface SeasonRow {
  user_id: string;
  name: string;
  season_points: number;
  days_played: number;
  last_played_at: string;
}

/** The season table: cumulative daily-drill points, named players only
 * (Anonymous is anti-social-proof -- same rule as streaks). */
export async function fetchSeasonTable(limit = 100): Promise<SeasonRow[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("season_totals")
    .select("*")
    .neq("name", "Anonymous")
    .order("season_points", { ascending: false })
    .order("days_played", { ascending: false })
    .order("last_played_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SeasonRow[];
}

/** The viewer's own season line + rank among named players (null rank when
 * unnamed -- the claim nudge). Null when they've never played a season day. */
export async function fetchMySeason(): Promise<{ row: SeasonRow; rank: number | null } | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase.from("season_totals").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  const row = data as SeasonRow;
  if (!row.name || row.name === "Anonymous") return { row, rank: null };
  const { count } = await supabase
    .from("season_totals")
    .select("user_id", { count: "exact", head: true })
    .neq("name", "Anonymous")
    .gt("season_points", row.season_points);
  return { row, rank: (count ?? 0) + 1 };
}

// ---- Opening-day reminder (migration 013) -----------------------------------

const REMINDER_KEY = "fmd_reminder";

/** Has this device already asked for the opening-day email? */
export function hasReminder(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) === "1";
  } catch {
    return false;
  }
}

/** Store an email for ONE opening-day reminder. Write-only table; duplicates
 * (409) count as success -- they already asked. Throws on other failures. */
export async function subscribeReminder(email: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Reminders aren't configured.");
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.length > 254) throw new Error("That doesn't look like an email.");
  await ensureAnonSession();
  const { error } = await supabase.from("reminders").insert({ email: clean, source: getFirstTouchSource() });
  if (error && error.code !== "23505") throw new Error(error.message); // 23505 = already on the list
  try {
    localStorage.setItem(REMINDER_KEY, "1");
  } catch {
    /* fine */
  }
}
