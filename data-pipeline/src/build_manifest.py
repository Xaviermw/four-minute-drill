"""Builds manifest.json: the eagerly-loaded draftable player list, plus
league-wide run/pass tendencies and role-level fallback rates computed from
the full (non-curated-only) play-by-play pull.
"""
import json
import os

from build_kicker_dataset import build_distance_buckets
from build_player_dataset import _compute_aggregates, _safe_div
from fetch_pbp import fetch_pbp
from resolve_kickers import resolve_kickers
from resolve_players import resolve_players
from schema import DISTANCE_BUCKETS, FIELD_ZONES, DOWNS, distance_bucket_id, field_zone_id

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "output")


def _flavor_stats(dataset, position):
    """Headline is total plays sampled; subline is a real position-appropriate
    career rate stat -- no made-up flavor text, the numbers speak for themselves."""
    headline = f"{dataset['totalPlaysSampled']:,} career plays sampled"
    aggregates = dataset.get("aggregates", {})

    if position == "QB":
        passer = aggregates.get("passer") or {}
        subline = f"{passer.get('completionPct', 0) * 100:.1f}% comp, {passer.get('yardsPerAttempt', 0):.1f} Y/A"
    elif position == "RB":
        rusher = aggregates.get("rusher") or {}
        subline = f"{rusher.get('yardsPerCarry', 0):.1f} yards/carry"
    else:  # WR, TE
        receiver = aggregates.get("receiver") or {}
        subline = f"{receiver.get('catchRate', 0) * 100:.1f}% catch rate, {receiver.get('yardsPerTarget', 0):.1f} Y/Tgt"

    return {"headline": headline, "subline": subline}


def _flavor_stats_kicker(dataset):
    total_makes = sum(b["makes"] for b in dataset["distanceBuckets"].values())
    total_attempts = sum(b["attempts"] for b in dataset["distanceBuckets"].values())
    fg_pct = _safe_div(total_makes, total_attempts) * 100
    return {
        "headline": f"{total_attempts:,} career FG attempts",
        "subline": f"{fg_pct:.1f}% career FG rate",
    }


def build_league_average_kicker_rates(pbp):
    """Make% by kick-distance tier across every field goal attempt in the
    full league pull -- shrinkage fallback for low-volume curated kickers."""
    all_attempts = pbp[pbp["field_goal_attempt"] == 1]
    return build_distance_buckets(all_attempts)


def build_league_tendencies(pbp):
    """Run/pass rate by down x distanceBucket x zone, across the whole league."""
    live = pbp[
        (pbp["down"].notna())
        & (pbp["ydstogo"].notna())
        & (pbp["yardline_100"].notna())
        & ((pbp["pass_attempt"] == 1) | (pbp["rush_attempt"] == 1))
    ].copy()

    live["distanceBucket"] = live["ydstogo"].apply(distance_bucket_id)
    live["zone"] = live["yardline_100"].apply(field_zone_id)

    tendencies = {}
    for down in DOWNS:
        for dist in DISTANCE_BUCKETS:
            for zone in FIELD_ZONES:
                subset = live[
                    (live["down"] == down)
                    & (live["distanceBucket"] == dist["id"])
                    & (live["zone"] == zone["id"])
                ]
                n = len(subset)
                pass_rate = float((subset["pass_attempt"] == 1).sum() / n) if n > 0 else 0.55
                key = f"{down}_{dist['id']}_{zone['id']}"
                tendencies[key] = {"passRate": pass_rate, "sampleSize": int(n)}
    return tendencies


def build_league_average_rates(pbp):
    """Role-level fallback rates computed across the entire league pull,
    used to shrink very low-volume curated players' aggregates."""
    rates = {}
    role_dfs = {}
    for role in ("passer", "rusher", "receiver"):
        id_col = {"passer": "passer_player_id", "rusher": "rusher_player_id", "receiver": "receiver_player_id"}[role]
        role_df = pbp[pbp[id_col].notna()]
        if role == "passer":
            role_df = role_df[(role_df["pass_attempt"] == 1) | (role_df["sack"] == 1)]
        elif role == "rusher":
            # Mirrors build_player_dataset._role_subset's kneel exclusion.
            role_df = role_df[(role_df["rush_attempt"] == 1) & (role_df["play_type"] != "qb_kneel")]
        else:
            role_df = role_df[role_df["pass_attempt"] == 1]
        role_dfs[role] = role_df
        rates[role] = _compute_aggregates(role_df, role)

    scramble_count = int((role_dfs["rusher"]["qb_scramble"] == 1).sum())
    dropbacks = len(role_dfs["passer"]) + scramble_count
    rates["passer"]["scrambleRate"] = _safe_div(scramble_count, dropbacks)
    return rates


def main():
    resolved, unresolved = resolve_players()
    if unresolved:
        raise SystemExit(f"Unresolved players: {unresolved}")
    resolved_kickers, unresolved_kickers = resolve_kickers()
    if unresolved_kickers:
        raise SystemExit(f"Unresolved kickers: {unresolved_kickers}")

    pbp = fetch_pbp()

    players_entries = []
    for entry in resolved:
        player_path = os.path.join(OUTPUT_DIR, "players", f"{entry['gsis_id']}.json")
        with open(player_path) as f:
            dataset = json.load(f)
        players_entries.append({
            "gsisId": entry["gsis_id"],
            "displayName": entry["display_name"],
            "position": entry["position"],
            "tier": entry["tier"],
            "rating": dataset["rating"],
            "flavorStats": _flavor_stats(dataset, entry["position"]),
        })

    for entry in resolved_kickers:
        kicker_path = os.path.join(OUTPUT_DIR, "players", f"{entry['gsis_id']}.json")
        with open(kicker_path) as f:
            dataset = json.load(f)
        players_entries.append({
            "gsisId": entry["gsis_id"],
            "displayName": entry["display_name"],
            "position": "K",
            "tier": entry["tier"],
            "rating": dataset["rating"],
            "flavorStats": _flavor_stats_kicker(dataset),
        })

    manifest = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "players": players_entries,
        "leagueTendencies": build_league_tendencies(pbp),
        "leagueAverageRates": build_league_average_rates(pbp),
        "leagueAverageKickerRates": build_league_average_kicker_rates(pbp),
    }

    out_path = os.path.join(OUTPUT_DIR, "manifest.json")
    with open(out_path, "w") as f:
        json.dump(manifest, f)
    print(f"Wrote {out_path} with {len(players_entries)} players")


if __name__ == "__main__":
    main()
