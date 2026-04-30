// Hangul Type — rollover-league edge function
// Run weekly via Supabase scheduled function or external cron.
// Snapshots each bracket, promotes top 5, demotes bottom 5, archives, resets weekly_xp.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ROLLOVER_TOKEN = Deno.env.get('ROLLOVER_TOKEN'); // optional: shared secret for the trigger
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

const TIERS = ['bronze','silver','gold','sapphire','ruby','emerald','amethyst','obsidian','diamond','champion'];
const PROMO_COUNT = 5;
const DEMO_COUNT  = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (ROLLOVER_TOKEN && req.headers.get('x-rollover-token') !== ROLLOVER_TOKEN) {
    return new Response('Forbidden', { status: 403 });
  }

  const finishingWeek = isoWeek(new Date(Date.now() - 24*60*60*1000)); // yesterday's week
  const { data: bracketKeys } = await supa
    .from('players')
    .select('bracket_key')
    .like('bracket_key', `${finishingWeek}|%`);
  const uniqueKeys = [...new Set((bracketKeys || []).map(r => r.bracket_key!).filter(Boolean))];

  let promoted = 0, demoted = 0, archived = 0;
  for (const key of uniqueKeys) {
    const [, tier] = key.split('|');
    const tierIdx = TIERS.indexOf(tier);
    const { data: rows } = await supa
      .from('players')
      .select('id, name, country, tier, weekly_xp, all_time_xp')
      .eq('bracket_key', key)
      .order('weekly_xp', { ascending: false });
    if (!rows || rows.length === 0) continue;

    const rankings = rows.map((r, i) => ({
      ...r,
      finalRank: i + 1,
      promoted: i < PROMO_COUNT && tierIdx < TIERS.length - 1,
      demoted:  i >= rows.length - DEMO_COUNT && tierIdx > 0
    }));
    await supa.from('bracket_archive').insert({ week_iso: finishingWeek, tier, group_num: parseInt(key.split('|')[2]) || 0, rankings });
    archived++;

    // Apply promotions / demotions
    for (const r of rankings) {
      let newTier = r.tier;
      if (r.promoted) { newTier = TIERS[tierIdx + 1]; promoted++; }
      else if (r.demoted) { newTier = TIERS[Math.max(0, tierIdx - 1)]; demoted++; }
      await supa.from('players').update({
        tier: newTier,
        weekly_xp: 0,
        bracket_key: null,
        bracket_pos: null,
        week_iso: isoWeek(new Date())
      }).eq('id', r.id);
    }
  }

  return json({ finished_week: finishingWeek, promoted, demoted, archived }, 200);
});

function isoWeek(d: Date): string {
  const target = new Date(d.valueOf());
  target.setUTCHours(0,0,0,0);
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((target.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(wk).padStart(2,'0')}`;
}
function json(b: any, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...cors() } }); }
function cors() { return { 'Access-Control-Allow-Origin': '*' }; }
