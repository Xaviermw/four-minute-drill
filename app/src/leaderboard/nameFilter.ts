/**
 * Minimal leaderboard-name moderation. Public user-entered names go onto a
 * shared board, so this blocks the unambiguous stuff. It is intentionally a
 * *severe-terms-only* denylist checked as substrings on a normalized name --
 * these terms essentially never occur inside innocent names, which avoids the
 * Scunthorpe problem (legit words/names containing a banned substring). It does
 * NOT try to catch mild profanity; that's a losing game and not worth the false
 * positives. The same check is mirrored server-side in the record_drive RPC and
 * the scores insert policy so a crafted client request can't bypass it.
 */

// Leetspeak / homoglyph folding so "n1gg3r"-style evasions normalize to letters.
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  $: "s",
  "@": "a",
  "!": "i",
};

/** Lowercase, fold leetspeak, then strip everything but a-z. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .split("")
    .map((ch) => LEET[ch] ?? ch)
    .join("")
    .replace(/[^a-z]/g, "");
}

// Severe terms only, and ONLY ones that don't occur inside innocent short
// names -- substring matching means "cunt" would block "Scunthorpe", "spic"
// blocks "Spice", "coon" blocks "raccoon", "rape" blocks "grape"/"therapist".
// Those are deliberately excluded (Scunthorpe problem). Word-boundary matching
// for additional terms is a possible future enhancement.
const DENYLIST: string[] = [
  "nigger",
  "nigga",
  "faggot",
  "chink",
  "kike",
  "retard",
  "nazi",
  "hitler",
  "fuck",
  "shit",
];

/** True if the name is acceptable for the public leaderboard. */
export function isNameAllowed(name: string): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return false; // no letters at all -> reject
  return !DENYLIST.some((term) => normalized.includes(term));
}
