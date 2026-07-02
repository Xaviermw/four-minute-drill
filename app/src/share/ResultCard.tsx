import { forwardRef } from "react";
import type { DraftedRoster, RosterSlotKey } from "../types/roster";
import type { DriveLog } from "../types/simResult";
import { teamOverall } from "../utils/rosterStats";
import { ratingBand } from "../utils/formatting";
import "./resultCard.css";

const OUTCOME: Record<string, string> = {
  WIN_TOUCHDOWN: "TOUCHDOWN",
  WIN_FIELD_GOAL: "FIELD GOAL",
  LOSS_TURNOVER: "TURNOVER",
  LOSS_TURNOVER_ON_DOWNS: "TURNOVER ON DOWNS",
  LOSS_CLOCK_EXPIRED: "TIME EXPIRED",
  LOSS_MISSED_FIELD_GOAL: "NO GOOD",
};

const ROWS: { slot: RosterSlotKey; label: string }[] = [
  { slot: "qb", label: "QB" },
  { slot: "rb", label: "RB" },
  { slot: "wr1", label: "WR" },
  { slot: "wr2", label: "WR" },
  { slot: "te", label: "TE" },
  { slot: "k", label: "K" },
];

/**
 * Off-screen, fixed-size (540x675, snapshotted at 2x) social card for a drive
 * result. Self-contained styling in resultCard.css so html-to-image renders it
 * faithfully regardless of the surrounding app layout.
 */
export const ResultCard = forwardRef<HTMLDivElement, { driveLog: DriveLog; roster: DraftedRoster }>(
  function ResultCard({ driveLog, roster }, ref) {
    const ovr = teamOverall(roster);
    return (
      <div className={`result-card ${driveLog.won ? "won" : "lost"}`} ref={ref}>
        <div className="rc-header">
          <span className="rc-brand">🏈 FOUR MINUTE DRILL</span>
          <span className="rc-ovr">{ovr} OVR</span>
        </div>

        <div className="rc-hero">
          <div className="rc-outcome">{OUTCOME[driveLog.endReason] ?? driveLog.endReason}</div>
          <div className="rc-score">
            <span className="rc-score-num">{driveLog.won ? driveLog.score : 0}</span>
            <span className="rc-score-unit">PTS</span>
          </div>
        </div>

        <div className="rc-roster">
          {ROWS.map(({ slot, label }) => {
            const p = roster[slot];
            return (
              <div className="rc-player" key={slot}>
                <span className="rc-player-pos">{label}</span>
                <span className="rc-player-name">{p.displayName}</span>
                <span className={`rc-player-ovr band-${ratingBand(p.rating)}`}>{p.rating}</span>
              </div>
            );
          })}
        </div>

        <div className="rc-footer">Can you beat it? · fourminutedrill</div>
      </div>
    );
  }
);
