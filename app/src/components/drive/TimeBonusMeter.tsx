import { clutchMultiplier, CLUTCH_REFERENCE_SECONDS } from "../../engine";
import "./drive.css";

/**
 * Live preview of the clutch (time) bonus a score *right now* would earn. Reads
 * the exact same `clutchMultiplier` the engine uses to compute the final score,
 * so the meter never lies: ×1.0 with 2:00+ on the clock, climbing to ×2.0 at
 * 0:00. Gives the player a reason to milk the clock before punching it in.
 */
export function TimeBonusMeter({ clockSeconds }: { clockSeconds: number }) {
  const mult = clutchMultiplier(clockSeconds);
  const fill = Math.max(0, Math.min(1, mult - 1)); // 0 at ×1.0, 1 at ×2.0
  const live = clockSeconds < CLUTCH_REFERENCE_SECONDS;
  return (
    <div className={`time-bonus ${live ? "live" : ""}`}>
      <div className="tb-top">
        <span className="tb-label">Clutch bonus</span>
        <span className="tb-value">×{mult.toFixed(2)}</span>
      </div>
      <div className="tb-track">
        <div className="tb-fill" style={{ width: `${fill * 100}%` }} />
      </div>
      <p className="tb-hint">{live ? "Max ×2.00 at 0:00." : "Kicks in under 2:00."}</p>
    </div>
  );
}
