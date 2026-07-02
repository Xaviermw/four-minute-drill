-- Win-streak leaderboard: points banked across consecutive winning drives,
-- one row per user, updated atomically by record_drive after every drive.
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

-- A win extends the run and banks its (clamped) points; anything else resets it.
-- best_* is the high-water run. Superseded by 005 (adds the name filter).
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
