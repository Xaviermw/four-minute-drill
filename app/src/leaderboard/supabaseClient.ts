import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-created Supabase client built from Vite env vars. The leaderboard is
 * entirely optional: if either var is missing (e.g. local dev or a fork without
 * a backend), `isLeaderboardEnabled` is false and all leaderboard UI hides --
 * the rest of the app is unaffected.
 *
 * `@supabase/supabase-js` is imported dynamically (only the type is imported
 * statically, which is erased at build) so the library stays out of the initial
 * bundle -- it loads on first leaderboard use. `getSupabase()` therefore returns
 * a promise.
 *
 * The key here is the PUBLIC anon key, which is safe to ship in the bundle as
 * long as row-level-security policies are enabled on the table (see
 * SUPABASE_SETUP.md). Never put the service-role key in client env.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isLeaderboardEnabled = Boolean(url && anonKey);

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> | null {
  if (!isLeaderboardEnabled) return null;
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url!, anonKey!, {
        // Persist the anonymous session so a returning visitor keeps the same
        // identity (their scores stay "theirs" across reloads/sessions).
        auth: { persistSession: true, autoRefreshToken: true },
      })
    );
  }
  return clientPromise;
}

/**
 * Ensures there's a signed-in session, creating a Supabase *anonymous* user on
 * first use (no email/password -- invisible to the player). Returns the user id,
 * or null when the leaderboard is disabled. Throws if anonymous sign-ins aren't
 * enabled on the project (see SUPABASE_SETUP.md).
 */
export async function ensureAnonSession(): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
}

/** Returns the current user id if a session already exists, without creating
 * one (used to highlight "you" on the board for people who've already played). */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
