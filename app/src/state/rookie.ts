/**
 * First-visit detection for the rookie drive (docs/macro-review P1): a brand-new
 * visitor's first-ever game must not be their one daily shot. Rookies default to
 * a no-stakes practice drive; completing ANY drive (practice, shared-link, or a
 * deliberately-chosen daily) graduates them.
 *
 * "Rookie" = the rookie flag isn't set AND no other fmd_* key exists — any
 * returning player has at least one (seen-intro, streaks, daily records, name),
 * so veterans from before this feature are grandfathered automatically.
 *
 * The check is SNAPSHOTTED per page load: keys written mid-session (e.g.
 * dismissing the coach strip sets fmd_seen_intro) must not flip an in-progress
 * rookie to veteran mid-drive. Only graduation (markRookieDone) flips it live.
 *
 * Graduation also retires the teaching hints (tempo, clutch, budget, scrub):
 * they render for rookies, then disappear — How It Works stays as the reference.
 */
const KEY = "fmd_rookie_done";

let snapshot: boolean | null = null;

function compute(): boolean {
  try {
    if (localStorage.getItem(KEY)) return false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("fmd_")) {
        // Pre-feature veteran: backfill the flag so future checks are O(1).
        localStorage.setItem(KEY, "1");
        return false;
      }
    }
    return true;
  } catch {
    // No storage (private-mode edge): treat as veteran -- never risk gating a
    // returning player out of the daily.
    return false;
  }
}

export function isRookie(): boolean {
  if (snapshot === null) snapshot = compute();
  return snapshot;
}

export function markRookieDone(): void {
  snapshot = false;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore storage failures */
  }
}

// ---- First-visit gate ----
// The rookie is ASKED (a one-time choice modal), not silently defaulted: they
// pick "practice drive" or "skip to the daily". Session-scoped on purpose --
// if they close the tab before finishing a drive, they're still a rookie and
// the gate asks again next visit.
let gateChoice: "practice" | "daily" | null = null;

export function rookieGateChoice(): "practice" | "daily" | null {
  return gateChoice;
}

export function setRookieGateChoice(choice: "practice" | "daily"): void {
  gateChoice = choice;
}
