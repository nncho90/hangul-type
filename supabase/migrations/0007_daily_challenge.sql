-- 0007: daily challenge foundation
-- Creates battle_daily table and upsert_daily_score RPC with the same
-- anti-cheat safeguards as upsert_battle_score (rate-limit 5s, points clamp).

create table if not exists public.battle_daily (
  id          bigserial primary key,
  player_id   uuid      not null,
  name        text      not null default 'Player',
  country     text      not null default 'US',
  day         date      not null,
  points      int       not null default 0,
  created_at  timestamptz default now(),
  unique (player_id, day)
);

alter table public.battle_daily enable row level security;

-- Anon can read all daily scores (leaderboard display)
create policy "anon_select_daily" on public.battle_daily
  for select using (true);

-- No direct insert/update from the client; all writes go through the RPC.
create index if not exists battle_daily_day_points_idx
  on public.battle_daily (day, points desc);

-- RPC: upsert_daily_score
-- Only raises points for a given (player_id, day); never lowers them.
-- Rate-limited: ignores submits within 5s of the previous one for the same player+day.
create or replace function public.upsert_daily_score(
  p_id      uuid,
  p_name    text,
  p_country text,
  p_points  int
) returns void
language plpgsql
security definer
as $$
declare
  v_recent   timestamptz;
  v_points   int  := coalesce(p_points, 0);
  v_name     text := coalesce(nullif(trim(p_name), ''), 'Player');
  v_country  text := coalesce(nullif(trim(p_country), ''), 'US');
begin
  if p_id is null then return; end if;

  -- Clamp points: [0, 200000]
  if v_points < 0     then v_points := 0;      end if;
  if v_points > 200000 then v_points := 200000; end if;

  -- Rate limit: check last submit for this player on today's date
  select created_at into v_recent
    from public.battle_daily
   where player_id = p_id
     and day = current_date;

  if v_recent is not null and now() - v_recent < interval '5 seconds' then
    -- Allow name/country refresh but not score change
    update public.battle_daily
       set name    = v_name,
           country = v_country
     where player_id = p_id
       and day = current_date;
    return;
  end if;

  insert into public.battle_daily (player_id, name, country, day, points, created_at)
    values (p_id, v_name, v_country, current_date, v_points, now())
  on conflict (player_id, day) do update
    set name       = v_name,
        country    = v_country,
        -- Only raise the score, never lower it
        points     = greatest(battle_daily.points, excluded.points),
        created_at = now();
end;
$$;

grant execute on function public.upsert_daily_score(uuid, text, text, int) to anon;
