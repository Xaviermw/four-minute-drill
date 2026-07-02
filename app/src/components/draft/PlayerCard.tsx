import type { ManifestPlayerEntry } from "../../types/player";
import { ratingBand } from "../../utils/formatting";
import "./draft.css";

export function PlayerCard({
  player,
  selected,
  onSelect,
  large,
  readOnly,
}: {
  player: ManifestPlayerEntry;
  selected: boolean;
  onSelect?: () => void;
  large?: boolean;
  readOnly?: boolean;
}) {
  const band = ratingBand(player.rating);
  const className = `player-card band-${band} ${selected ? "selected" : ""} ${large ? "large" : ""} ${
    readOnly ? "read-only" : ""
  }`;
  const content = (
    <>
      <div className="player-card-top">
        <span className="player-card-position">{player.position}</span>
        <span className="player-card-rating">
          <span className="player-card-rating-num">{player.rating}</span>
          <span className="player-card-rating-label">OVR</span>
        </span>
      </div>
      <div className="player-card-name">{player.displayName}</div>
      <div className="player-card-flavor">
        <div className="subline">{player.flavorStats.subline}</div>
        <div className="headline">{player.flavorStats.headline}</div>
      </div>
    </>
  );

  if (readOnly) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" className={className} onClick={onSelect}>
      {content}
    </button>
  );
}
