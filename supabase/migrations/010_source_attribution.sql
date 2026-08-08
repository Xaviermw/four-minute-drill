-- First-touch source attribution (docs/marketing-automation-plan.md): stamp
-- which platform brought each player so paid-source cohorts stay separable
-- ("which platform's players retain" is the kickoff-budget question). The
-- client captures utm_source on first visit and passes it along; the streak
-- row keeps the FIRST value forever (first-touch), scores carry it per row.
-- Nullable + length-checked via column constraint -- the insert policy is
-- deliberately untouched (recreating it risks dropping name_ok/bounds; see
-- the 005/008/009 trap).

alter table public.scores
  add column if not exists source text
  check (source is null or char_length(source) <= 24);

alter table public.streaks
  add column if not exists source text
  check (source is null or char_length(source) <= 24);

-- record_drive gains p_source (first-touch: only written when the row has
-- none). Adding a defaulted parameter creates an overload against the old
-- 3-arg signature -- ambiguous at call time -- so the old one is dropped.
drop function if exists public.record_drive(boolean, int, text);

create function public.record_drive(p_won boolean, p_points int, p_name text, p_source text default null)
returns json language plpgsql security invoker as $$
declare
  pts int := greatest(0, least(coalesce(p_points, 0), 2000));
  nm  text := left(nullif(trim(coalesce(p_name, '')), ''), 20);
  src text := left(nullif(trim(coalesce(p_source, '')), ''), 24);
  prev_points int := 0;
  prev_wins int := 0;
  new_points int;
  new_wins int;
  r public.streaks;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if nm is not null and not public.name_ok(nm) then
    nm := null;
  end if;

  select current_points, current_wins into prev_points, prev_wins
    from public.streaks where user_id = auth.uid();
  prev_points := coalesce(prev_points, 0);
  prev_wins := coalesce(prev_wins, 0);

  new_points := case when p_won then prev_points + pts else 0 end;
  new_wins   := case when p_won then prev_wins + 1 else 0 end;

  insert into public.streaks (user_id, name, current_points, current_wins, best_points, best_wins, source)
  values (auth.uid(), coalesce(nm, 'Anonymous'), new_points, new_wins, new_points, new_wins, src)
  on conflict (user_id) do update set
    current_points = new_points,
    current_wins   = new_wins,
    best_points = greatest(public.streaks.best_points, new_points),
    best_wins   = case when new_points > public.streaks.best_points then new_wins else public.streaks.best_wins end,
    name = coalesce(nm, public.streaks.name),
    source = coalesce(public.streaks.source, src), -- first touch wins
    updated_at = now()
  returning * into r;

  return json_build_object(
    'won', p_won,
    'streak_points', case when p_won then r.current_points else prev_points end,
    'streak_wins',   case when p_won then r.current_wins else prev_wins end,
    'best_points', r.best_points,
    'best_wins', r.best_wins
  );
end;
$$;
grant execute on function public.record_drive(boolean, int, text, text) to authenticated;
