import type { DriveSession } from "../engine/driveSimulator";
import type { DraftedRoster } from "../types/roster";
import type { DriveScenario } from "../types/scenario";
import type { DriveLog } from "../types/simResult";

export type GameState =
  | { phase: "draft" }
  | { phase: "driving"; roster: DraftedRoster; scenario: DriveScenario; session: DriveSession }
  | { phase: "result"; roster: DraftedRoster; scenario: DriveScenario; driveLog: DriveLog };

export type GameAction =
  | { type: "DRIVE_STARTED"; roster: DraftedRoster; scenario: DriveScenario; session: DriveSession }
  | { type: "DRIVE_ENDED"; driveLog: DriveLog }
  | { type: "RESTART" };

export const initialGameState: GameState = { phase: "draft" };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "DRIVE_STARTED":
      // Fires from "draft" (normal flow) or "result" (Play Again, Same Lineup).
      if (state.phase !== "draft" && state.phase !== "result") return state;
      return { phase: "driving", roster: action.roster, scenario: action.scenario, session: action.session };
    case "DRIVE_ENDED":
      if (state.phase !== "driving") return state;
      return { phase: "result", roster: state.roster, scenario: state.scenario, driveLog: action.driveLog };
    case "RESTART":
      return { phase: "draft" };
    default:
      return state;
  }
}
