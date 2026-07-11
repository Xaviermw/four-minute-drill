import { formatBallOn, formatClock, ordinalDown } from "../../utils/formatting";
import "./drive.css";

const YARD_TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

/** A tappable play-call target seated on the field (spike/field-calls). */
export interface FieldTarget {
  key: string;
  /** Yards-to-end-zone the target sits at (visual seat, not a promise). */
  fieldPosition: number;
  /** Vertical lane: 0 top ("left"), 1 middle, 2 bottom ("right"). */
  lane: 0 | 1 | 2;
  /** Chalk scribble (route/handoff path) in field % coords, ending at the
   * target ring. Pure flavor -- the tag carries the real mechanic. */
  route?: { x: number; y: number }[];
  tag: string;
  tagClass: string;
  label: string;
  /** Past the line to gain -- rendered with the gold conversion ring. */
  beyondSticks: boolean;
  endZone: boolean;
  disabled: boolean;
  onChoose: () => void;
}

export function DriveFieldVisualizer({
  fieldPosition,
  down,
  distance,
  clockSeconds,
  scoreDiff,
  driveStartPosition,
  ghostPosition,
  targets,
}: {
  fieldPosition: number;
  down?: number;
  distance?: number;
  clockSeconds?: number;
  scoreDiff?: number;
  /** Yards-to-end-zone where this drive began, for the drive trail. */
  driveStartPosition?: number;
  /** Where the ghost's drive stood at this game clock (ghost racing). */
  ghostPosition?: number;
  /** Field-call mode: the dealt options as tappable targets on the turf. */
  targets?: FieldTarget[];
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
        <div className="field-endzone home">Four Minute Drill</div>
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

          {ghostPosition !== undefined && (
            <div
              className="field-ghost"
              style={{ left: `${Math.max(0, Math.min(100, 100 - ghostPosition))}%` }}
              title="The ghost's ball at this game clock"
            />
          )}

          <div className="field-marker" style={{ left: `${progressPct}%` }}>
            <div className="field-ball" />
          </div>

          {targets && targets.some((t) => t.route) && (
            <svg className="field-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {targets.map(
                (t) =>
                  t.route && (
                    <polyline
                      key={t.key}
                      points={t.route.map((p) => `${p.x},${p.y}`).join(" ")}
                      className={t.tagClass}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
              )}
            </svg>
          )}

          {targets?.map((t) => {
            // Clamp keeps the 38px ring button on the turf; --chip-shift slides
            // the wider chip by (50 - left)% of its own width so it is contained
            // for ANY chip width at either goal line (background-position trick).
            const left = Math.max(5, Math.min(95, 100 - t.fieldPosition));
            return (
            <button
              key={t.key}
              type="button"
              className={`field-target ${t.beyondSticks ? "sticks" : ""} ${t.endZone ? "endzone" : ""}`}
              style={{
                left: `${left}%`,
                top: `${[24, 50, 76][t.lane]}%`,
                ["--chip-shift" as string]: `${50 - left}%`,
              }}
              disabled={t.disabled}
              onClick={t.onChoose}
            >
              <span className={`field-target-ring ${t.tagClass}`} aria-hidden="true" />
              <span className="field-target-chip">
                <b className={t.tagClass}>{t.tag}</b>
                <i>{t.label}</i>
              </span>
            </button>
            );
          })}
        </div>
        <div className="field-endzone away">Four Minute Drill</div>
      </div>
      {/* Live drive already shows BALL ON in the scoreboard; the label only adds
          context on scoreboard-less renders (the result recap). */}
      {!showScoreboard && <div className="field-label">{fieldPosition} yards to the end zone</div>}
    </div>
  );
}
