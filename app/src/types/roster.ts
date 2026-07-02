import type { KickerDataset, ManifestPlayerEntry, PlayerDataset } from "./player";

export interface DraftedRoster {
  qb: ManifestPlayerEntry;
  rb: ManifestPlayerEntry;
  wr1: ManifestPlayerEntry;
  wr2: ManifestPlayerEntry;
  te: ManifestPlayerEntry;
  k: ManifestPlayerEntry;
}

export type RosterSlotKey = keyof DraftedRoster;

export interface DraftedRosterData {
  qb: PlayerDataset;
  rb: PlayerDataset;
  wr1: PlayerDataset;
  wr2: PlayerDataset;
  te: PlayerDataset;
  k: KickerDataset;
}
