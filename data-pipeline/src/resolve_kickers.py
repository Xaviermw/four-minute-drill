"""Resolves kicker_pool.yaml display names to nflverse gsis_ids.

Same pattern as resolve_players.py (reuses its load_id_table()), kept as a
separate module since kickers are a separate curated pool with position "K".
"""
import os

import yaml

from resolve_players import load_id_table

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")


def load_kicker_pool():
    with open(os.path.join(CONFIG_DIR, "kicker_pool.yaml")) as f:
        return yaml.safe_load(f)["kickers"]


def resolve_kickers(kicker_pool=None, id_table=None):
    """Returns (resolved: list[dict], unresolved: list[str])."""
    kicker_pool = kicker_pool if kicker_pool is not None else load_kicker_pool()
    id_table = id_table if id_table is not None else load_id_table()

    resolved = []
    unresolved = []

    for entry in kicker_pool:
        if entry.get("gsis_id"):
            resolved.append(entry)
            continue

        name = entry["display_name"]
        # nflverse's cross-platform ID table tags kickers "PK", not "K".
        matches = id_table[
            (id_table["name"].str.lower() == name.lower())
            & (id_table["position"] == "PK")
        ]

        if len(matches) == 0:
            unresolved.append(f"{name} (PK)")
            continue

        if len(matches) > 1:
            unresolved.append(
                f"{name} (PK) -- {len(matches)} ambiguous matches, "
                f"add a manual gsis_id override in kicker_pool.yaml"
            )
            continue

        resolved_entry = dict(entry)
        resolved_entry["gsis_id"] = matches.iloc[0]["gsis_id"]
        resolved_entry["position"] = "K"
        resolved.append(resolved_entry)

    return resolved, unresolved


if __name__ == "__main__":
    resolved, unresolved = resolve_kickers()
    print(f"Resolved {len(resolved)}/{len(resolved) + len(unresolved)} kickers")
    for entry in resolved:
        print(f"  OK  {entry['display_name']} (K) -> {entry['gsis_id']}")
    if unresolved:
        print("\nUNRESOLVED -- fix these in kicker_pool.yaml before proceeding:")
        for name in unresolved:
            print(f"  FAIL  {name}")
        raise SystemExit(1)
