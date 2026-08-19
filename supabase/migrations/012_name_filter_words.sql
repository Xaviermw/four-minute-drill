-- Name filter, round two: word-form vulgarities (mirrors nameFilter.ts).
-- First real case 2026-08-19: "thisgamesucksasshole" cleared the
-- severe-slurs-only filter. Whole-word terms like "asshole" can't join the
-- substring denylist ("ass" lives inside Cassidy/Bassett/Hassan), so the
-- normalized name first has innocent surnames stripped, then is checked for
-- the word terms. ONLY the function changes -- the insert policy that calls
-- name_ok() is untouched (recreating it is the 005/008/009 trap).
create or replace function public.name_ok(p_name text)
returns boolean language sql immutable as $$
  with n as (
    select regexp_replace(
             translate(lower(coalesce(p_name, '')), '013457$@!', 'oieastsai'),
             '[^a-z]', '', 'g'
           ) as v
  ),
  stripped as (
    select regexp_replace(
             v,
             '(dickson|dickens|dickinson|dickerson|cocker|cockburn|hancock|hitchcock|peacock|babcock|woodcock)',
             '', 'g'
           ) as w, v
    from n
  )
  select v !~ '(nigger|nigga|faggot|chink|kike|retard|nazi|hitler|fuck|shit)'
     and w !~ '(asshole|bitch|cunt|dick|cock|whore|slut)'
  from stripped
$$;
grant execute on function public.name_ok(text) to anon, authenticated;
