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
  time_remaining int not null default 0,  -- clock (s) left when they scored
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

The app signs each player in as a Supabase **anonymous user** (no email/password
— invisible to the player) so every score is owned by a stable `user_id`. That
enables "your scores" highlighting and keeps submissions tied to an identity.

```sql
alter table public.scores enable row level security;

-- Own each row by the (anonymous) auth user who inserted it.
alter table public.scores add column if not exists user_id uuid default auth.uid();

-- Anyone may read the leaderboard.
create policy "scores are public"
  on public.scores for select
  using (true);

-- Only a signed-in (incl. anonymous) session may insert, its row must be
-- owned by that user, and the payload must be well-formed within sane bounds.
create policy "authed can submit bounded scores"
  on public.scores for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and char_length(name) between 1 and 20
    and jsonb_typeof(roster) = 'array'
    and jsonb_array_length(roster) = 6
  );
```

There is intentionally **no** update/delete policy, so entries are append-only.

### Enable anonymous sign-ins

In the dashboard: **Authentication → Sign In / Providers → Anonymous sign-ins → Enable**.
Without this, submitting a score fails with "Anonymous sign-ins are disabled".

### Win-streak leaderboard

A second leaderboard ranks the points banked across a run of consecutive
winning drives (a loss resets the run). One row per user, updated after every
drive by an atomic server function so the aggregation can't race.

```sql
create table public.streaks (
  user_id uuid primary key default auth.uid(),
  name text not null default 'Anonymous',
  current_points int not null default 0,
  current_wins int not null default 0,
  best_points int not null default 0,
  best_wins int not null default 0,
  updated_at timestamptz not null default now()
);
create index streaks_best_idx on public.streaks (best_points desc);

alter table public.streaks enable row level security;
create policy "streaks are public" on public.streaks for select using (true);
create policy "own streak insert" on public.streaks for insert
  to authenticated with check (auth.uid() = user_id);
create policy "own streak update" on public.streaks for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomic per-drive update: a win extends the run and banks points, anything
-- else resets it; best_* tracks the high-water run. Points are clamped as a
-- light anti-cheat bound.
create or replace function public.record_drive(p_won boolean, p_points int, p_name text)
returns void language plpgsql security invoker as $$
declare
  pts int := greatest(0, least(coalesce(p_points, 0), 2000));
  nm  text := left(nullif(trim(coalesce(p_name, '')), ''), 20);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.streaks (user_id, name, current_points, current_wins, best_points, best_wins)
  values (
    auth.uid(), coalesce(nm, 'Anonymous'),
    case when p_won then pts else 0 end, case when p_won then 1 else 0 end,
    case when p_won then pts else 0 end, case when p_won then 1 else 0 end
  )
  on conflict (user_id) do update set
    current_points = case when p_won then public.streaks.current_points + pts else 0 end,
    current_wins   = case when p_won then public.streaks.current_wins + 1 else 0 end,
    best_points = greatest(public.streaks.best_points,
                    case when p_won then public.streaks.current_points + pts else 0 end),
    best_wins = case when p_won and (public.streaks.current_points + pts) > public.streaks.best_points
                     then public.streaks.current_wins + 1 else public.streaks.best_wins end,
    name = coalesce(nm, public.streaks.name),
    updated_at = now();
end;
$$;
grant execute on function public.record_drive(boolean, int, text) to authenticated;
```

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