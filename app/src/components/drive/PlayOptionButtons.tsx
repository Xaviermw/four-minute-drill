import { describePlayCall, playCallKey, type PlayCall } from "../../engine";
import type { DraftedRoster } from "../../types/roster";
import "./drive.css";

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
            <span className="play-option-arrow" aria-hidden="true">
              →
            </span>
          </button>
        );
      })}
    </div>
  );
}
