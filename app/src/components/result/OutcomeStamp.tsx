import { useEffect, useRef } from "react";
import "./result.css";

/**
 * The broadcast call: a rubber-stamp slam of what just happened, in the
 * language a booth would use. It IS the result headline rather than a banner
 * above one -- stacking a stamp on top of the same sentence just said it
 * twice.
 *
 * Motion and haptics both respect prefers-reduced-motion -- the stamp still
 * appears, it just doesn't slam, and the phone stays still.
 */
const STAMP: Record<string, { text: string; tone: "win" | "loss" }> = {
  WIN_TOUCHDOWN: { text: "Touchdown", tone: "win" },
  WIN_FIELD_GOAL: { text: "It's good", tone: "win" },
  LOSS_MISSED_FIELD_GOAL: { text: "No good", tone: "loss" },
  LOSS_CLOCK_EXPIRED: { text: "Time expired", tone: "loss" },
  LOSS_TURNOVER: { text: "Turnover", tone: "loss" },
  LOSS_TURNOVER_ON_DOWNS: { text: "Turnover on downs", tone: "loss" },
};

/** Short double-tap for a score, one flat buzz for a loss. */
const PATTERN = { win: [28, 45, 28], loss: [170] } as const;

export function OutcomeStamp({
  endReason,
  driveKey,
  fallback,
}: {
  endReason: string;
  driveKey: object;
  /** Headline to use if an outcome ever lands without a stamp. */
  fallback: string;
}) {
  // One buzz per drive: the result screen re-renders plenty, and StrictMode
  // double-mounts, so the guard keys on the drive itself (house pattern).
  const buzzedFor = useRef<object | null>(null);
  const stamp = STAMP[endReason];

  useEffect(() => {
    if (!stamp || buzzedFor.current === driveKey) return;
    buzzedFor.current = driveKey;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still || typeof navigator.vibrate !== "function") return;
    try {
      navigator.vibrate(PATTERN[stamp.tone] as unknown as number[]);
    } catch {
      /* vibrate is best-effort and blocked in some contexts */
    }
  }, [stamp, driveKey]);

  if (!stamp) return <h1 className="result-headline">{fallback}</h1>;
  return (
    <h1 className={`outcome-stamp ${stamp.tone}`}>
      <span className="outcome-stamp-text">{stamp.text}</span>
    </h1>
  );
}
