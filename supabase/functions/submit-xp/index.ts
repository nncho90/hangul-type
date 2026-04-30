// Hangul Type — submit-xp edge function
// Validates rate limit, upserts the player row, appends a submission audit row,
// flags suspicious deltas, and assigns a bracket if the player doesn't have one.
//
// Deploy: `supabase functions deploy submit-xp`
//
// Request body:
//   { player_id: uuid, name: string, country: string,
//     weekly_xp_delta: int, all_time_xp_delta: int, week_iso: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

const TIERS = ['bronze','silver','gold','sapphire','ruby','emerald','amethyst','obsidian','diamond','champion'];
const BRACKET_SIZE = 30;
const MAX_WEEKLY_DELTA = 5000;        // sanity cap per submission
const MIN_INTERVAL_MS  = 60_000;      // 1 submission/min/player

const recentSubmits = new Map<string, number>(); // in-memory rate limit

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: cors() });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const { player_id, name, country, weekly_xp_delta, all_time_xp_delta, week_iso } = body || {};
  if (!isUuid(player_id)) return json({ error: 'invalid_player_id' }, 400);
  if (!Number.isFinite(weekly_xp_delta) || !Number.isFinite(all_time_xp_delta)) return json({ error: 'invalid_xp' }, 400);

  // Rate limit
  const last = recentSubmits.get(player_id) || 0;
  if (Date.now() - last < MIN_INTERVAL_MS) return json({ error: 'rate_limited' }, 429);
  recentSubmits.set(player_id, Date.now());

  const flagged = weekly_xp_delta > MAX_WEEKLY_DELTA || all_time_xp_delta > MAX_WEEKLY_DELTA;

  // Upsert player + increment XP. Use a single RPC to be atomic-ish.
  const { data: existing } = await supa
    .from('players')
    .select('id, weekly_xp, all_time_xp, week_iso, tier, bracket_key, bracket_pos')
    .eq('id', player_id)
    .maybeSingle();

  let newWeeklyXp = (existing?.weekly_xp ?? 0);
  // If the persisted week is older than the submitted week, reset weekly counter
  if (existing?.week_iso && existing.week_iso !== week_iso) newWeeklyXp = 0;
  newWeeklyXp += Math.max(0, weekly_xp_delta);
  const newAllTimeXp = (existing?.all_time_xp ?? 0) + Math.max(0, all_time_xp_delta);

  let bracketKey = existing?.bracket_key;
  if (!bracketKey) {
    bracketKey = await assignBracket(existing?.tier || 'bronze', week_iso);
  }

  const upsertRow = {
    id: player_id,
    name: String(name || 'Player').slice(0, 24),
    country: String(country || 'US').slice(0, 4).toUpperCase(),
    tier: existing?.tier || 'bronze',
    weekly_xp: newWeeklyXp,
    all_time_xp: newAllTimeXp,
    week_iso,
    bracket_key: bracketKey,
    last_active_at: new Date().toISOString(),
    flagged: existing?.flagged === true ? true : flagged,
    joined_at: existing ? undefined : new Date().toISOString()
  };
  // Drop undefined so upsert doesn't clobber
  Object.keys(upsertRow).forEach(k => upsertRow[k as keyof typeof upsertRow] === undefined && delete (upsertRow as any)[k]);

  const { error: upErr } = await supa.from('players').upsert(upsertRow, { onConflict: 'id' });
  if (upErr) return json({ error: 'upsert_failed', detail: upErr.message }, 500);

  // Append submission audit row (best-effort)
  await supa.from('xp_submissions').insert({
    player_id,
    week_iso,
    weekly_delta: weekly_xp_delta,
    all_time_delta: all_time_xp_delta,
    client_ip: req.headers.get('x-forwarded-for')?.split(',')[0] ?? null
  });

  return json({ ok: true, weekly_xp: newWeeklyXp, all_time_xp: newAllTimeXp, bracket_key: bracketKey, flagged }, 200);
});

async function assignBracket(tier: string, weekIso: string): Promise<string> {
  // Find the smallest open bracket for this tier this week, otherwise create a new one.
  const { data: rows } = await supa
    .from('players')
    .select('bracket_key')
    .like('bracket_key', `${weekIso}|${tier}|%`);
  const counts = new Map<string, number>();
  (rows || []).forEach(r => counts.set(r.bracket_key!, (counts.get(r.bracket_key!) || 0) + 1));
  let smallest = `${weekIso}|${tier}|0`;
  let smallestCount = Infinity;
  for (const [key, n] of counts) if (n < smallestCount) { smallest = key; smallestCount = n; }
  if (smallestCount >= BRACKET_SIZE) {
    const next = (counts.size || 0);
    smallest = `${weekIso}|${tier}|${next}`;
  }
  return smallest;
}

function isUuid(s: any) { return typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s); }
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors() } });
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type'
  };
}
