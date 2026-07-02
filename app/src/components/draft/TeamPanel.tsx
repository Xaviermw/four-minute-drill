import type { ManifestPlayerEntry, Position } from "../../types/player";
import type { RosterSlotKey } from "../../types/roster";
import { PlayerCard } from "./PlayerCard";
import "./draft.css";

const RATING_FLOOR = 40;
const RATING_CEIL = 99;

function powerLabel(ovr: number): string {
  if (ovr < 62) return "Underdog squad";
  if (ovr < 74) return "Scrappy roster";
  if (ovr < 84) return "Balanced roster";
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
  const ovr = hasPicks ? Math.round(picked.reduce((sum, p) => sum + p.rating, 0) / picked.length) : 0;
  const fillPct = hasPicks ? ((ovr - RATING_FLOOR) / (RATING_CEIL - RATING_FLOOR)) * 100 : 0;

  return (
    <div className="team-panel">
      <div className="power-meter">
        <div className={`ovr-badge ${hasPicks ? "" : "ovr-empty"}`}>
          <span className="ovr-num">{hasPicks ? ovr : "--"}</span>
          <span className="ovr-label">OVR</span>
        </div>
        <div className="power-meter-body">
          <div className="power-meter-header">
            <span className="eyebrow">Team Overall</span>
            <span className="power-meter-verdict">
              {hasPicks ? powerLabel(ovr) : "Draft a player to find out"}
            </span>
          </div>
          <div className="power-meter-track">
            <div className="power-meter-fill" style={{ width: `${Math.max(fillPct, 0)}%` }} />
          </div>
          <div className="power-meter-scale">
            <span>40</span>
            <span>99</span>
          </div>
          <p className="power-meter-note">
            <span className="note-up">Higher OVR wins easier</span>
            <span className="note-sep">·</span>
            <span className="note-down">lower OVR scores way more</span>
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
