-- Hangul Type — Battle Mode fandom column + leaderboard (v4)
-- Adds:
--   battle_scores.fandom        — short ID (e.g. 'army', 'blink'), '' = none
--   set_battle_fandom RPC       — set/update a player's fandom server-side
--   get_fandom_leaderboard RPC  — top 50 fandoms aggregated by total points
--
-- Run in the Supabase SQL editor or via `supabase db push`.

alter table public.battle_scores
  add column if not exists fandom text not null default '';

-- Allow a fandom-aware index for the aggregate leaderboard. Excludes
-- players who haven't picked a fandom and rows that were flagged.
create index if not exists battle_scores_fandom_idx
  on public.battle_scores (fandom)
  where flagged = false and fandom <> '';

-- ============================================================
-- set_battle_fandom — client calls this after profile save / score submit.
-- No-op when the player isn't on the leaderboard yet (fandom is recorded
-- on their next upsert via the upsert_battle_score path once that's also
-- updated; until then this just keeps existing rows in sync).
-- ============================================================
create or replace function public.set_battle_fandom(
  p_id     uuid,
  p_fandom text
) returns void
language sql
security definer
as $$
  update public.battle_scores
     set fandom = coalesce(nullif(trim(lower(p_fandom)), ''), '')
   where player_id = p_id;
$$;

grant execute on function public.set_battle_fandom(uuid, text) to anon, authenticated;

-- ============================================================
-- get_fandom_leaderboard — top 50 fandoms ordered by total points.
-- Each row: fandom id, member count (players), total points across all
-- members, and the highest-ranked individual in that fandom.
-- ============================================================
create or replace function public.get_fandom_leaderboard()
returns table(
  fandom        text,
  members       int,
  total_points  bigint,
  top_player    text,
  top_country   text,
  top_points    int
)
language sql
security definer
as $$
  with by_fandom as (
    select
      fandom,
      count(*)::int           as members,
      sum(points)::bigint     as total_points
    from public.battle_scores
    where flagged = false and fandom <> ''
    group by fandom
  ),
  top_each as (
    select distinct on (bs.fandom)
      bs.fandom,
      bs.name      as top_player,
      bs.country   as top_country,
      bs.points    as top_points
    from public.battle_scores bs
    where bs.flagged = false and bs.fandom <> ''
    order by bs.fandom, bs.points desc, bs.level desc, bs.submitted_at asc
  )
  select
    bf.fandom,
    bf.members,
    bf.total_points,
    te.top_player,
    te.top_country,
    te.top_points
  from by_fandom bf
  left join top_each te on te.fandom = bf.fandom
  order by bf.total_points desc, bf.members desc, bf.fandom asc
  limit 50;
$$;

grant execute on function public.get_fandom_leaderboard() to anon, authenticated;

-- ============================================================
-- get_fandom_rank — your fandom's rank among all fandoms. 0 if you
-- haven't set a fandom or your fandom isn't on the board yet.
-- ============================================================
create or replace function public.get_fandom_rank(p_fandom text)
returns table(rank int, total int)
language plpgsql
security definer
as $$
declare
  my_total bigint;
  v_rank   int;
  v_total  int;
  v_f      text := coalesce(nullif(trim(lower(p_fandom)), ''), '');
begin
  select count(distinct fandom)::int into v_total
    from public.battle_scores
    where flagged = false and fandom <> '';

  if v_f = '' then
    rank := 0; total := v_total; return next; return;
  end if;

  select sum(points)::bigint into my_total
    from public.battle_scores
    where flagged = false and fandom = v_f;

  if my_total is null then
    rank := 0; total := v_total; return next; return;
  end if;

  select count(*)::int + 1 into v_rank
  from (
    select fandom, sum(points) as p
    from public.battle_scores
    where flagged = false and fandom <> ''
    group by fandom
    having sum(points) > my_total
  ) others;

  rank := v_rank; total := v_total; return next;
end;
$$;

grant execute on function public.get_fandom_rank(text) to anon, authenticated;
