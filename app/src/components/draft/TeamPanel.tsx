import { useManifest } from "../../data/dataContext";
import type { ManifestPlayerEntry, Position } from "../../types/player";
import type { RosterSlotKey } from "../../types/roster";
import { CAP, getPricing } from "../../draft/pricing";
import { isRookie } from "../../state/rookie";
import { PlayerCard } from "./PlayerCard";
import "./draft.css";

/** The cap meter, rendered ABOVE the picker so the budget is on screen while
 * choosing (owner layout call, 2026-07-09) -- the drafted-team grid lives
 * separately below the picker. */
export function BudgetTracker({ cap = CAP, spent }: { cap?: number; spent: number }) {
  const left = cap - spent;
  return (
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
      {isRookie() && (
        <p className="budget-note">
          Out of cash? <span className="budget-note-em">Scrubs are always $0.</span>
        </p>
      )}
    </div>
  );
}

/** The drafted-team grid (filled cards + placeholders). */
export function TeamPanel({
  slots,
  roster,
}: {
  slots: { key: RosterSlotKey; label: string; position: Position }[];
  roster: Partial<Record<RosterSlotKey, ManifestPlayerEntry>>;
}) {
  const { manifest } = useManifest();
  const pricing = manifest ? getPricing(manifest.players) : null;

  return (
    <div className="team-panel">
      <p className="eyebrow team-panel-eyebrow">Your team</p>
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
