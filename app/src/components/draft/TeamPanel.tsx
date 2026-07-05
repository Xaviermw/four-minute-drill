import { useManifest } from "../../data/dataContext";
import type { ManifestPlayerEntry, Position } from "../../types/player";
import type { RosterSlotKey } from "../../types/roster";
import { CAP, getPricing } from "../../draft/pricing";
import { PlayerCard } from "./PlayerCard";
import "./draft.css";

export function TeamPanel({
  slots,
  roster,
  cap = CAP,
}: {
  slots: { key: RosterSlotKey; label: string; position: Position }[];
  roster: Partial<Record<RosterSlotKey, ManifestPlayerEntry>>;
  /** The day's cap (theme days may vary it); defaults to the standard $25. */
  cap?: number;
}) {
  const { manifest } = useManifest();
  const pricing = manifest ? getPricing(manifest.players) : null;
  const picked = slots.map((s) => roster[s.key]).filter((p): p is ManifestPlayerEntry => Boolean(p));
  const spent = pricing ? picked.reduce((sum, p) => sum + pricing.priceFor(p), 0) : 0;
  const left = cap - spent;

  return (
    <div className="team-panel">
      <div className="budget-tracker">
        <div className="budget-top">
          <span className="eyebrow">Team budget</span>
          <span className="budget-nums">
            <span className="budget-spent">${spent} spent</span>
            <span className="budget-sep">·</span>
            <span className="budget-left">${left} left</span>
          </span>
        </div>
        <div
          className="budget-track"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={cap}
          aria-valuenow={spent}
          aria-label={`Budget: $${spent} of $${cap} spent`}
        >
          {Array.from({ length: cap }, (_, i) => (
            <span key={i} className={`budget-seg ${i < spent ? "spent" : ""}`} />
          ))}
        </div>
        <p className="budget-note">
          Out of cash? <span className="budget-note-em">Scrubs are always $0.</span>
        </p>
      </div>
      <div className="team-panel-grid">
        {slots.map((slot) => {
          const player = roster[slot.key];
          return player ? (
            <PlayerCard key={slot.key} player={player} selected readOnly price={pricing?.priceFor(player)} />
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
