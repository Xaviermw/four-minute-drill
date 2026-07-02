-- Severe-name filter, mirrored from app/src/leaderboard/nameFilter.ts. Normalize
-- (lowercase, fold leetspeak, strip non-letters) then reject severe terms.
-- Deliberately excludes terms that occur inside innocent names (the Scunthorpe
-- problem: no "cunt"/"spic"/"coon"/"rape").
create or replace function public.name_ok(p_name text)
returns boolean language sql immutable as $$
  select regexp_replace(
           translate(lower(coalesce(p_name, '')), '013457$@!', 'oieastsai'),
           '[^a-z]', '', 'g'
         ) !~ '(nigger|nigga|faggot|chink|kike|retard|nazi|hitler|fuck|shit)'
$$;
grant execute on function public.name_ok(text) to anon, authenticated;

-- Require a clean name on score inserts.
drop policy "authed can submit bounded scores" on public.scores;
create policy "authed can submit bounded scores"
  on public.scores for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and char_length(name) between 1 and 20
    and public.name_ok(name)
    and jsonb_typeof(roster) = 'array'
    and jsonb_array_length(roster) = 6
  );

-- record_drive: sanitize a disallowed name to null (keep prior/Anonymous)
-- rather than failing the streak update.
create or replace function public.record_drive(p_won boolean, p_points int, p_name text)
returns void language plpgsql security invoker as $$
declare
  pts int := greatest(0, least(coalesce(p_points, 0), 2000));
  nm  text := left(nullif(trim(coalesce(p_name, '')), ''), 20);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if nm is not null and not public.name_ok(nm) then
    nm := null;
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
