import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-created Supabase client built from Vite env vars. The leaderboard is
 * entirely optional: if either var is missing (e.g. local dev or a fork without
 * a backend), `isLeaderboardEnabled` is false and all leaderboard UI hides --
 * the rest of the app is unaffected.
 *
 * The key here is the PUBLIC anon key, which is safe to ship in the bundle as
 * long as row-level-security policies are enabled on the table (see
 * SUPABASE_SETUP.md). Never put the service-role key in client env.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isLeaderboardEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isLeaderboardEnabled) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false },
    });
  }
  return client;
}
