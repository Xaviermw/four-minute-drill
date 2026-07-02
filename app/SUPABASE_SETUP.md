# Leaderboard setup (Supabase)

The global leaderboard is **optional**. With no Supabase env vars the app runs
exactly as before — all leaderboard UI simply hides itself (`isLeaderboardEnabled`
is `false`). Follow this once to turn it on.

## 1. Create a project

1. Sign up at <https://supabase.com> (free tier is plenty).
2. Create a new project. Note its **Project URL** and **anon public** API key
   (Project Settings → API). The anon key is safe to ship in the client bundle
   **as long as RLS is enabled** (step 3). Never put the `service_role` key in
   client env.

## 2. Create the `scores` table

Open the SQL editor and run:

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  score int not null,
  outcome text not null,
  team_ovr int not null,
  roster jsonb not null,   -- array of { gsisId, name, position, rating }
  seed bigint not null,
  choices jsonb not null   -- ordered [{ call: {...}, tempoSeconds? }]
);

create index scores_score_idx on public.scores (score desc);
```

`seed` + `choices` + `roster` make every entry deterministically replayable by
the engine, so scores are auditable even though a static client can't fully
prevent a forged submission.

## 3. Enable Row-Level Security + policies

```sql
alter table public.scores enable row level security;

-- Anyone may read the leaderboard.
create policy "scores are public"
  on public.scores for select
  using (true);

-- Anyone may insert, but only well-formed rows within sane bounds.
create policy "anon can submit bounded scores"
  on public.scores for insert
  with check (
    score >= 0 and score <= 1000
    and char_length(name) between 1 and 20
    and jsonb_typeof(roster) = 'array'
    and jsonb_array_length(roster) = 6
  );
```

There is intentionally **no** update/delete policy, so entries are append-only.

## 4. Point the app at it

Create `app/.env.local` (gitignored — `*.local`):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

Restart `npm run dev`. The leaderboard button appears in the header and the
submit panel appears on a winning result. Set the same two vars in your deploy
host's environment for production.

See `.env.local.example` for the template.
