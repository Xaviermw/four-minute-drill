import { forwardRef } from "react";
import { CAP } from "../draft/pricing";
import type { DraftedRoster, RosterSlotKey } from "../types/roster";
import type { DriveLog } from "../types/simResult";
import type { ManifestPlayerEntry } from "../types/player";
import { teamColors } from "../utils/teamColors";
import type { CSSProperties } from "react";
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
export const ResultCard = forwardRef<
  HTMLDivElement,
  { driveLog: DriveLog; roster: DraftedRoster; spend?: number; cap?: number; priceFor?: (p: ManifestPlayerEntry) => number }
>(function ResultCard({ driveLog, roster, spend, cap = CAP, priceFor }, ref) {
    return (
      <div className={`result-card ${driveLog.won ? "won" : "lost"}`} ref={ref}>
        <div className="rc-header">
          <span className="rc-brand">🏈 FOUR MINUTE DRILL</span>
          {spend !== undefined && <span className="rc-ovr">${spend} of ${cap}</span>}
        </div>

        <div className="rc-hero">
          <div className="rc-outcome">{OUTCOME[driveLog.endReason] ?? driveLog.endReason}</div>
          <div className="rc-score">
            <span className="rc-score-num">{driveLog.score}</span>
            <span className="rc-score-unit">PTS</span>
          </div>
        </div>

        <div className="rc-roster">
          {ROWS.map(({ slot, label }) => {
            const p = roster[slot];
            const tc = teamColors(p.team);
            return (
              <div
                className="rc-player"
                key={slot}
                style={{ "--team": tc.primary, "--team2": tc.secondary } as CSSProperties}
              >
                <span className="rc-player-pos">{label}</span>
                {p.jersey != null && <span className="rc-player-jersey">{p.jersey}</span>}
                <span className="rc-player-name">{p.displayName}</span>
                <span className="rc-player-price">{priceFor ? `$${priceFor(p)}` : ""}</span>
              </div>
            );
          })}
        </div>

        <div className="rc-footer">Can you beat it? · fourminutedrill</div>
      </div>
    );
  }
);
