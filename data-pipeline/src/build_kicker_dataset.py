"""Builds per-kicker field-goal make-probability data, bucketed by kick
distance (kick_distance = yardline_100 + 18). Kickers don't fit the
down/distance/field-zone situational model used for offensive players --
distance is the only variable that matters -- so this is a small parallel
pipeline rather than being squeezed into build_player_dataset.py.

Output is written to the same output/players/{gsis_id}.json convention as
offensive players, just with a different (much simpler) shape.
"""
import json
import os

import pandas as pd

from fetch_pbp import fetch_pbp
from identity import get_identity
from rating import kicker_rating
from resolve_kickers import resolve_kickers
from schema import kick_distance_bucket_id, KICK_DISTANCE_BUCKETS

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")


def _kicker_subset(pbp, gsis_id):
    return pbp[(pbp["kicker_player_id"] == gsis_id) & (pbp["field_goal_attempt"] == 1)]


def build_distance_buckets(kicker_df):
    buckets = {}
    for tier in KICK_DISTANCE_BUCKETS:
        tier_id = tier["id"]
        tier_df = kicker_df[kicker_df["kick_distance"].apply(
            lambda d: pd.notna(d) and kick_distance_bucket_id(d) == tier_id
        )]
        attempts = len(tier_df)
        if attempts == 0:
            continue
        makes = int((tier_df["field_goal_result"] == "made").sum())
        buckets[tier_id] = {"attempts": attempts, "makes": makes, "makePct": makes / attempts}
    return buckets


def build_kicker_dataset(pbp, entry):
    gsis_id = entry["gsis_id"]
    kicker_df = _kicker_subset(pbp, gsis_id)
    distance_buckets = build_distance_buckets(kicker_df)
    ident = get_identity().get(gsis_id, {})
    return {
        "gsisId": gsis_id,
        "displayName": entry["display_name"],
        "position": "K",
        "tier": entry["tier"],
        "team": ident.get("team"),
        "jersey": ident.get("jersey"),
        "rating": kicker_rating(distance_buckets),
        "totalAttempts": len(kicker_df),
        "distanceBuckets": distance_buckets,
    }


def main():
    resolved, unresolved = resolve_kickers()
    if unresolved:
        raise SystemExit(f"Unresolved kickers: {unresolved}")

    pbp = fetch_pbp()

    os.makedirs(os.path.join(OUTPUT_DIR, "players"), exist_ok=True)
    for entry in resolved:
        dataset = build_kicker_dataset(pbp, entry)
        out_path = os.path.join(OUTPUT_DIR, "players", f"{entry['gsis_id']}.json")
        with open(out_path, "w") as f:
            json.dump(dataset, f)
        print(f"Wrote {out_path} ({dataset['totalAttempts']} FG attempts)")


if __name__ == "__main__":
    main()
