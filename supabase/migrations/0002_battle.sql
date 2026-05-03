-- Hangul Type — Battle Mode leaderboard + analytics (v2)
-- Run in the Supabase SQL editor (Dashboard -> SQL -> New query) or via `supabase db push`.
--
-- Adds:
--   battle_scores      — one row per player, best run wins (level, points)
--   battle_attempts    — append-only log of every game-over (analytics)
-- RPCs:
--   upsert_battle_score   — server-side caps, rate limit, GREATEST(level, points)
--   log_battle_attempt    — fire-and-forget attempt counter
--   get_battle_rank       — your global rank + total ranked players
--   get_battle_stats      — unique players, total attempts, ranked players
--   update_battle_profile — change display name/country without resubmitting a score

create extension if not exists "uuid-ossp";

-- ============================================================
-- battle_scores: one row per player. The "best run" wins on
-- (level, points) tuple comparison. submitted_at is the time
-- of the *winning* run and breaks ties (earlier wins).
-- ============================================================
create table if not exists public.battle_scores (
  player_id     uuid primary key,
  name          text not null default 'Player',
  country       text not null default 'US',
  level         int  not null check (level between 1 and 99),
  points        int  not null check (points between 0 and 1500000),
  submitted_at  timestamptz not null default now(),
  flagged       boolean not null default false
);

-- Top-100 query: order by level desc, points desc, submitted_at asc
create index if not exists battle_scores_rank_idx
  on public.battle_scores (level desc, points desc, submitted_at asc)
  where flagged = false;

-- ============================================================
-- battle_attempts: append-only. Every game-over inserts one row.
-- Used to compute "how many people have battled" and "total attempts".
-- ============================================================
create table if not exists public.battle_attempts (
  id          bigserial primary key,
  player_id   uuid,
  level       int,
  points      int,
  created_at  timestamptz not null default now()
);

create index if not exists battle_attempts_player_idx
  on public.battle_attempts (player_id, created_at desc);

-- ============================================================
-- RLS: leaderboard reads public; writes only via SECURITY DEFINER RPCs.
-- ============================================================
alter table public.battle_scores   enable row level security;
alter table public.battle_attempts enable row level security;

drop policy if exists "public read battle scores" on public.battle_scores;
create policy "public read battle scores"
  on public.battle_scores
  for select using (flagged = false);

-- battle_attempts: no public read. Aggregate counts come from get_battle_stats RPC.
-- (No anon select policy = no rows returned to anon.)

-- ============================================================
-- upsert_battle_score
-- - clamps level/points to sane ranges
-- - rejects values past the soft cap (anti-cheat)
-- - rate limits to 1 score-improving submission per 5 seconds per player
-- - keeps the best run by (level, points) tuple comparison
-- - always refreshes name + country
-- ============================================================
create or replace function public.upsert_battle_score(
  p_id      uuid,
  p_name    text,
  p_country text,
  p_level   int,
  p_points  int
) returns void
language plpgsql
security definer
as $$
declare
  v_recent  timestamptz;
  v_level   int := coalesce(p_level, 1);
  v_points  int := coalesce(p_points, 0);
  v_name    text := coalesce(nullif(trim(p_name), ''), 'Player');
  v_country text := coalesce(nullif(trim(p_country), ''), 'US');
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
    -- Allow name/country refresh but not a score change.
    update public.battle_scores
       set name = v_name, country = v_country
     where player_id = p_id;
    return;
  end if;

  insert into public.battle_scores (player_id, name, country, level, points, submitted_at)
  values (p_id, v_name, v_country, v_level, v_points, now())
  on conflict (player_id) do update set
    name    = v_name,
    country = v_country,
    level   = case when (v_level, v_points) > (battle_scores.level, battle_scores.points)
                   then v_level else battle_scores.level end,
    points  = case when (v_level, v_points) > (battle_scores.level, battle_scores.points)
                   then v_points else battle_scores.points end,
    submitted_at = case when (v_level, v_points) > (battle_scores.level, battle_scores.points)
                        then now() else battle_scores.submitted_at end;
end;
$$;

grant execute on function public.upsert_battle_score(uuid, text, text, int, int) to anon, authenticated;

-- ============================================================
-- log_battle_attempt — every game-over fires this. Used purely for analytics.
-- ============================================================
create or replace function public.log_battle_attempt(
  p_id     uuid,
  p_level  int,
  p_points int
) returns void
language sql
security definer
as $$
  insert into public.battle_attempts (player_id, level, points)
  values (
    p_id,
    greatest(1, least(99, coalesce(p_level, 1))),
    greatest(0, least(1500000, coalesce(p_points, 0)))
  );
$$;

grant execute on function public.log_battle_attempt(uuid, int, int) to anon, authenticated;

-- ============================================================
-- get_battle_rank — your global rank (1 = best). 0 = not on the board yet.
-- Tiebreaker matches the leaderboard ordering (earlier submitted_at wins).
-- ============================================================
create or replace function public.get_battle_rank(p_id uuid)
returns table(rank int, total int)
language plpgsql
security definer
as $$
declare
  my_level     int;
  my_points    int;
  my_submitted timestamptz;
  v_rank       int;
  v_total      int;
begin
  select level, points, submitted_at
    into my_level, my_points, my_submitted
    from public.battle_scores
    where player_id = p_id and flagged = false;

  select count(*)::int into v_total from public.battle_scores where flagged = false;

  if my_level is null then
    rank := 0;
    total := v_total;
    return next;
    return;
  end if;

  select count(*)::int + 1 into v_rank
  from public.battle_scores
  where flagged = false
    and player_id <> p_id
    and (
         level > my_level
      or (level = my_level and points > my_points)
      or (level = my_level and points = my_points and submitted_at < my_submitted)
    );

  rank := v_rank;
  total := v_total;
  return next;
end;
$$;

grant execute on function public.get_battle_rank(uuid) to anon, authenticated;

-- ============================================================
-- get_battle_stats — top-of-leaderboard analytics blob.
--   unique_players  — distinct players who ever attempted a battle
--   total_attempts  — every game-over ever
--   ranked_players  — players currently on the leaderboard (best-score table)
-- ============================================================
create or replace function public.get_battle_stats()
returns table(unique_players int, total_attempts int, ranked_players int)
language sql
security definer
as $$
  select
    (select count(distinct player_id)::int from public.battle_attempts where player_id is not null),
    (select count(*)::int                  from public.battle_attempts),
    (select count(*)::int                  from public.battle_scores   where flagged = false);
$$;

grant execute on function public.get_battle_stats() to anon, authenticated;

-- ============================================================
-- update_battle_profile — change display name/country without resubmitting a score.
-- No-op if the player isn't on the leaderboard yet.
-- ============================================================
create or replace function public.update_battle_profile(
  p_id      uuid,
  p_name    text,
  p_country text
) returns void
language sql
security definer
as $$
  update public.battle_scores
     set name    = coalesce(nullif(trim(p_name), ''), 'Player'),
         country = coalesce(nullif(trim(p_country), ''), 'US')
   where player_id = p_id;
$$;

grant execute on function public.update_battle_profile(uuid, text, text) to anon, authenticated;
