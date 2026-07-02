"""Per-player Overall rating (40-99), derived from real aggregate stats.

This replaces the coarse star/starter/scrub tier as the thing the app shows
and scores against -- ratings vary continuously with actual production, so two
"starters" can rate 71 and 84, and the draft Overall / scoring reflect that.

QB ratings combine passing efficiency with a dual-threat rushing bonus (so
Lamar Jackson's legs count) and a longevity bonus rewards proven volume (so
late-career-but-prolific passers like Brady aren't judged on rate stats alone).

Shared by build_player_dataset.py and build_kicker_dataset.py so the rating is
computed once and written into each player JSON (the manifest just reads it back).
"""

RATING_FLOOR = 40
RATING_CEIL = 99


def _norm(value, lo, hi):
    """Clamp a stat into 0..1 against rough league lo/hi anchors."""
    if value is None or hi == lo:
        return 0.5
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def _scale(score01):
    """Map a 0..1 quality score onto the rating range (returns a float so
    bonuses can be added before the final round/clamp)."""
    return RATING_FLOOR + (RATING_CEIL - RATING_FLOOR) * max(0.0, min(1.0, score01))


# Top-end expansion: stretch the elite band into the high 90s and spread it out,
# while leaving the mid/low untouched (raw efficiency tops out well short of the
# ceiling, so without this the best players bunch in the high 80s).
_EXPAND_PIVOT = 85
_EXPAND_GAIN = 1.5


def _expand(rating):
    if rating <= _EXPAND_PIVOT:
        return rating
    return _EXPAND_PIVOT + (rating - _EXPAND_PIVOT) * _EXPAND_GAIN


def _passing_score(p):
    comp = _norm(p.get("completionPct"), 0.55, 0.70)
    ya = _norm(p.get("yardsPerAttempt"), 5.5, 8.5)
    td = _norm(p.get("passTdRate"), 0.02, 0.065)
    ints = 1 - _norm(p.get("intRate"), 0.012, 0.035)  # fewer INTs = better
    return 0.25 * comp + 0.30 * ya + 0.25 * td + 0.20 * ints


def _qb_rush_bonus(r):
    """Additive (0..16) so pocket passers are unaffected but true dual-threats
    get a real lift, scaled by how much they actually run."""
    rush_n = r.get("sampleSize") or 0
    ypc = _norm(r.get("yardsPerCarry"), 3.5, 6.0)
    rtd = _norm(r.get("rushTdRate"), 0.01, 0.07)
    rfd = _norm(r.get("firstDownRate"), 0.20, 0.45)
    quality = 0.4 * ypc + 0.35 * rtd + 0.25 * rfd
    volume = min(1.0, rush_n / 250.0)  # full credit around ~250 carries
    return quality * volume * 16.0


def _rb_score(r):
    yc = _norm(r.get("yardsPerCarry"), 3.5, 5.2)
    td = _norm(r.get("rushTdRate"), 0.01, 0.05)
    fum = 1 - _norm(r.get("fumbleRate"), 0.003, 0.015)  # fewer fumbles = better
    fd = _norm(r.get("firstDownRate"), 0.18, 0.30)
    return 0.45 * yc + 0.20 * td + 0.15 * fum + 0.20 * fd


def _receiver_score(r):
    catch = _norm(r.get("catchRate"), 0.55, 0.72)
    yt = _norm(r.get("yardsPerTarget"), 6.0, 10.0)
    td = _norm(r.get("receivingTdRate"), 0.02, 0.08)
    fd = _norm(r.get("firstDownRate"), 0.28, 0.45)
    return 0.25 * catch + 0.35 * yt + 0.20 * td + 0.20 * fd


def _longevity_bonus(total_plays):
    """Small additive (0..+6) rewarding proven volume. Helps prolific
    veterans without penalizing low-sample young studs (a bonus, never a tax)."""
    return min(1.0, (total_plays or 0) / 3500.0) * 6.0


def player_rating(position, aggregates, total_plays=0):
    """aggregates: the per-role dict written into a player's dataset JSON."""
    if position == "QB":
        rating = _scale(_passing_score(aggregates.get("passer") or {}))
        rating += _qb_rush_bonus(aggregates.get("rusher") or {})
    elif position == "RB":
        rating = _scale(_rb_score(aggregates.get("rusher") or {}))
    elif position in ("WR", "TE"):
        rating = _scale(_receiver_score(aggregates.get("receiver") or {}))
    else:
        rating = RATING_FLOOR

    rating += _longevity_bonus(total_plays)
    return int(round(max(RATING_FLOOR, min(RATING_CEIL, _expand(rating)))))


def kicker_rating(distance_buckets):
    total_makes = sum(b["makes"] for b in distance_buckets.values())
    total_attempts = sum(b["attempts"] for b in distance_buckets.values())
    if total_attempts == 0:
        return RATING_FLOOR
    career_pct = total_makes / total_attempts
    score = _norm(career_pct, 0.72, 0.90)

    # Reward proven long-range accuracy (50+) when there's a real sample.
    fifties = distance_buckets.get("50s")
    if fifties and fifties["attempts"] >= 5:
        score = 0.8 * score + 0.2 * _norm(fifties["makePct"], 0.5, 0.85)

    return int(round(max(RATING_FLOOR, min(RATING_CEIL, _expand(_scale(score))))))
