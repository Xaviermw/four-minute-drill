import { formatBallOn, formatClock, ordinalDown } from "../../utils/formatting";
import "./drive.css";

const YARD_TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

export function DriveFieldVisualizer({
  fieldPosition,
  down,
  distance,
  clockSeconds,
  scoreDiff,
}: {
  fieldPosition: number;
  down?: number;
  distance?: number;
  clockSeconds?: number;
  scoreDiff?: number;
}) {
  // fieldPosition = yards to go to the opponent's goal line (yardline_100 convention).
  const progressPct = Math.max(0, Math.min(100, 100 - fieldPosition));
  const showScoreboard = down !== undefined && clockSeconds !== undefined;
  const clockUrgent = clockSeconds !== undefined && clockSeconds < 60;
  const clockCritical = clockSeconds !== undefined && clockSeconds <= 10;

  return (
    <div className="field-visualizer">
      {showScoreboard && (
        <div className="scoreboard">
          <div className="sb-cell">
            <span className="sb-label">Down</span>
            <span className="sb-value">
              {down !== undefined && distance !== undefined ? `${ordinalDown(down)} & ${distance}` : "—"}
            </span>
          </div>
          <div className="sb-cell">
            <span className="sb-label">Ball On</span>
            <span className="sb-value">{formatBallOn(fieldPosition)}</span>
          </div>
          {scoreDiff !== undefined && (
            <div className="sb-cell sb-score">
              <span className="sb-label">Score</span>
              <span className="sb-value sb-deficit">Down {-scoreDiff}</span>
            </div>
          )}
          <div className="sb-cell sb-clock">
            <span className="sb-label">Clock</span>
            <span
              className={`sb-value sb-clock-value ${clockCritical ? "critical" : clockUrgent ? "urgent" : ""}`}
            >
              {clockSeconds !== undefined ? formatClock(clockSeconds) : "—"}
            </span>
          </div>
        </div>
      )}
      <div className="field-track">
        <div className="field-endzone home">HOME</div>
        <div className="field-playing-area">
          <div className="field-stripes" />
          <div className="field-progress" style={{ width: `${progressPct}%` }} />
          <div className="field-hash-row top" />
          <div className="field-hash-row bottom" />
          {YARD_TICKS.map((yard) => {
            const displayYard = yard <= 50 ? yard : 100 - yard;
            const pointsRight = yard <= 50;
            return (
              <div key={yard} className="field-tick" style={{ left: `${yard}%` }}>
                <span className={`field-tick-label ${pointsRight ? "chevron-right" : "chevron-left"}`}>{displayYard}</span>
              </div>
            );
          })}
          <div className="field-marker" style={{ left: `${progressPct}%` }}>
            <div className="field-ball" />
          </div>
        </div>
        <div className="field-endzone away">AWAY</div>
      </div>
      <div className="field-label">{fieldPosition} yards to the end zone</div>
    </div>
  );
}
