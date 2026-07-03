import type { CSSProperties } from "react";
import { payoutMultiplier } from "../../engine";
import type { ManifestPlayerEntry } from "../../types/player";
import { formatPayout, payoutBand } from "../../utils/formatting";
import "./draft.css";

export function PlayerCard({
  player,
  selected,
  onSelect,
  large,
  readOnly,
  index,
  picked,
}: {
  player: ManifestPlayerEntry;
  selected: boolean;
  onSelect?: () => void;
  large?: boolean;
  readOnly?: boolean;
  /** Position within the dealt trio, used to stagger the deal-in animation. */
  index?: number;
  /** The card the player just chose -- gets a confirming scale-pop. */
  picked?: boolean;
}) {
  const payout = payoutMultiplier(player.rating);
  const band = payoutBand(payout);
  const className = `player-card payout-${band} ${selected ? "selected" : ""} ${picked ? "picked" : ""} ${
    large ? "large" : ""
  } ${readOnly ? "read-only" : ""}`;
  const content = (
    <>
      <div className="player-card-top">
        <span className="player-card-position">{player.position}</span>
        <span className="player-card-rating" title="Payout multiplier — bigger = more points if you score">
          <span className="player-card-rating-num">{formatPayout(payout)}</span>
          <span className="player-card-rating-label">payout</span>
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
    <button
      type="button"
      className={className}
      style={index !== undefined ? ({ "--i": index } as CSSProperties) : undefined}
      onClick={onSelect}
    >
      {content}
    </button>
  );
}
