"""Downsamples oversized situation buckets so the shipped JSON stays light on
mobile without changing gameplay. Used by build_player_dataset (future builds)
and slim_existing (one-off on already-built output).

Key property: the bucket's `sampleSize` (the true play count, which the engine's
confidence gate relies on) is preserved by the caller -- only the `outcomes`
array shrinks. Sampling is *stratified by outcome type* (touchdown / turnover /
other) so the slimmed bucket reproduces the full bucket's rates rather than
over- or under-representing rare scoring/turnover plays. Deterministic per
(player, bucket), so re-runs and re-slims are byte-stable.
"""
import hashlib
import random

MAX_OUTCOMES_PER_BUCKET = 75


def _bucket_seed(gsis_id, bucket_key):
    return int(hashlib.md5(f"{gsis_id}:{bucket_key}".encode()).hexdigest()[:8], 16)


def slim_bucket_outcomes(gsis_id, bucket_key, outcomes):
    """Return outcomes downsampled to <= MAX, preserving touchdown/turnover/other
    proportions. Returns the input unchanged when already within the cap."""
    if len(outcomes) <= MAX_OUTCOMES_PER_BUCKET:
        return outcomes

    total = len(outcomes)
    tds = [o for o in outcomes if o["isTouchdown"]]
    tos = [o for o in outcomes if o["isTurnover"] and not o["isTouchdown"]]
    rest = [o for o in outcomes if not o["isTouchdown"] and not o["isTurnover"]]

    # Proportional keep counts -> the slimmed bucket matches the full rates.
    keep_td = round(MAX_OUTCOMES_PER_BUCKET * len(tds) / total)
    keep_to = round(MAX_OUTCOMES_PER_BUCKET * len(tos) / total)
    keep_rest = MAX_OUTCOMES_PER_BUCKET - keep_td - keep_to
    keep_rest = max(0, min(keep_rest, len(rest)))

    rng = random.Random(_bucket_seed(gsis_id, bucket_key))
    kept = (
        rng.sample(tds, min(keep_td, len(tds)))
        + rng.sample(tos, min(keep_to, len(tos)))
        + rng.sample(rest, keep_rest)
    )
    rng.shuffle(kept)
    return kept[:MAX_OUTCOMES_PER_BUCKET]
