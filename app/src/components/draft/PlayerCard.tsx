import type { CSSProperties } from "react";
import { payoutMultiplier } from "../../engine";
import type { ManifestPlayerEntry } from "../../types/player";
import { formatPayout, payoutBand } from "../../utils/formatting";
import { teamColors } from "../../utils/teamColors";
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
  const tc = teamColors(player.team);
  const teamLabel = tc.name || player.team || "";
  const className = `player-card payout-${band} ${selected ? "selected" : ""} ${picked ? "picked" : ""} ${
    large ? "large" : ""
  } ${readOnly ? "read-only" : ""}`;

  const content = (
    <>
      <div className="pc-band" style={{ "--team": tc.primary, "--team2": tc.secondary } as CSSProperties}>
        {player.jersey != null && <span className="pc-jersey">{player.jersey}</span>}
        <span className="pc-who">
          <span className="pc-name">{player.displayName}</span>
          <span className="pc-team">{teamLabel ? `${teamLabel} · ${player.position}` : player.position}</span>
        </span>
        <span className="pc-payout" title="Payout multiplier — bigger = more points if you score">
          <b>{formatPayout(payout)}</b>
          <i>payout</i>
        </span>
      </div>
      <div className="pc-stats">
        <span className="pc-hl">{player.flavorStats.subline}</span>
        <span className="pc-sub">{player.flavorStats.headline}</span>
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
