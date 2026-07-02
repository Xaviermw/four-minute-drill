"""Shared bucket/schema helpers. Mirrors app/src/types/player.ts and
app/src/engine/situational.ts -- keep both in sync manually if this changes.
"""
import os

import yaml

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")

with open(os.path.join(CONFIG_DIR, "buckets.yaml")) as f:
    _BUCKETS_CONFIG = yaml.safe_load(f)

DISTANCE_BUCKETS = _BUCKETS_CONFIG["distance_buckets"]
FIELD_ZONES = _BUCKETS_CONFIG["field_zones"]
DOWNS = _BUCKETS_CONFIG["downs"]
MIN_SAMPLE_THRESHOLD = _BUCKETS_CONFIG["min_sample_threshold"]
DEPTH_TIERS = _BUCKETS_CONFIG["depth_tiers"]
KICK_DISTANCE_BUCKETS = _BUCKETS_CONFIG["kick_distance_buckets"]

ROLES = ("passer", "rusher", "receiver")


def distance_bucket_id(ydstogo):
    for bucket in DISTANCE_BUCKETS:
        if ydstogo <= bucket["max_ydstogo"]:
            return bucket["id"]
    return DISTANCE_BUCKETS[-1]["id"]


def field_zone_id(yardline_100):
    for zone in FIELD_ZONES:
        if zone["min_yardline_100"] <= yardline_100 < zone["max_yardline_100"]:
            return zone["id"]
    # yardline_100 == 0 (goal line) falls through the < check on goal_line's
    # own max; treat anything <=0 as goal_line explicitly.
    if yardline_100 <= 0:
        return "goal_line"
    return FIELD_ZONES[-1]["id"]


def depth_tier_id(air_yards):
    """None for non-pass plays (no air_yards) -- e.g. rushes, sacks."""
    if air_yards is None:
        return None
    for tier in DEPTH_TIERS:
        if air_yards <= tier["max_air_yards"]:
            return tier["id"]
    return DEPTH_TIERS[-1]["id"]


def kick_distance_bucket_id(kick_distance):
    for bucket in KICK_DISTANCE_BUCKETS:
        if kick_distance <= bucket["max_kick_distance"]:
            return bucket["id"]
    return KICK_DISTANCE_BUCKETS[-1]["id"]


def bucket_key(down, ydstogo, yardline_100):
    return f"{down}_{distance_bucket_id(ydstogo)}_{field_zone_id(yardline_100)}"


def all_bucket_keys():
    for down in DOWNS:
        for dist in DISTANCE_BUCKETS:
            for zone in FIELD_ZONES:
                yield f"{down}_{dist['id']}_{zone['id']}"
