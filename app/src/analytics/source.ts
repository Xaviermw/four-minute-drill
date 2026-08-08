/**
 * First-touch source attribution: remember which platform brought this player
 * (utm_source on their FIRST visit) so paid-source cohorts stay separable in
 * our own data (streaks.source / scores.source). First touch is sticky --
 * later visits with different tags never overwrite it. No PII: the value is
 * our own campaign tag ("reddit", "meta"), nothing about the person.
 */

const KEY = "fmd_src";

/** Capture on app boot, before any UI decisions. Safe to call repeatedly. */
export function captureFirstTouchSource(): void {
  try {
    if (localStorage.getItem(KEY)) return; // first touch is sticky
    const src = new URLSearchParams(window.location.search).get("utm_source");
    if (src) localStorage.setItem(KEY, src.slice(0, 24));
  } catch {
    /* storage unavailable (private mode etc.) -- attribution is best-effort */
  }
}

/** The stored first-touch tag, or null for organic/unknown. */
export function getFirstTouchSource(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
