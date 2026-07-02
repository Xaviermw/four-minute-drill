"""Resolves roster_pool.yaml display names to nflverse gsis_ids.

Hard-fails (raises) if any curated player can't be resolved, listing the
unresolved names -- the curator must then add a manual gsis_id override or
fix the name/position in roster_pool.yaml.
"""
import os

import nfl_data_py as nfl
import yaml

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")


def load_roster_pool():
    with open(os.path.join(CONFIG_DIR, "roster_pool.yaml")) as f:
        return yaml.safe_load(f)["players"]


def load_id_table():
    """Cross-platform ID table: one row per player with gsis_id, name, position."""
    ids = nfl.import_ids()
    return ids[ids["gsis_id"].notna()]


def resolve_players(roster_pool=None, id_table=None):
    """Returns (resolved: list[dict], unresolved: list[str]).

    resolved entries are the original roster_pool dicts with a "gsis_id" key added.
    """
    roster_pool = roster_pool if roster_pool is not None else load_roster_pool()
    id_table = id_table if id_table is not None else load_id_table()

    resolved = []
    unresolved = []

    for entry in roster_pool:
        if entry.get("gsis_id"):
            resolved.append(entry)
            continue

        name = entry["display_name"]
        position = entry["position"]
        matches = id_table[
            (id_table["name"].str.lower() == name.lower())
            & (id_table["position"] == position)
        ]

        if len(matches) == 0:
            unresolved.append(f"{name} ({position})")
            continue

        if len(matches) > 1:
            # Ambiguous (e.g. two same-named players at the same position).
            # Require a manual gsis_id override or a season hint to disambiguate.
            unresolved.append(
                f"{name} ({position}) -- {len(matches)} ambiguous matches, "
                f"add a manual gsis_id override in roster_pool.yaml"
            )
            continue

        resolved_entry = dict(entry)
        resolved_entry["gsis_id"] = matches.iloc[0]["gsis_id"]
        resolved.append(resolved_entry)

    return resolved, unresolved


if __name__ == "__main__":
    resolved, unresolved = resolve_players()
    print(f"Resolved {len(resolved)}/{len(resolved) + len(unresolved)} players")
    for entry in resolved:
        print(f"  OK  {entry['display_name']} ({entry['position']}) -> {entry['gsis_id']}")
    if unresolved:
        print("\nUNRESOLVED -- fix these in roster_pool.yaml before proceeding:")
        for name in unresolved:
            print(f"  FAIL  {name}")
        raise SystemExit(1)
