import { describePlayCall, payoutMultiplier, playCallKey, type PlayCall } from "../../engine";
import type { DraftedRoster, RosterSlotKey } from "../../types/roster";
import { formatPayout, payoutBand } from "../../utils/formatting";
import "./drive.css";

/** The roster slot a call features, so we can show that player's payout -- the
 * multiplier their score would earn. FG/spike don't feature a scorer this way. */
function targetSlot(call: PlayCall): RosterSlotKey | null {
  if (call.kind === "run") return "rb";
  if (call.kind === "designedRun") return "qb";
  if (call.kind === "pass") return call.target;
  return null;
}

function callTag(call: PlayCall): { text: string; cls: string } {
  switch (call.kind) {
    case "run":
      return { text: "RUN", cls: "tag-run" };
    case "designedRun":
      return { text: "QB", cls: "tag-run" };
    case "pass":
      return {
        text: call.depth === "short" ? "SHORT" : call.depth === "medium" ? "MED" : "DEEP",
        cls: "tag-pass",
      };
    case "fieldGoal":
      return { text: "FG", cls: "tag-fg" };
    case "spike":
      return { text: "SPK", cls: "tag-spike" };
  }
}

export function PlayOptionButtons({
  options,
  roster,
  disabled,
  onChoose,
}: {
  options: PlayCall[];
  roster: DraftedRoster;
  disabled: boolean;
  onChoose: (call: PlayCall) => void;
}) {
  return (
    <div className="play-option-buttons">
      {options.map((call) => {
        const tag = callTag(call);
        const slot = targetSlot(call);
        const payout = slot ? payoutMultiplier(roster[slot].rating) : null;
        return (
          <button
            key={playCallKey(call)}
            type="button"
            className="play-option-button"
            disabled={disabled}
            onClick={() => onChoose(call)}
          >
            <span className={`play-option-tag ${tag.cls}`}>{tag.text}</span>
            <span className="play-option-text">{describePlayCall(call, roster)}</span>
            {payout !== null && (
              <span
                className={`play-option-payout payout-${payoutBand(payout)}`}
                title="This player's payout multiplier"
              >
                {formatPayout(payout)}
              </span>
            )}
            <span className="play-option-arrow" aria-hidden="true">
              →
            </span>
          </button>
        );
      })}
    </div>
  );
}
