export type FieldZone = "own_territory" | "midfield" | "red_zone" | "goal_line";

export interface DriveScenario {
  down: number;
  distance: number;
  /** Distance to the opponent's goal line, 1-99 (yardline_100 convention). */
  fieldPosition: number;
  clockSeconds: number;
  scoreDiff: number;
}
