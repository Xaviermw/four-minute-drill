import { formatBallOn, formatClock, ordinalDown } from "../../utils/formatting";
import "./drive.css";

const YARD_TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

export function DriveFieldVisualizer({
  fieldPosition,
  down,
  distance,
  clockSeconds,
  scoreDiff,
  driveStartPosition,
}: {
  fieldPosition: number;
  down?: number;
  distance?: number;
  clockSeconds?: number;
  scoreDiff?: number;
  /** Yards-to-end-zone where this drive began, for the drive trail. */
  driveStartPosition?: number;
}) {
  // fieldPosition = yards to go to the opponent's goal line (yardline_100 convention).
  const progressPct = Math.max(0, Math.min(100, 100 - fieldPosition));
  const showScoreboard = down !== undefined && clockSeconds !== undefined;
  const clockUrgent = clockSeconds !== undefined && clockSeconds < 60;
  const clockCritical = clockSeconds !== undefined && clockSeconds <= 10;

  // First-down line: only on the live drive (down + distance present), hidden
  // when the line to gain is in the end zone (goal-to-go).
  const lineToGain = distance !== undefined ? fieldPosition - distance : undefined;
  const fdPct = lineToGain !== undefined && lineToGain > 0 ? 100 - lineToGain : undefined;

  const startPct = driveStartPosition !== undefined ? Math.max(0, Math.min(100, 100 - driveStartPosition)) : undefined;

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
            <span className={`sb-value sb-clock-value ${clockCritical ? "critical" : clockUrgent ? "urgent" : ""}`}>
              {clockSeconds !== undefined ? formatClock(clockSeconds) : "—"}
            </span>
          </div>
        </div>
      )}
      <div className="field-track">
        <div className="field-endzone home">HOME</div>
        <div className="field-playing-area">
          <div className="field-stripes" />
          {YARD_TICKS.map((yard, idx) => {
            const displayYard = yard <= 50 ? yard : 100 - yard;
            const pointsRight = yard <= 50;
            const cls = `field-tick-label ${pointsRight ? "chevron-right" : "chevron-left"}`;
            return (
              <div key={yard} className={`field-tick ${idx % 2 === 0 ? "tick-alt" : ""}`} style={{ left: `${yard}%` }}>
                <span className={`${cls} top`}>{displayYard}</span>
                <span className={`${cls} bot`}>{displayYard}</span>
              </div>
            );
          })}
          <div className="field-hash-row top" />
          <div className="field-hash-row bottom" />
          <span className="field-wordmark">4MD</span>

          {startPct !== undefined && (
            <>
              <div
                className="field-trail"
                style={{ left: `${startPct}%`, width: `${Math.max(0, progressPct - startPct)}%` }}
              />
              <div className="field-start" style={{ left: `${startPct}%` }} />
            </>
          )}

          {fdPct !== undefined && (
            <div className="field-fd" style={{ left: `${fdPct}%` }}>
              <span className="field-fd-tag">1ST</span>
            </div>
          )}

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
