"""One-off: apply the bucket downsampler (slim.py) to already-built player JSON
in data-pipeline/output/players, in place, without re-fetching pbp. Same
function the pipeline now uses, so output matches a fresh build. `sampleSize` is
left untouched (it's the true count the engine's confidence gate relies on);
only the `outcomes` arrays shrink.

Run: python src/slim_existing.py   (stdlib only -- no venv/pandas needed)
"""
import glob
import json
import os

from slim import MAX_OUTCOMES_PER_BUCKET, slim_bucket_outcomes

PLAYERS_DIR = os.path.join(os.path.dirname(__file__), "..", "output", "players")


def main():
    files = sorted(glob.glob(os.path.join(PLAYERS_DIR, "*.json")))
    before_outcomes = after_outcomes = 0
    slimmed_buckets = 0

    for path in files:
        with open(path) as f:
            data = json.load(f)
        for _role, buckets in data.get("buckets", {}).items():
            for b in buckets:
                n = len(b["outcomes"])
                before_outcomes += n
                b["outcomes"] = slim_bucket_outcomes(data["gsisId"], b["bucketKey"], b["outcomes"])
                after_outcomes += len(b["outcomes"])
                if len(b["outcomes"]) != n:
                    slimmed_buckets += 1
        with open(path, "w") as f:
            json.dump(data, f)

    print(f"players: {len(files)}")
    print(f"buckets slimmed (> {MAX_OUTCOMES_PER_BUCKET}): {slimmed_buckets}")
    print(f"stored outcomes: {before_outcomes:,} -> {after_outcomes:,} ({after_outcomes / before_outcomes:.1%})")


if __name__ == "__main__":
    main()
