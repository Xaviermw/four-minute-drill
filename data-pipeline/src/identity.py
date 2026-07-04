"""Team + jersey number for curated players, from the most recent nflverse
seasonal roster row (most recent season within the pull window wins). Cached
in-module so the build scripts share one roster download.

A player whose last rostered season predates a relocation carries the old team
abbreviation (e.g. SD, OAK, STL) verbatim -- the app's color map resolves those
aliases, so the data stays faithful to when they last played.
"""
import nfl_data_py as nfl
import pandas as pd

_SEASONS = list(range(2015, 2026))
_cache = None


def get_identity():
    """Returns { gsis_id: {"team": str|None, "jersey": int|None} }."""
    global _cache
    if _cache is not None:
        return _cache

    frames = []
    for season in _SEASONS:
        roster = nfl.import_seasonal_rosters([season])
        roster = roster[["player_id", "team", "jersey_number"]].copy()
        roster["__season"] = season
        frames.append(roster)

    latest = pd.concat(frames).sort_values("__season", ascending=False).groupby("player_id").first()

    out = {}
    for pid, row in latest.iterrows():
        jersey = row["jersey_number"]
        out[pid] = {
            "team": str(row["team"]) if pd.notna(row["team"]) else None,
            "jersey": int(jersey) if pd.notna(jersey) else None,
        }
    _cache = out
    return out
