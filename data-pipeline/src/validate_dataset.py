"""Sanity gate run after every pipeline build. Fails (non-zero exit) if any
curated player has zero plays sampled in their primary role.
"""
import json
import os

from build_player_dataset import PRIMARY_ROLE
from resolve_kickers import resolve_kickers
from resolve_players import resolve_players
from schema import all_bucket_keys

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")
TOTAL_BUCKETS = len(list(all_bucket_keys()))


def main():
    resolved, unresolved = resolve_players()
    if unresolved:
        raise SystemExit(f"Unresolved players: {unresolved}")
    resolved_kickers, unresolved_kickers = resolve_kickers()
    if unresolved_kickers:
        raise SystemExit(f"Unresolved kickers: {unresolved_kickers}")

    failures = []
    rows = []

    for entry in resolved:
        path = os.path.join(OUTPUT_DIR, "players", f"{entry['gsis_id']}.json")
        if not os.path.exists(path):
            failures.append(f"{entry['display_name']}: missing output file {path}")
            continue

        with open(path) as f:
            dataset = json.load(f)

        primary_role = PRIMARY_ROLE[entry["position"]]
        primary_buckets = dataset["buckets"].get(primary_role, [])
        primary_plays = sum(b["sampleSize"] for b in primary_buckets)
        buckets_with_data = sum(1 for role_buckets in dataset["buckets"].values() for _ in role_buckets)

        rows.append((entry["display_name"], entry["position"], entry["tier"], primary_plays, buckets_with_data))

        if primary_plays == 0:
            failures.append(
                f"{entry['display_name']} ({entry['position']}): 0 plays in primary role '{primary_role}'"
            )

    for entry in resolved_kickers:
        path = os.path.join(OUTPUT_DIR, "players", f"{entry['gsis_id']}.json")
        if not os.path.exists(path):
            failures.append(f"{entry['display_name']}: missing output file {path}")
            continue

        with open(path) as f:
            dataset = json.load(f)

        total_attempts = dataset.get("totalAttempts", 0)
        rows.append((entry["display_name"], "K", entry["tier"], total_attempts, len(dataset.get("distanceBuckets", {}))))

        if total_attempts == 0:
            failures.append(f"{entry['display_name']} (K): 0 field goal attempts")

    print(f"{'name':<22}{'pos':<5}{'tier':<8}{'primary_plays':<15}{'buckets_with_data'}")
    for name, pos, tier, plays, buckets in rows:
        print(f"{name:<22}{pos:<5}{tier:<8}{plays:<15}{buckets}/{TOTAL_BUCKETS} per role")

    if failures:
        print("\nVALIDATION FAILED:")
        for f_msg in failures:
            print(f"  {f_msg}")
        raise SystemExit(1)

    print("\nValidation passed.")


if __name__ == "__main__":
    main()
