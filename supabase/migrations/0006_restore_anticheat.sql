-- 0005 rewrote upsert_battle_score to add p_fandom but DROPPED the anti-cheat
-- safeguards 0002 built (level clamp, 5s rate limit, best-run-only guard),
-- leaving the leaderboard writable with arbitrary values by anyone holding the
-- public anon key. This migration restores all 0002 protections while keeping
-- the fandom parameter, and removes the old 5-arg overload so only one
-- definition exists.

drop function if exists public.upsert_battle_score(uuid, text, text, int, int);

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
declare
  v_recent  timestamptz;
  v_level   int  := coalesce(p_level, 1);
  v_points  int  := coalesce(p_points, 0);
  v_name    text := coalesce(nullif(trim(p_name), ''), 'Player');
  v_country text := coalesce(nullif(trim(p_country), ''), 'US');
  v_fandom  text := nullif(trim(lower(coalesce(p_fandom, ''))), '');
begin
  if p_id is null then return; end if;

  -- Clamp inputs (anti-cheat)
  if v_level  < 1 then v_level  := 1;  end if;
  if v_level  > 99 then v_level := 99; end if;
  if v_points < 0 then v_points := 0;  end if;
  -- Hard cap: anything beyond is impossible by design (lvl 99 ceiling well below this).
  if v_points > 1500000 then return; end if;

  -- Rate limit: ignore submissions <5s after the previous score-improving submit.
  select submitted_at into v_recent from public.battle_scores where player_id = p_id;
  if v_recent is not null and now() - v_recent < interval '5 seconds' then
    -- Allow name/country/fandom refresh but not a score change.
    update public.battle_scores
       set name    = v_name,
           country = v_country,
           fandom  = coalesce(v_fandom, battle_scores.fandom)
     where player_id = p_id;
    return;
  end if;

  insert into public.battle_scores (player_id, name, country, level, points, fandom, submitted_at)
  values (p_id, v_name, v_country, v_level, v_points, coalesce(v_fandom, ''), now())
  on conflict (player_id) do update set
    name    = v_name,
    country = v_country,
    fandom  = coalesce(v_fandom, battle_scores.fandom),
    level   = case when (v_level, v_points) > (battle_scores.level, battle_scores.points)
                   then v_level else battle_scores.level end,
    points  = case when (v_level, v_points) > (battle_scores.level, battle_scores.points)
                   then v_points else battle_scores.points end,
    submitted_at = case when (v_level, v_points) > (battle_scores.level, battle_scores.points)
                        then now() else battle_scores.submitted_at end;
end;
$$;

grant execute on function public.upsert_battle_score(uuid, text, text, int, int, text) to anon, authenticated;
