import { track } from "@vercel/analytics";

/**
 * The product funnel we care about, front to back:
 *   draft_started -> drive_started -> drive_completed -> (score_submitted | result_shared)
 * plus lineup_link_opened, the viral entry point (someone opened a shared team).
 * Centralized so event names stay consistent and a tracking failure can never
 * break the app. No-ops locally; reports once Analytics is on in the dashboard.
 */
export type AnalyticsEvent =
  | "draft_started"
  | "drive_started"
  | "drive_completed"
  | "score_submitted"
  | "result_shared"
  | "lineup_link_opened"
  | "scrub_taken"
  | "rookie_gate";

export function trackEvent(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>
): void {
  try {
    track(event, props);
  } catch {
    /* analytics is best-effort; never let it throw into the UI */
  }
}
