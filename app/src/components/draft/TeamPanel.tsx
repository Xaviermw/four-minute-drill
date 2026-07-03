import { rosterPayoutMultiplier } from "../../engine";
import type { ManifestPlayerEntry, Position } from "../../types/player";
import type { RosterSlotKey } from "../../types/roster";
import { formatPayout } from "../../utils/formatting";
import { useTween } from "../../utils/useTween";
import { PlayerCard } from "./PlayerCard";
import "./draft.css";

const MIN_PAYOUT = 1.0;
const MAX_PAYOUT = 2.0;

function squadLabel(payout: number): string {
  if (payout >= 1.7) return "Underdog squad";
  if (payout >= 1.45) return "Scrappy roster";
  if (payout >= 1.2) return "Balanced roster";
  return "Stacked roster";
}

export function TeamPanel({
  slots,
  roster,
}: {
  slots: { key: RosterSlotKey; label: string; position: Position }[];
  roster: Partial<Record<RosterSlotKey, ManifestPlayerEntry>>;
}) {
  const picked = slots.map((s) => roster[s.key]).filter((p): p is ManifestPlayerEntry => Boolean(p));
  const hasPicks = picked.length > 0;
  const payout = hasPicks ? rosterPayoutMultiplier(picked.map((p) => p.rating)) : MIN_PAYOUT;
  const shownPayout = useTween(payout);
  const fillPct = hasPicks ? ((payout - MIN_PAYOUT) / (MAX_PAYOUT - MIN_PAYOUT)) * 100 : 0;

  return (
    <div className="team-panel">
      <div className="power-meter">
        <div className={`ovr-badge ${hasPicks ? "" : "ovr-empty"}`}>
          <span className="ovr-num">{hasPicks ? formatPayout(shownPayout) : "--"}</span>
          <span className="ovr-label">payout</span>
        </div>
        <div className="power-meter-body">
          <div className="power-meter-header">
            <span className="eyebrow">Team Payout</span>
            <span className="power-meter-verdict">
              {hasPicks ? squadLabel(payout) : "Draft a player to find out"}
            </span>
          </div>
          <div className="power-meter-track">
            <div className="power-meter-fill" style={{ width: `${Math.max(fillPct, 0)}%` }} />
          </div>
          <div className="power-meter-scale">
            <span>×1.0</span>
            <span>×2.0</span>
          </div>
          <p className="power-meter-note">
            <span className="note-up">Bigger payout = more points</span>
            <span className="note-sep">·</span>
            <span className="note-down">but a weaker squad is harder to score with</span>
          </p>
        </div>
      </div>
      <div className="team-panel-grid">
        {slots.map((slot) => {
          const player = roster[slot.key];
          return player ? (
            <PlayerCard key={slot.key} player={player} selected readOnly />
          ) : (
            <div key={slot.key} className="player-card placeholder">
              <div className="placeholder-pos">{slot.position}</div>
              <div className="placeholder-label">{slot.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
