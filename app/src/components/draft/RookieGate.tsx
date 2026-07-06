import "./draft.css";

/**
 * One-time first-visit choice (docs/macro-review P1, reworked per owner
 * feedback): instead of silently defaulting newcomers into a practice drive
 * they never asked for, ASK. The question itself teaches the premise -- there's
 * one shared daily and you get one shot at it -- and choosing makes the
 * practice framing legible instead of weird.
 *
 * Deliberately not dismissable except via the two buttons: an Escape/outside
 * click has no unambiguous meaning here, and it appears exactly once.
 */
export function RookieGate({ onPractice, onSkip }: { onPractice: () => void; onSkip: () => void }) {
  return (
    <div className="rookie-gate-overlay" role="dialog" aria-modal="true" aria-labelledby="rookie-gate-title">
      <div className="rookie-gate">
        <span className="rookie-gate-ball" aria-hidden="true">
          🏈
        </span>
        <h2 id="rookie-gate-title">First time here?</h2>
        <p className="rookie-gate-copy">
          Four Minute Drill is a daily: everyone gets the <strong>same board</strong> and{" "}
          <strong>one shot</strong> at the drive. Want a no-stakes practice run first?
        </p>
        <button type="button" className="cta-button rookie-gate-primary" onClick={onPractice} autoFocus>
          Run a practice drive
        </button>
        <button type="button" className="ghost-button" onClick={onSkip}>
          Skip to Today's Drill →
        </button>
      </div>
    </div>
  );
}
