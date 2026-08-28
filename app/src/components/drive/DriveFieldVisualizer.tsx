import { useEffect, useState } from "react";
import { formatBallOn, formatClock, ordinalDown } from "../../utils/formatting";
import "./drive.css";

const YARD_TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

/** Visible depth tags are gone (owner call 2026-08-13: position + route shape
 * carry it) -- screen readers and the layout audit still get the semantics. */
const ARIA_KIND: Record<string, string> = {
  SHORT: "short route",
  MED: "medium route",
  DEEP: "deep route",
  SWING: "swing pass out of the backfield",
  IN: "inside run",
  OUT: "outside run",
  QB: "quarterback keeper",
  RUN: "run",
};

/**
 * BROADCAST CAMERA (docs/mobile-field-plan.md option A). A phone renders the
 * full 120-yard world at ~2.5px/yard, which is why routes, rings and the
 * sticks were unreadable. Instead we render the SAME world wider than the
 * viewport and slide it: the visible window follows the ball, so the yards
 * that matter get ~3x the pixels. Desktop keeps the whole field (no pan).
 *
 * The world is the existing flex row (endzone 8.5% | playing area 83% |
 * endzone 8.5%), so every child's `left: X%` positioning is untouched --
 * the camera is purely a wrapper + transform.
 */
const EZ_PCT = 8.5; // one end zone as % of the world
const PLAY_PCT = 100 - 2 * EZ_PCT; // playing area as % of the world
/** Where the line of scrimmage sits in the viewport (0 = left edge): the ball
 * rides left of center so most of the frame is the field you're attacking. */
const LOS_VIEWPORT_FRAC = 0.3;
/** Legibility target. Routes, rings and the sticks stop reading below roughly
 * this much room per yard -- the whole reason the camera exists (a 390px phone
 * showing all 120 yards gets 3.25). */
const TARGET_PX_PER_YARD = 7;
/** Never window tighter than this: the deepest seat is LOS+24, and the frame
 * has to hold the backfield plus that. */
const MIN_WINDOW_YARDS = 52;
const FULL_FIELD_YARDS = 120;

/** How many of the 120 yards to show, from the width we actually have. Wide
 * screens land at 120 (the whole field, no pan -- desktop is unchanged). */
function useVisibleYards(): number {
  const measure = () =>
    typeof window === "undefined"
      ? FULL_FIELD_YARDS
      : Math.max(MIN_WINDOW_YARDS, Math.min(FULL_FIELD_YARDS, window.innerWidth / TARGET_PX_PER_YARD));
  const [yards, setYards] = useState(measure);
  useEffect(() => {
    const onResize = () => setYards(measure());
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return yards;
}

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
  /** Abbreviated tag for phone widths (S/M/D for the pass depths). */
  tagShort: string;
  tagClass: string;
  label: string;
  /** Which side of the ring the label hangs on -- assigned so no two labels
   * ever mash together, even on narrow screens. */
  chipSide: "below" | "above";
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

  // Camera: widen the world and slide it so the LOS sits at LOS_VIEWPORT_FRAC.
  const visibleYards = useVisibleYards();
  const cameraActive = visibleYards < FULL_FIELD_YARDS - 1;
  const worldWidthPct = (FULL_FIELD_YARDS / visibleYards) * 100;
  const viewportFracOfWorld = 100 / worldWidthPct; // how much of the world is on screen
  const losWorldFrac = (EZ_PCT + (progressPct / 100) * PLAY_PCT) / 100;
  const camLeftFrac = Math.max(
    0,
    Math.min(1 - viewportFracOfWorld, losWorldFrac - LOS_VIEWPORT_FRAC * viewportFracOfWorld)
  );
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
      <div className={`field-track ${cameraActive ? "camera" : ""}`}>
        <div
          className="field-world"
          style={{ width: `${worldWidthPct}%`, transform: `translateX(${-camLeftFrac * 100}%)` }}
        >
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
            // Seats are clamped to what the CAMERA can see, not to the world:
            // under the camera the playing area is wider than the screen, so a
            // backfield seat could pan out of frame entirely (audit-caught).
            // Work in world fractions, clamp to the visible window with room
            // for the ring, then convert back to playing-area %.
            const rawWorld = (EZ_PCT + ((100 - t.fieldPosition) / 100) * PLAY_PCT) / 100;
            const ringMargin = 0.055 * viewportFracOfWorld; // half a ring + breathing room
            const world = Math.max(
              camLeftFrac + ringMargin,
              Math.min(camLeftFrac + viewportFracOfWorld - ringMargin, rawWorld)
            );
            const left = ((world * 100 - EZ_PCT) / PLAY_PCT) * 100;
            // Chip containment is a VIEWPORT question, so shift by where the
            // ring sits on screen (0 = left edge, 100 = right edge).
            const viewportPct = ((world - camLeftFrac) / viewportFracOfWorld) * 100;
            return (
            <button
              key={t.key}
              type="button"
              aria-label={`${t.label} — ${ARIA_KIND[t.tag] ?? t.tag}`}
              data-depth={t.tag === "SHORT" ? "short" : t.tag === "MED" ? "medium" : t.tag === "DEEP" ? "deep" : undefined}
              className={`field-target ${t.beyondSticks ? "sticks" : ""} ${t.endZone ? "endzone" : ""} ${
                t.chipSide === "above" ? "chip-above" : ""
              }`}
              style={{
                left: `${left}%`,
                top: `${[17, 50, 83][t.lane]}%`,
                ["--chip-shift" as string]: `${-viewportPct}%`,
              }}
              disabled={t.disabled}
              onClick={t.onChoose}
            >
              <span className={`field-target-ring ${t.tagClass}`} aria-hidden="true" />
              <span className="field-target-chip">
                <i>{t.label}</i>
              </span>
            </button>
            );
          })}
        </div>
        <div className="field-endzone away">Four Minute Drill</div>
        </div>
      </div>
      {cameraActive && (
        /* Minimap: the whole drive at a glance -- ball, sticks, and which
           slice of the field the camera is showing. */
        <div className="field-minimap" aria-hidden="true">
          <div
            className="fm-window"
            style={{ left: `${camLeftFrac * 100}%`, width: `${viewportFracOfWorld * 100}%` }}
          />
          {startPct !== undefined && (
            <div
              className="fm-trail"
              style={{
                left: `${EZ_PCT + (startPct / 100) * PLAY_PCT}%`,
                width: `${Math.max(0, ((progressPct - startPct) / 100) * PLAY_PCT)}%`,
              }}
            />
          )}
          {fdPct !== undefined && (
            <div className="fm-fd" style={{ left: `${EZ_PCT + (fdPct / 100) * PLAY_PCT}%` }} />
          )}
          <div className="fm-ball" style={{ left: `${EZ_PCT + (progressPct / 100) * PLAY_PCT}%` }} />
        </div>
      )}
      {/* Live drive already shows BALL ON in the scoreboard; the label only adds
          context on scoreboard-less renders (the result recap). */}
      {!showScoreboard && <div className="field-label">{fieldPosition} yards to the end zone</div>}
    </div>
  );
}
