import { useState } from "react";
import {
  kickDistanceFor,
  MANUAL_TEMPO_RANGE,
  MAX_REALISTIC_FIELD_GOAL_DISTANCE,
  SPIKE_AVAILABLE_BELOW_CLOCK_SECONDS,
  type DriveSituation,
  type PlayCall,
} from "../../engine";
import { useGameDispatch, useGameState } from "../../state/GameStateProvider";
import type { PlayResult } from "../../types/simResult";
import { DriveFieldVisualizer } from "./DriveFieldVisualizer";
import { PlayByPlayFeed } from "./PlayByPlayFeed";
import { PlayOptionButtons } from "./PlayOptionButtons";
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

  return (
    <div className="screen drive-screen">
      <DriveFieldVisualizer
        fieldPosition={display.fieldPosition}
        down={display.down}
        distance={display.distance}
        clockSeconds={display.clockSeconds}
        scoreDiff={scenario.scoreDiff}
      />

      <p className="stakes-strip">
        <span className="stakes-deficit">Down by {-scenario.scoreDiff}</span> · one drive to win it
      </p>

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
          <p className="tempo-hint">
            {live.clockRunning
              ? "Snap quick to save clock, or milk it if you've got time to spare."
              : "Clock's stopped — this snap costs nothing extra."}
          </p>
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
          <p className="play-panel-heading eyebrow">Call the play</p>
        )}
        <PlayOptionButtons options={options} roster={roster} disabled={resolving} onChoose={handleChoose} />

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
