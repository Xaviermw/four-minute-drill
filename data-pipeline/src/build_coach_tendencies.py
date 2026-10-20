"""Real head coaches' play-calling tendencies, for the share card's
"Called it like <coach>" line (docs/outreach-plan.md, Step 0).

Writes app/src/share/coachTendencies.generated.ts -- a small table the client
matches a finished drive against. A toy by design: four numbers per coach,
nearest neighbour in rank space, always a compliment or neutral. The numbers
are computed, never typed in.

Per head coach (as the offense's coach: home_coach when posteam is the home
team, else away_coach), seasons 2023 to 2026-to-date, regular season + playoffs:
  passRate  late & trailing by one score in the 4th quarter (our drive's
            situation): pass intent / (pass intent + designed rushes)
  deepRate  same situation: share of pass attempts with air_yards >= 15
  fourthGo  all game: on 4th down inside the opponent 45 with <= 5 to go,
            share that went for it (vs field goal / punt)
  noHuddle  quarters 1-3 only (everyone hurries late): share of offensive
            snaps run no-huddle
Kneels and spikes are excluded everywhere. Scrambles count as pass intent.

Only coaches active in the latest season in the data are kept: the line must
read as a peer comparison, and a fired coach's name after a bad drive reads
as a dig (first run matched a four-and-out to Frank Reich).

Run:  venv/Scripts/python.exe src/build_coach_tendencies.py
"""
import json
import os
from datetime import datetime, timezone

import nfl_data_py as nfl
import pandas as pd

SEASONS = [2023, 2024, 2025, 2026]  # 2026 = season to date; new HCs qualify as it fills in
# ~One season as a head coach. The first run at 200/1000 kept only 14 coaches:
# a 17-game season yields roughly 100-150 late-trailing snaps.
MIN_LATE_PLAYS = 100
MIN_TOTAL_PLAYS = 600
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "app", "src", "share", "coachTendencies.generated.ts")

COLUMNS = [
    "season", "season_type", "game_id", "home_team", "away_team", "posteam",
    "home_coach", "away_coach", "play_type", "qb_scramble", "qb_kneel", "qb_spike",
    "air_yards", "down", "ydstogo", "yardline_100", "qtr", "score_differential",
    "no_huddle", "pass_attempt",
]


def main() -> None:
    df = nfl.import_pbp_data(years=SEASONS, columns=COLUMNS, downcast=True, cache=False)
    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise SystemExit(f"pbp is missing columns {missing} -- the column list needs updating")

    df = df[df["posteam"].notna() & df["play_type"].isin(["pass", "run", "field_goal", "punt"])].copy()
    df = df[(df["qb_kneel"] != 1) & (df["qb_spike"] != 1)]
    df["coach"] = df["home_coach"].where(df["posteam"] == df["home_team"], df["away_coach"])
    df = df[df["coach"].notna()]
    df["pass_intent"] = (df["play_type"] == "pass") | (df["qb_scramble"] == 1)
    df["rush"] = (df["play_type"] == "run") & (df["qb_scramble"] != 1)
    df["offense"] = df["pass_intent"] | df["rush"]

    late = df[(df["qtr"] == 4) & df["offense"] & (df["score_differential"] <= -1) & (df["score_differential"] >= -8)]
    late_g = late.groupby("coach")
    late_pass = late_g["pass_intent"].mean()
    late_n = late_g.size()
    late_att = late[late["pass_intent"] & late["air_yards"].notna()]
    deep = late_att.groupby("coach")["air_yards"].apply(lambda s: float((s >= 15).mean()))

    fourth = df[(df["down"] == 4) & (df["yardline_100"] <= 45) & (df["ydstogo"] <= 5)]
    fourth_go = fourth.groupby("coach")["offense"].mean()
    fourth_n = fourth.groupby("coach").size()

    early = df[df["offense"] & (df["qtr"] <= 3)]
    no_huddle = early.groupby("coach")["no_huddle"].mean()
    total_n = df[df["offense"]].groupby("coach").size()
    last_season = df[df["offense"]].groupby("coach")["season"].max()
    latest = int(df["season"].max())
    print("-- late-trailing / total offensive snaps per head coach --")
    counts = pd.DataFrame({"lateN": late_n, "totalN": total_n}).fillna(0).astype(int)
    print(counts.sort_values("lateN", ascending=False).to_string())

    # Most recent team coached (latest season, then most snaps).
    team = (
        df[df["offense"]].groupby(["coach", "season", "posteam"]).size().reset_index(name="n")
        .sort_values(["coach", "season", "n"], ascending=[True, False, False])
        .drop_duplicates("coach").set_index("coach")["posteam"]
    )

    rows = []
    for coach in sorted(late_n.index):
        if late_n[coach] < MIN_LATE_PLAYS or total_n.get(coach, 0) < MIN_TOTAL_PLAYS:
            continue
        if int(last_season.get(coach, 0)) < latest:
            continue  # not currently coaching -- see the docstring
        rows.append({
            "name": coach,
            "team": str(team.get(coach, "")),
            "lastSeason": int(last_season[coach]),
            "passRate": round(float(late_pass[coach]), 3),
            "deepRate": round(float(deep.get(coach, float("nan"))), 3),
            "fourthGo": round(float(fourth_go.get(coach, float("nan"))), 3),
            "fourthN": int(fourth_n.get(coach, 0)),
            "noHuddle": round(float(no_huddle.get(coach, float("nan"))), 3),
            "lateN": int(late_n[coach]),
        })
    rows = [r for r in rows if all(r[k] == r[k] for k in ("deepRate", "fourthGo", "noHuddle"))]  # drop NaN
    if len(rows) < 20:
        raise SystemExit(f"only {len(rows)} coaches qualified -- thresholds or data look wrong")

    body = ",\n".join("  " + json.dumps(r, separators=(", ", ": ")) for r in rows)
    ts = (
        "// GENERATED by data-pipeline/src/build_coach_tendencies.py -- do not edit.\n"
        f"// nflverse play-by-play, seasons {SEASONS[0]}-{SEASONS[-1]}, built {datetime.now(timezone.utc).date()}.\n"
        "// passRate/deepRate: 4th quarter, trailing by 1-8. fourthGo: 4th & <=5 inside the\n"
        "// opponent 45, all game. noHuddle: quarters 1-3. Kneels/spikes excluded.\n"
        f"// Active head coaches only (lastSeason == {latest}).\n\n"
        "export interface CoachTendency {\n"
        "  name: string;\n  team: string;\n  lastSeason: number;\n  passRate: number;\n  deepRate: number;\n"
        "  fourthGo: number;\n  fourthN: number;\n  noHuddle: number;\n  lateN: number;\n}\n\n"
        f"export const COACHES: CoachTendency[] = [\n{body}\n];\n"
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(ts)

    print(f"{len(rows)} coaches -> {os.path.normpath(OUT)}")
    print(pd.DataFrame(rows).sort_values("passRate", ascending=False).to_string(index=False))


if __name__ == "__main__":
    main()
