-- Hangul Type — leaderboard + league schema (v1)
-- Run in the Supabase SQL editor (Dashboard -> SQL -> New query) or via `supabase db push`.

create extension if not exists "uuid-ossp";

-- ============================================================
-- players: one row per anonymous user (UUID generated client-side)
-- ============================================================
create table if not exists public.players (
  id              uuid primary key,
  name            text not null default 'Player',
  country         text not null default 'US',
  tier            text not null default 'bronze',
  weekly_xp       integer not null default 0,
  all_time_xp     integer not null default 0,
  week_iso        text,                            -- e.g. '2026-W18'
  joined_at       timestamptz not null default now(),
  last_active_at  timestamptz not null default now(),
  bracket_key     text,                            -- 'YYYY-Www|tier|N'
  bracket_pos     integer,
  flagged         boolean not null default false   -- impossible scores set this true
);

create index if not exists players_weekly_xp_idx   on public.players (weekly_xp desc) where flagged = false;
create index if not exists players_all_time_xp_idx on public.players (all_time_xp desc) where flagged = false;
create index if not exists players_bracket_idx     on public.players (bracket_key);

-- ============================================================
-- xp_submissions: append-only audit log; helps debug + anti-cheat
-- ============================================================
create table if not exists public.xp_submissions (
  id              bigserial primary key,
  player_id       uuid not null references public.players(id) on delete cascade,
  week_iso        text not null,
  weekly_delta    integer not null,
  all_time_delta  integer not null,
  client_ip       text,
  created_at      timestamptz not null default now()
);

create index if not exists xp_subs_player_idx on public.xp_submissions (player_id, created_at desc);

-- ============================================================
-- bracket_archive: snapshot of a finalized week's bracket
-- ============================================================
create table if not exists public.bracket_archive (
  id              bigserial primary key,
  week_iso        text not null,
  tier            text not null,
  group_num       integer not null,
  rankings        jsonb not null,                  -- [{id, name, country, weekly_xp, finalRank, promoted, demoted}, ...]
  finalized_at    timestamptz not null default now()
);

create index if not exists bracket_archive_week_idx on public.bracket_archive (week_iso desc);

-- ============================================================
-- Row-Level Security: make leaderboard reads public; restrict writes
-- ============================================================
alter table public.players          enable row level security;
alter table public.xp_submissions   enable row level security;
alter table public.bracket_archive  enable row level security;

-- Anyone (anon role) can SELECT on players + bracket_archive (public leaderboards)
drop policy if exists "public read players"          on public.players;
drop policy if exists "public read bracket archive"  on public.bracket_archive;
create policy "public read players"          on public.players          for select using (true);
create policy "public read bracket archive"  on public.bracket_archive  for select using (true);

-- Writes happen ONLY via Edge Functions running with the service-role key.
-- No anon insert/update policy; writes from the client are blocked.

-- Optional helper RPC to get a player's current bracket
create or replace function public.get_my_bracket(p_player_id uuid)
returns setof public.players
language sql
security definer
as $$
  select *
  from public.players
  where bracket_key = (select bracket_key from public.players where id = p_player_id)
  order by weekly_xp desc;
$$;

grant execute on function public.get_my_bracket(uuid) to anon, authenticated;
