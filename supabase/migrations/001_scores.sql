-- Leaderboard scores: append-only, publicly readable, bounded insert.
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

alter table public.scores enable row level security;

create policy "scores are public"
  on public.scores for select
  using (true);

create policy "anon can submit bounded scores"
  on public.scores for insert
  with check (
    score >= 0 and score <= 1000
    and char_length(name) between 1 and 20
    and jsonb_typeof(roster) = 'array'
    and jsonb_array_length(roster) = 6
  );
