-- Type Hangeul — Battle Mode moderation + anomaly detection (v3)
-- Run in the Supabase SQL editor or via `supabase db push`.
--
-- Adds:
--   battle_scores.flagged_reason  — short token naming why a row was flagged
--                                    (so kill-switch is per-pattern, not all-or-nothing)
-- Functions:
--   is_profane_name              — English profanity check, returns matching pattern or null
--   detect_score_anomaly         — flags impossible (level, points) tuples
--   moderate_battle_score        — trigger fn: runs both checks on insert/update
-- Trigger:
--   battle_scores_moderate       — BEFORE INSERT OR UPDATE on battle_scores
-- Backfill:
--   Re-evaluates all existing rows so retroactive flagging works.
--
-- Out of scope (deferred):
--   • Per-IP throttle (would break PC-방 / school-lab shared-NAT case without HMAC)
--   • Korean profanity (high false-positive rate on common syllables — re-evaluate
--     after observing real abuse patterns)
--   • HMAC nonce / replay protection (requires Edge Function — violates no-build-step)

-- ============================================================
-- flagged_reason: short pattern name written by the trigger.
-- ============================================================
alter table public.battle_scores
  add column if not exists flagged_reason text;

create index if not exists battle_scores_flagged_reason_idx
  on public.battle_scores (flagged_reason)
  where flagged = true;

-- ============================================================
-- is_profane_name(name) → text or null
-- Returns the matched pattern name, or null if clean.
-- English-only v1. Each pattern is a labeled regex so the kill-switch
-- can disable a single pattern (UPDATE ... WHERE flagged_reason = 'PATTERN')
-- instead of unflagging everything.
-- ============================================================
create or replace function public.is_profane_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(coalesce(p_name, ''));
begin
  if v = '' then return null; end if;

  -- Strip leetspeak / spacing / punctuation for matching:
  v := translate(v, '0134578@$!|', 'oleastbtais');
  v := regexp_replace(v, '[^a-z]', '', 'g');
  if length(v) < 3 then return null; end if;

  -- Hard list. Each entry is a small regex; the labels go into flagged_reason.
  -- Word-stem matches handle plurals/suffixes (e.g. "fucker", "fucking").
  if v ~ 'fuck'                               then return 'PROF_FUCK';     end if;
  if v ~ 'shit'                               then return 'PROF_SHIT';     end if;
  if v ~ 'cunt'                               then return 'PROF_CUNT';     end if;
  if v ~ 'bitch'                              then return 'PROF_BITCH';    end if;
  if v ~ 'asshole'                            then return 'PROF_ASSHOLE';  end if;
  if v ~ 'dick'                               then return 'PROF_DICK';     end if;
  if v ~ 'pussy'                              then return 'PROF_PUSSY';    end if;
  if v ~ 'cock'                               then return 'PROF_COCK';     end if;
  if v ~ 'whore'                              then return 'PROF_WHORE';    end if;
  if v ~ 'slut'                               then return 'PROF_SLUT';     end if;
  if v ~ 'nigger'                             then return 'PROF_NIGGER';   end if;
  if v ~ 'nigga'                              then return 'PROF_NIGGA';    end if;
  if v ~ 'faggot'                             then return 'PROF_FAGGOT';   end if;
  if v ~ 'retard'                             then return 'PROF_RETARD';   end if;
  if v ~ 'rape'                               then return 'PROF_RAPE';     end if;
  if v ~ 'kike'                               then return 'PROF_KIKE';     end if;
  if v ~ 'chink'                              then return 'PROF_CHINK';    end if;
  if v ~ 'spic'                               then return 'PROF_SPIC';     end if;

  return null;
end;
$$;

grant execute on function public.is_profane_name(text) to anon, authenticated;

-- ============================================================
-- detect_score_anomaly(level, points) → text or null
-- Heuristic checks for tuples that should never legitimately exist.
-- Returns the rule name, or null if the tuple is plausible.
-- ============================================================
create or replace function public.detect_score_anomaly(p_level int, p_points int)
returns text
language plpgsql
immutable
as $$
begin
  if p_level is null or p_points is null then return null; end if;

  -- Cap rule (mirrors the hard cap in upsert_battle_score, just in case).
  if p_points > 1500000 then return 'ANOM_OVERCAP'; end if;

  -- Late-game, near-zero score: cleared many waves but didn't accumulate
  -- points — implies the game state isn't internally consistent.
  if p_level >= 50 and p_points < (p_level * 1000) then
    return 'ANOM_HIGH_LEVEL_LOW_POINTS';
  end if;

  -- Early-game, gigantic score: way too many points for that level cap.
  -- Each level normally contributes <50K, so 50K * level is a generous ceiling.
  if p_level <= 10 and p_points > (p_level * 50000) then
    return 'ANOM_LOW_LEVEL_HIGH_POINTS';
  end if;

  return null;
end;
$$;

grant execute on function public.detect_score_anomaly(int, int) to anon, authenticated;

-- ============================================================
-- moderate_battle_score (trigger): runs both checks before insert/update.
-- ============================================================
create or replace function public.moderate_battle_score()
returns trigger
language plpgsql
as $$
declare
  v_reason text;
begin
  v_reason := public.is_profane_name(NEW.name);
  if v_reason is null then
    v_reason := public.detect_score_anomaly(NEW.level, NEW.points);
  end if;

  if v_reason is not null then
    NEW.flagged := true;
    NEW.flagged_reason := v_reason;
  else
    -- A previously flagged row whose reason no longer applies stays flagged
    -- (we don't auto-unflag; the kill-switch / manual review handles that).
    -- New clean rows get cleared explicitly to defend against junk values.
    if TG_OP = 'INSERT' then
      NEW.flagged := false;
      NEW.flagged_reason := null;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists battle_scores_moderate on public.battle_scores;
create trigger battle_scores_moderate
  before insert or update on public.battle_scores
  for each row execute function public.moderate_battle_score();

-- ============================================================
-- Backfill: re-evaluate every existing row so the moderation history
-- catches up. Triggers fire on UPDATE so we just touch each row.
-- ============================================================
update public.battle_scores
   set name = name
 where true;
