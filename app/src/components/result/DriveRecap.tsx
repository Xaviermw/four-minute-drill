import type { DriveLog } from "../../types/simResult";
import { DriveFieldVisualizer } from "../drive/DriveFieldVisualizer";
import { PlayByPlayFeed } from "../drive/PlayByPlayFeed";

/** Collapsible field + play-by-play, shared by the result and daily-done
 * screens so the log doesn't bury the actions. Default collapsed. */
export function DriveRecap({ driveLog }: { driveLog: DriveLog }) {
  const lastPlay = driveLog.plays[driveLog.plays.length - 1];
  const finalFieldPosition = lastPlay ? Math.max(0, lastPlay.fieldPosition - lastPlay.outcome.yards) : 50;
  return (
    <details className="drive-recap">
      <summary className="drive-recap-summary">
        Final field position &amp; full drive · {driveLog.plays.length} plays
      </summary>
      <div className="drive-recap-body">
        <DriveFieldVisualizer
          fieldPosition={finalFieldPosition}
          driveStartPosition={driveLog.plays[0]?.fieldPosition}
        />
        <div className="drive-log">
          <PlayByPlayFeed plays={driveLog.plays} />
        </div>
      </div>
    </details>
  );
}
