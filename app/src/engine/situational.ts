import type { FieldZone } from "../types/scenario";

// Mirrors data-pipeline/config/buckets.yaml -- keep both in sync manually.
export const DISTANCE_BUCKETS = [
  { id: "short", maxYdstogo: 3 },
  { id: "medium", maxYdstogo: 7 },
  { id: "long", maxYdstogo: 99 },
] as const;

export const FIELD_ZONES: { id: FieldZone; min: number; max: number }[] = [
  { id: "own_territory", min: 60, max: 100 },
  { id: "midfield", min: 40, max: 60 },
  { id: "red_zone", min: 10, max: 40 },
  { id: "goal_line", min: 0, max: 10 },
];

export const MIN_SAMPLE_THRESHOLD = 8;

export function distanceBucketId(ydstogo: number): string {
  for (const bucket of DISTANCE_BUCKETS) {
    if (ydstogo <= bucket.maxYdstogo) return bucket.id;
  }
  return DISTANCE_BUCKETS[DISTANCE_BUCKETS.length - 1].id;
}

export function fieldZoneId(yardline100: number): FieldZone {
  if (yardline100 <= 0) return "goal_line";
  for (const zone of FIELD_ZONES) {
    if (yardline100 >= zone.min && yardline100 < zone.max) return zone.id;
  }
  return FIELD_ZONES[FIELD_ZONES.length - 1].id;
}

export function bucketKey(down: number, ydstogo: number, yardline100: number): string {
  return `${down}_${distanceBucketId(ydstogo)}_${fieldZoneId(yardline100)}`;
}
