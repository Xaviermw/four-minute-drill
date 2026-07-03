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
}: {
  label: string;
  options: ManifestPlayerEntry[];
  selected: ManifestPlayerEntry | null;
  onPick: (player: ManifestPlayerEntry) => void;
  large?: boolean;
  pickedId?: string | null;
}) {
  return (
    <div className="roster-slot">
      <div className="roster-slot-header">
        <span className="roster-slot-label">{label}</span>
        <span className="roster-slot-value">{selected ? selected.displayName : "Pick one of the 3..."}</span>
      </div>
      <div className={`player-grid ${large ? "large" : ""}`}>
        {options.map((player, i) => (
          <PlayerCard
            key={player.gsisId}
            player={player}
            index={i}
            picked={player.gsisId === pickedId}
            selected={player.gsisId === selected?.gsisId}
            onSelect={() => onPick(player)}
            large={large}
          />
        ))}
      </div>
    </div>
  );
}
