// Hangul Type — get-bracket edge function
// Returns the 30 players in the caller's current bracket, sorted by weekly_xp desc.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  const url = new URL(req.url);
  const playerId = url.searchParams.get('player_id');
  if (!playerId) return json({ error: 'missing_player_id' }, 400);

  const { data: me } = await supa.from('players').select('bracket_key, weekly_xp').eq('id', playerId).maybeSingle();
  if (!me?.bracket_key) return json([], 200);

  const { data: bracket } = await supa
    .from('players')
    .select('id, name, country, tier, weekly_xp, all_time_xp')
    .eq('bracket_key', me.bracket_key)
    .order('weekly_xp', { ascending: false })
    .limit(30);

  return json(bracket || [], 200);
});

function json(b: any, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...cors() } }); }
function cors() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }; }
