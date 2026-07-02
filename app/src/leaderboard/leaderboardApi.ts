import type { DraftedRoster } from "../types/roster";
import type { DriveChoice, DriveLog } from "../types/simResult";
import { teamOverall } from "../utils/rosterStats";
import { LINEUP_SLOT_ORDER } from "../share/lineupCode";
import { ensureAnonSession, getSupabase } from "./supabaseClient";

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
  roster: LeaderboardPlayer[];
  seed: number;
  choices: DriveChoice[];
  /** The (anonymous) user who submitted it -- used to highlight "you". */
  user_id: string | null;
}

/** The payload we insert (server fills id/created_at). */
export interface LeaderboardSubmission {
  name: string;
  score: number;
  outcome: string;
  team_ovr: number;
  roster: LeaderboardPlayer[];
  seed: number;
  choices: DriveChoice[];
}

function rosterToPlayers(roster: DraftedRoster): LeaderboardPlayer[] {
  return LINEUP_SLOT_ORDER.map((slot) => {
    const p = roster[slot];
    return { gsisId: p.gsisId, name: p.displayName, position: p.position, rating: p.rating };
  });
}

/** Builds the insert payload from a finished drive + the name the player typed. */
export function buildSubmission(name: string, driveLog: DriveLog, roster: DraftedRoster): LeaderboardSubmission {
  return {
    name: name.trim().slice(0, 20),
    score: driveLog.score,
    outcome: driveLog.endReason,
    team_ovr: teamOverall(roster),
    roster: rosterToPlayers(roster),
    seed: driveLog.seed,
    choices: driveLog.choices,
  };
}

/** Inserts a score and returns its all-time rank (1 = best). Throws on failure. */
export async function submitScore(entry: LeaderboardSubmission): Promise<{ rank: number }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Leaderboard is not configured.");

  // Sign in anonymously first so the row is owned by a stable user id (the DB
  // defaults scores.user_id to auth.uid(), and RLS requires an authed session).
  await ensureAnonSession();

  const { error } = await supabase.from(TABLE).insert(entry);
  if (error) throw new Error(error.message);

  // Rank = number of strictly-better scores + 1. (Ties share the lower rank;
  // good enough for a casual leaderboard.)
  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gt("score", entry.score);
  if (countError) throw new Error(countError.message);

  return { rank: (count ?? 0) + 1 };
}

/** Fetches the top scores, highest first. Returns [] when disabled. */
export async function fetchTopScores(limit = 100): Promise<LeaderboardRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardRow[];
}
