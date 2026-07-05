/**
 * Optional error monitoring. Gated on VITE_SENTRY_DSN (absent -> no-op, exactly
 * like the Supabase pattern), and dynamically imported so @sentry/react never
 * lands in the initial bundle. Errors that occur before the async init resolves
 * are dropped -- acceptable, since ErrorBoundary catches render errors that
 * happen well after first paint.
 */
let capture: ((error: unknown, context?: Record<string, unknown>) => void) | null = null;

export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // not configured -> stay dark

  import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        // Errors only for now -- no performance tracing or session replay
        // (both add weight/cost we don't need pre-launch).
        tracesSampleRate: 0,
        environment: import.meta.env.MODE,
      });
      capture = (error, context) => Sentry.captureException(error, context ? { extra: context } : undefined);
    })
    .catch(() => {
      /* monitoring is best-effort; a failed load must never affect the app */
    });
}

/** Report a caught error to Sentry when configured; a silent no-op otherwise. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  try {
    capture?.(error, context);
  } catch {
    /* never throw from the error path */
  }
}
