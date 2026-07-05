import type { ManifestPlayerEntry } from "../../types/player";
import { PlayerCard } from "./PlayerCard";
import "./draft.css";

export function RosterSlotPicker({
  label,
  options,
  selected,
  onPick,
  large,
  pickedId,
  priceFor,
  budget,
  onScrub,
  positionLabel,
}: {
  label: string;
  options: ManifestPlayerEntry[];
  selected: ManifestPlayerEntry | null;
  onPick: (player: ManifestPlayerEntry) => void;
  large?: boolean;
  pickedId?: string | null;
  /** Cap-draft: price each card and lock any over the remaining budget. */
  priceFor?: (player: ManifestPlayerEntry) => number;
  budget?: number;
  /** The $0 scrub gamble for this slot. */
  onScrub?: () => void;
  positionLabel?: string;
}) {
  return (
    <div className="roster-slot">
      <div className="roster-slot-header">
        <span className="roster-slot-label">{label}</span>
        <span className="roster-slot-value">{selected ? selected.displayName : "Pick one of the 3..."}</span>
      </div>
      <div className={`player-grid ${large ? "large" : ""}`}>
        {options.map((player, i) => {
          const price = priceFor?.(player);
          return (
            <PlayerCard
              key={player.gsisId}
              player={player}
              index={i}
              picked={player.gsisId === pickedId}
              selected={player.gsisId === selected?.gsisId}
              onSelect={() => onPick(player)}
              large={large}
              price={price}
              locked={price !== undefined && budget !== undefined && price > budget}
            />
          );
        })}
      </div>
      {onScrub && (
        <button type="button" className="scrub-btn" onClick={onScrub}>
          <span className="scrub-dice" aria-hidden="true">🎲</span>
          <span className="scrub-copy">
            <b>Give me a scrub · $0</b>
            <i>Random {positionLabel ?? "player"} from the bargain bin — you don't pick who.</i>
          </span>
        </button>
      )}
    </div>
  );
}
