import { useEffect, useState } from "react";
import { trackEvent } from "../../analytics/track";
import {
  kickDistanceFor,
  MANUAL_TEMPO_RANGE,
  MAX_REALISTIC_FIELD_GOAL_DISTANCE,
  playCallKey,
  SPIKE_AVAILABLE_BELOW_CLOCK_SECONDS,
  type DriveSituation,
  type PlayCall,
} from "../../engine";
import { useGameDispatch, useGameState } from "../../state/GameStateProvider";
import { useMode } from "../../state/ModeProvider";
import { isRookie } from "../../state/rookie";
import { ghostDoneAtClock, ghostStepAtClock } from "../../share/ghost";
import { useGhost } from "../../share/GhostProvider";
import { formatBallOn, formatClock } from "../../utils/formatting";
import type { PlayResult } from "../../types/simResult";
import { DriveFieldVisualizer, type FieldTarget } from "./DriveFieldVisualizer";
import { PlayByPlayFeed } from "./PlayByPlayFeed";
import { PlayOptionButtons } from "./PlayOptionButtons";
import { TimeBonusMeter } from "./TimeBonusMeter";

// SPIKE (field-calls branch): play calls live ON the field as tappable targets.
// Default ON for this preview; ?classic=1 restores the button list.
const FIELD_CALLS = typeof window === "undefined" || !window.location.search.includes("classic=1");

/** Visual seat downfield for each call kind (yards past the line of scrimmage).
 * A seat, not a promise -- the engine's depth tiers are unchanged. */
const SEAT_YARDS = { short: 6, medium: 14, deep: 24, run: 3, designedRun: 4 } as const;

/** Stable lane (0 top "left" / 1 middle / 2 bottom "right") per player so the
 * same guy sits in the same lane all drive -- deterministic, everyone's daily
 * looks identical, and it never touches the engine RNG. */
function laneFor(seedText: string): 0 | 1 | 2 {
  let h = 0;
  for (let i = 0; i < seedText.length; i++) h = (h * 31 + seedText.charCodeAt(i)) | 0;
  return (Math.abs(h) % 3) as 0 | 1 | 2;
}
import "./drive.css";

const ANTICIPATION_MS = 700;
const HIGH_LEVERAGE_MS = 1300;

export function DriveScreen() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const [plays, setPlays] = useState<PlayResult[]>([]);
  const [resolving, setResolving] = useState(false);
  const [tempoSeconds, setTempoSeconds] = useState(MANUAL_TEMPO_RANGE.min);
  // While a play resolves we hold the *pre-play* field/scoreboard here, so the
  // ball glides in with the result on reveal rather than jumping the instant the
  // play is chosen. Released (null) on reveal -> the field catches up to live.
  const [held, setHeld] = useState<DriveSituation | null>(null);
  const { mode } = useMode();
  // Snapshotted per mount: rookies get the teaching hints; graduation (any
  // completed drive) retires them for every later drive.
  const [rookie] = useState(isRookie);

  // One drive start per mount (App only mounts DriveScreen while phase is
  // "driving", so this fires once per drive -- draft, replay, or shared link).
  useEffect(() => {
    trackEvent("drive_started", { mode, rookie });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { ghost } = useGhost();

  if (state.phase !== "driving") return null;
  const { roster, session, scenario } = state;

  const options = session.getOptions();
  const live = session.getSituation();
  const display = held ?? live;
  const fieldGoalDistance = kickDistanceFor(live.fieldPosition);
  const canAttemptFieldGoal = fieldGoalDistance <= MAX_REALISTIC_FIELD_GOAL_DISTANCE;
  const canSpike = live.clockRunning && live.clockSeconds < SPIKE_AVAILABLE_BELOW_CLOCK_SECONDS;

  function handleChoose(call: PlayCall) {
    if (resolving) return;
    setResolving(true);
    setHeld(live); // freeze the field/scoreboard at the pre-play snapshot
    const manualTempo = live.clockRunning ? tempoSeconds : undefined;
    // Stretch the anticipation on high-leverage snaps (4th down, a field-goal
    // attempt, or inside the final 30s) so the drama scales with the moment.
    const highLeverage = live.down === 4 || call.kind === "fieldGoal" || live.clockSeconds <= 30;
    // Resolve the play immediately (the session itself advances right away),
    // but hold the reveal -- and the field/scoreboard update -- for a beat.
    const { play, status } = session.choosePlay(call, manualTempo);
    setTimeout(() => {
      setPlays((prev) => [...prev, play]);
      setHeld(null); // release: the ball glides + scoreboard updates with the reveal
      if (status !== "continue") {
        dispatch({ type: "DRIVE_ENDED", driveLog: session.getLog() });
      }
      setResolving(false);
    }, highLeverage ? HIGH_LEVERAGE_MS : ANTICIPATION_MS);
  }

  const lastPlay = plays[plays.length - 1];

  // Field-call targets: seat each dealt option on the turf. Hidden while a play
  // resolves (the snap clears the tablet; they reseat with the new spot on
  // reveal). Collisions bump to the next lane so chips never stack.
  let fieldTargets: FieldTarget[] | undefined;
  if (FIELD_CALLS && !resolving) {
    const lineToGain = live.fieldPosition - live.distance;
    const seated: FieldTarget[] = [];
    for (const call of options) {
      if (call.kind === "fieldGoal" || call.kind === "spike") continue; // stay as buttons
      const player = call.kind === "run" ? roster.rb : call.kind === "designedRun" ? roster.qb : roster[call.target];
      const seat = call.kind === "pass" ? SEAT_YARDS[call.depth] : SEAT_YARDS[call.kind];
      const rawFP = live.fieldPosition - seat;
      const endZone = rawFP <= 0;
      let fp = Math.max(1, rawFP);
      // Deconflict: chips are wide, so same-lane neighbors need real separation
      // (~18 yds). Try the player's home lane then the others; if every lane is
      // crowded at this depth, push the seat further downfield and retry.
      const clear = (l: number, x: number) => !seated.some((t) => t.lane === l && Math.abs(t.fieldPosition - x) < 18);
      const home = laneFor(player.gsisId);
      let lane = home;
      let placed = false;
      for (let bump = 0; bump < 3 && !placed; bump++) {
        for (const cand of [home, ((home + 1) % 3) as 0 | 1 | 2, ((home + 2) % 3) as 0 | 1 | 2]) {
          if (clear(cand, fp)) {
            lane = cand;
            placed = true;
            break;
          }
        }
        if (!placed) fp = Math.max(1, fp - 8); // slide deeper, try again
      }
      const last = player.displayName.split(" ").slice(-1)[0];
      seated.push({
        key: playCallKey(call),
        fieldPosition: fp,
        lane,
        tag: call.kind === "run" ? "RUN" : call.kind === "designedRun" ? "QB" : call.depth === "short" ? "SHORT" : call.depth === "medium" ? "MED" : "DEEP",
        tagClass: call.kind === "pass" ? "tag-pass" : "tag-run",
        label: endZone ? `${last} · EZ` : last,
        beyondSticks: endZone || (lineToGain > 0 && rawFP <= lineToGain),
        endZone,
        disabled: resolving,
        onChoose: () => handleChoose(call),
      });
    }
    fieldTargets = seated;
  }

  // Ghost racing: where the sharer's drive stood at this game clock. Both
  // drives start from the same 4:00, so this is an honest same-clock race.
  const ghostStep = ghost ? ghostStepAtClock(ghost, display.clockSeconds) : null;
  const ghostDone = ghost ? ghostDoneAtClock(ghost, display.clockSeconds) : false;
  const ghostName = ghost?.name ?? "Ghost";

  return (
    <div className="screen drive-screen">
      <TimeBonusMeter clockSeconds={display.clockSeconds} showHint={rookie} />

      <DriveFieldVisualizer
        fieldPosition={display.fieldPosition}
        down={display.down}
        distance={display.distance}
        clockSeconds={display.clockSeconds}
        scoreDiff={scenario.scoreDiff}
        driveStartPosition={scenario.fieldPosition}
        ghostPosition={ghostStep?.fieldPosition}
        targets={fieldTargets}
      />

      {ghost && ghostStep && (
        <p className="ghost-line">
          👻 {ghostName}
          {ghostDone
            ? ghost.won
              ? ` scored ${ghost.score} with ${formatClock(ghost.clockSecondsRemaining)} left — finish the job.`
              : ` is done — their drive died at ${formatBallOn(ghostStep.fieldPosition)}. Outdrive it.`
            : `: ball on ${formatBallOn(ghostStep.fieldPosition)} at this point.`}
        </p>
      )}

      {lastPlay && (
        <p
          key={plays.length}
          className={`last-play-banner ${
            lastPlay.outcome.isTouchdown
              ? "touchdown"
              : lastPlay.outcome.isTurnover
                ? "turnover"
                : lastPlay.outcome.yards >= 20
                  ? "big-gain"
                  : ""
          }`}
        >
          {lastPlay.description}
        </p>
      )}

      <div className="play-panel">
        <div className={`tempo-control ${live.clockRunning ? "" : "stopped"}`}>
          <div className="tempo-control-top">
            <span className="tempo-label">Snap tempo</span>
            {live.clockRunning ? (
              <span className="tempo-readout">{tempoSeconds}s</span>
            ) : (
              <span className="tempo-stopped-chip">Clock stopped</span>
            )}
          </div>
          <input
            type="range"
            className="tempo-slider"
            min={MANUAL_TEMPO_RANGE.min}
            max={MANUAL_TEMPO_RANGE.max}
            value={tempoSeconds}
            disabled={resolving || !live.clockRunning}
            onChange={(e) => setTempoSeconds(Number(e.target.value))}
          />
          {rookie && (
            <p className="tempo-hint">
              {live.clockRunning
                ? "Slow snaps burn clock — and grow your clutch bonus."
                : "Clock stopped — this snap is free."}
            </p>
          )}
        </div>

        {resolving ? (
          <p className="anticipation-indicator">
            Calling the play
            <span className="anticipation-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        ) : (
          <p className="play-panel-heading eyebrow">{FIELD_CALLS ? "Tap a target on the field" : "Call the play"}</p>
        )}
        {!FIELD_CALLS && <PlayOptionButtons options={options} roster={roster} disabled={resolving} onChoose={handleChoose} />}

        {(canAttemptFieldGoal || canSpike) && (
          <div className="persistent-actions">
            {canAttemptFieldGoal && (
              <button
                type="button"
                className="play-option-button field-goal-button"
                disabled={resolving}
                onClick={() => handleChoose({ kind: "fieldGoal" })}
              >
                <span className="play-option-tag tag-fg">FG</span>
                <span className="play-option-text">
                  Kick a {fieldGoalDistance}-yard field goal · {roster.k.displayName}
                </span>
              </button>
            )}
            {canSpike && (
              <button
                type="button"
                className="play-option-button spike-button"
                disabled={resolving}
                onClick={() => handleChoose({ kind: "spike" })}
              >
                <span className="play-option-tag tag-spike">SPK</span>
                <span className="play-option-text">Spike the ball · stop the clock, costs a down</span>
              </button>
            )}
          </div>
        )}
      </div>

      {plays.length > 0 && (
        <div className="drive-log">
          <p className="eyebrow drive-log-heading">Drive log</p>
          <PlayByPlayFeed plays={plays} />
        </div>
      )}
    </div>
  );
}
