-- Add p_fandom to upsert_battle_score so fandom is preserved atomically.
-- The ON CONFLICT UPDATE uses coalesce so an existing fandom is not cleared
-- when the JS sends null (e.g., the player hasn't set a fandom yet).

create or replace function public.upsert_battle_score(
  p_id      uuid,
  p_name    text,
  p_country text,
  p_level   int,
  p_points  int,
  p_fandom  text default null
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.battle_scores
    (player_id, name, country, level, points, fandom, submitted_at)
  values
    (p_id, p_name, p_country, p_level, least(p_points, 1500000),
     coalesce(nullif(trim(lower(coalesce(p_fandom, ''))), ''), ''),
     now())
  on conflict (player_id) do update set
    name         = excluded.name,
    country      = excluded.country,
    level        = excluded.level,
    points       = excluded.points,
    fandom       = coalesce(nullif(trim(lower(coalesce(p_fandom, ''))), ''), battle_scores.fandom),
    submitted_at = now();
end;
$$;
