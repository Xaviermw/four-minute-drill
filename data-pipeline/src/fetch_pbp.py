"""Pulls and caches nflverse play-by-play data via nfl_data_py.

Raw parquet is cached under data-pipeline/cache/ (gitignored) and never
shipped to the app -- only the filtered/aggregated per-player JSON does.
"""
import os

import nfl_data_py as nfl

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")

# Last ~11 seasons: bounds raw pull size while covering current starters
# and most curated veterans/scrubs.
SEASONS = list(range(2015, 2026))

PBP_COLUMNS = [
    "season", "week", "game_id", "posteam", "defteam",
    "down", "ydstogo", "yardline_100", "qtr", "game_seconds_remaining",
    "play_type", "air_yards", "qb_scramble", "yards_gained", "success",
    "run_location", "run_gap",
    "touchdown", "pass_touchdown", "rush_touchdown",
    "interception", "fumble_lost", "sack",
    "complete_pass", "pass_attempt", "rush_attempt",
    "passer_player_id", "passer_player_name",
    "rusher_player_id", "rusher_player_name",
    "receiver_player_id", "receiver_player_name",
    "two_point_attempt", "penalty", "first_down",
    "field_goal_attempt", "field_goal_result", "kick_distance",
    "kicker_player_id", "kicker_player_name",
]


def fetch_pbp(seasons=None):
    """Returns a DataFrame of play-by-play data restricted to PBP_COLUMNS."""
    seasons = seasons or SEASONS
    os.makedirs(CACHE_DIR, exist_ok=True)
    df = nfl.import_pbp_data(years=seasons, columns=PBP_COLUMNS, downcast=True, cache=False)
    return df


if __name__ == "__main__":
    df = fetch_pbp()
    print(f"Pulled {len(df)} plays across seasons {SEASONS[0]}-{SEASONS[-1]}")
    print(df.head())
