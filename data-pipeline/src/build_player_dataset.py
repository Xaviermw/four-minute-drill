"""Filters pbp data to curated players and builds situational buckets +
aggregate fallback rates for each player/role, writing one JSON file per
player to output/players/{gsis_id}.json.
"""
import json
import os
from collections import defaultdict

import pandas as pd

from fetch_pbp import fetch_pbp
from rating import player_rating
from resolve_players import resolve_players
from schema import bucket_key, depth_tier_id

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")

ROLE_ID_COLUMN = {
    "passer": "passer_player_id",
    "rusher": "rusher_player_id",
    "receiver": "receiver_player_id",
}

# Primary role per position -- used by validate_dataset.py to enforce the
# "no curated player with zero plays in their main job" gate.
PRIMARY_ROLE = {"QB": "passer", "RB": "rusher", "WR": "receiver", "TE": "receiver"}


def _role_subset(pbp, gsis_id, role):
    id_col = ROLE_ID_COLUMN[role]
    mask = pbp[id_col] == gsis_id
    if role == "passer":
        mask &= (pbp["pass_attempt"] == 1) | (pbp["sack"] == 1)
    elif role == "rusher":
        # Exclude QB kneels -- clock-killing plays, not a meaningful designed
        # run or scramble outcome for gameplay purposes.
        mask &= (pbp["rush_attempt"] == 1) & (pbp["play_type"] != "qb_kneel")
    elif role == "receiver":
        mask &= pbp["pass_attempt"] == 1
    return pbp[mask]


def _to_outcome_record(row, role):
    is_touchdown = bool(row.get("pass_touchdown") == 1 or row.get("rush_touchdown") == 1)
    is_complete = None
    if role in ("passer", "receiver"):
        is_complete = bool(row["complete_pass"] == 1)
    return {
        "yards": float(row["yards_gained"]) if pd.notna(row["yards_gained"]) else 0.0,
        "epa": float(row["epa"]) if pd.notna(row["epa"]) else 0.0,
        "isTouchdown": is_touchdown,
        "isTurnover": bool(row["interception"] == 1 or row["fumble_lost"] == 1),
        "isSack": bool(row["sack"] == 1),
        "isComplete": is_complete,
        "isFirstDown": bool(row.get("first_down") == 1),
        # Only meaningful for passer/receiver roles -- null for rusher/sack
        # rows, which have no air_yards. "short"/"medium"/"deep", derived
        # from air_yards (see schema.depth_tier_id), not nflfastR's pass_length
        # (which is binary short/deep only -- this gives a real middle tier).
        "depthTier": depth_tier_id(row.get("air_yards") if pd.notna(row.get("air_yards")) else None),
        # Only meaningful for rusher-role rows (always False for passer/
        # receiver). Distinguishes a QB scramble from a designed QB run --
        # both come through the same rusher role/rush_attempt for a QB.
        "isScramble": bool(row.get("qb_scramble") == 1),
    }


def _build_buckets(role_df, role):
    buckets = defaultdict(list)
    for row in role_df.itertuples(index=False):
        row_dict = row._asdict()
        if pd.isna(row_dict["down"]) or pd.isna(row_dict["ydstogo"]) or pd.isna(row_dict["yardline_100"]):
            continue
        key = bucket_key(int(row_dict["down"]), row_dict["ydstogo"], row_dict["yardline_100"])
        buckets[key].append(_to_outcome_record(row_dict, role))

    return [
        {"bucketKey": key, "sampleSize": len(outcomes), "outcomes": outcomes}
        for key, outcomes in buckets.items()
    ]


def _safe_div(numerator, denominator):
    return numerator / denominator if denominator else 0.0


def _compute_rate_fields(role_df, role):
    """Core rate-stat computation, reused for the overall aggregate and for
    each per-depth-tier slice."""
    n = len(role_df)
    if n == 0:
        return None

    if role == "passer":
        attempts = role_df[role_df["pass_attempt"] == 1]
        completions = attempts[attempts["complete_pass"] == 1]
        n_attempts = len(attempts)
        return {
            "sampleSize": n,
            "completionPct": _safe_div(len(completions), n_attempts),
            "yardsPerAttempt": _safe_div(attempts["yards_gained"].sum(), n_attempts),
            "intRate": _safe_div((attempts["interception"] == 1).sum(), n_attempts),
            "sackRate": _safe_div((role_df["sack"] == 1).sum(), n),
            "passTdRate": _safe_div((attempts["pass_touchdown"] == 1).sum(), n_attempts),
            "firstDownRate": _safe_div((role_df["first_down"] == 1).sum(), n),
        }

    if role == "rusher":
        return {
            "sampleSize": n,
            "yardsPerCarry": _safe_div(role_df["yards_gained"].sum(), n),
            "rushTdRate": _safe_div((role_df["rush_touchdown"] == 1).sum(), n),
            "fumbleRate": _safe_div((role_df["fumble_lost"] == 1).sum(), n),
            "firstDownRate": _safe_div((role_df["first_down"] == 1).sum(), n),
        }

    if role == "receiver":
        completions = role_df[role_df["complete_pass"] == 1]
        return {
            "sampleSize": n,
            "catchRate": _safe_div(len(completions), n),
            "yardsPerTarget": _safe_div(role_df["yards_gained"].sum(), n),
            "receivingTdRate": _safe_div((role_df["pass_touchdown"] == 1).sum(), n),
            "firstDownRate": _safe_div((role_df["first_down"] == 1).sum(), n),
            # Fraction of targets to this receiver that were intercepted --
            # used by the engine to blend QB vs. WR interception risk.
            "intRate": _safe_div((role_df["interception"] == 1).sum(), n),
        }

    return None


def _compute_aggregates(role_df, role):
    base = _compute_rate_fields(role_df, role)
    if base is None:
        return None

    # Depth-tier split only makes sense for roles that involve a thrown ball.
    # Sacks/non-pass rows have no air_yards and are naturally excluded from
    # every tier slice (depthTier is None for them).
    if role in ("passer", "receiver") and "air_yards" in role_df.columns:
        by_depth = {}
        for tier in ("short", "medium", "deep"):
            tier_df = role_df[role_df["air_yards"].apply(lambda ay: depth_tier_id(ay if pd.notna(ay) else None) == tier)]
            if len(tier_df) > 0:
                by_depth[tier] = _compute_rate_fields(tier_df, role)
        if by_depth:
            base["byDepth"] = by_depth

    return base


def build_player_dataset(pbp, entry):
    gsis_id = entry["gsis_id"]
    roles_out = {}
    aggregates_out = {}
    total_plays = 0

    if entry["position"] == "RB":
        applicable_roles = ["rusher", "receiver"]
    elif entry["position"] == "QB":
        applicable_roles = ["passer", "rusher"]
    elif entry["position"] in ("WR", "TE"):
        applicable_roles = ["receiver"]

    role_dfs = {}
    for role in applicable_roles:
        role_df = _role_subset(pbp, gsis_id, role)
        role_dfs[role] = role_df
        if len(role_df) == 0:
            continue
        roles_out[role] = _build_buckets(role_df, role)
        aggregates_out[role] = _compute_aggregates(role_df, role)
        total_plays += len(role_df)

    # scrambleRate: of all called pass plays (attempts + sacks + scrambles),
    # what fraction end in the QB scrambling instead of throwing. Needs both
    # role frames, so it's computed here rather than in _compute_aggregates.
    if entry["position"] == "QB" and aggregates_out.get("passer"):
        rusher_df = role_dfs.get("rusher")
        scramble_count = int((rusher_df["qb_scramble"] == 1).sum()) if rusher_df is not None and len(rusher_df) else 0
        dropbacks = len(role_dfs["passer"]) + scramble_count
        aggregates_out["passer"]["scrambleRate"] = _safe_div(scramble_count, dropbacks)

    return {
        "gsisId": gsis_id,
        "displayName": entry["display_name"],
        "position": entry["position"],
        "tier": entry["tier"],
        "rating": player_rating(entry["position"], aggregates_out, total_plays),
        "seasonsCovered": [int(pbp["season"].min()), int(pbp["season"].max())],
        "totalPlaysSampled": total_plays,
        "buckets": roles_out,
        "aggregates": aggregates_out,
    }


def main():
    resolved, unresolved = resolve_players()
    if unresolved:
        raise SystemExit(f"Unresolved players: {unresolved}")

    pbp = fetch_pbp()

    os.makedirs(os.path.join(OUTPUT_DIR, "players"), exist_ok=True)
    for entry in resolved:
        dataset = build_player_dataset(pbp, entry)
        out_path = os.path.join(OUTPUT_DIR, "players", f"{entry['gsis_id']}.json")
        with open(out_path, "w") as f:
            json.dump(dataset, f)
        print(f"Wrote {out_path} ({dataset['totalPlaysSampled']} plays sampled)")


if __name__ == "__main__":
    main()
