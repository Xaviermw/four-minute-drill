-- Name filter, round two: word-form vulgarities (mirrors nameFilter.ts).
-- First real case 2026-08-19: "thisgamesucksasshole" cleared the
-- severe-slurs-only filter. Second-tier terms are ONLY ones with no common
-- innocent-surname collisions: no cunt (Scunthorpe), dick (Dickie), cock
-- (-cock surnames); "ass" alone is inside Cassidy/Hassan but "asshole" as a
-- unit is not. ONLY the function changes -- the insert policy that calls
-- name_ok() is untouched (recreating it is the 005/008/009 trap).
create or replace function public.name_ok(p_name text)
returns boolean language sql immutable as $$
  with n as (
    select regexp_replace(
             translate(lower(coalesce(p_name, '')), '013457$@!', 'oieastsai'),
             '[^a-z]', '', 'g'
           ) as v
  )
  select v !~ '(nigger|nigga|faggot|chink|kike|retard|nazi|hitler|fuck|shit)'
     and v !~ '(asshole|bitch|whore|slut|dickhead)'
  from n
$$;
grant execute on function public.name_ok(text) to anon, authenticated;
