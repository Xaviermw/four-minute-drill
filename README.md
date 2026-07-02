# Four Minute Drill

A web sports game in the spirit of [82-0.com](https://www.82-0.com/) and Immaculate
Grid. Draft a roster of real NFL players (QB, RB, 2×WR, TE, K), then call plays on a
do-or-die final drive simulated from real nflverse / nflfastR historical play data —
and get a score. Weaker rosters score more; scoring with less time left scores more.

## Structure

- **`app/`** — the game: React 19 + Vite + TypeScript static SPA. All gameplay,
  the deterministic drive engine, sharing, and the leaderboard client live here.
- **`data-pipeline/`** — Python (nfl_data_py) that turns 2015–2025 play-by-play into
  the per-player JSON + manifest the app ships in `app/public/data/`.

## Run the app locally

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> app/dist
npm test           # vitest
```

### Leaderboard (optional)

The global leaderboard is backed by Supabase and is entirely optional — with no
env vars the app runs normally and the leaderboard UI hides itself. To enable it,
follow [`app/SUPABASE_SETUP.md`](app/SUPABASE_SETUP.md) and set `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` (see [`app/.env.local.example`](app/.env.local.example)).

## Deploy (Vercel)

The app is a static SPA; deploy the `app/` subdirectory:

- **Framework preset:** Vite
- **Root Directory:** `app`
- **Build command:** `npm run build` · **Output directory:** `dist`
- **Environment variables:** set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  to enable the leaderboard in production.

## Rebuild the player data

```bash
cd data-pipeline
python -m venv venv && venv/Scripts/pip install -r requirements.txt   # first time
venv/Scripts/python src/build_player_dataset.py
venv/Scripts/python src/build_kicker_dataset.py
venv/Scripts/python src/build_manifest.py
venv/Scripts/python src/validate_dataset.py
cp -r output/* ../app/public/data/     # ship the rebuilt data into the app
```

The curated draft pool lives in `data-pipeline/config/roster_pool.yaml` (and
`kicker_pool.yaml`); the season window is `SEASONS` in `src/fetch_pbp.py`.

## Data

Play-by-play and player IDs via [nflverse](https://github.com/nflverse) / nflfastR.
