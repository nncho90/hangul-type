# Hangul Type — Supabase Backend

Anonymous-identity, low-friction backend for the global leaderboard, bracketed leagues, and weekly rollover. Free tier handles thousands of players.

## What's here

```
supabase/
  migrations/
    0001_init.sql                  -- tables, indexes, RLS policies
  functions/
    submit-xp/index.ts             -- POST: rate-limited XP submit + bracket assignment
    get-bracket/index.ts           -- GET:  the caller's current bracket of 30
    rollover-league/index.ts       -- weekly cron: archive + promote/demote
```

## One-time setup (5–10 min)

### 1. Create a Supabase project

- Sign up at https://supabase.com (free tier, no credit card)
- Create a new project. Give it a name. Pick the closest region. Set a strong DB password (you won't need it after this step).
- After the project provisions, you'll land on the dashboard.

### 2. Capture your project URL and anon key

- In the dashboard, go to **Project Settings → API**.
- Copy the `URL` (e.g. `https://abcdefgh.supabase.co`) and the `anon public` key (the long JWT under "Project API keys").

### 3. Wire them into the frontend

Open `/Users/nelsoncho/projects/hangul-type/index.html`, find these constants near the top of the inline script:

```js
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
```

Paste your URL and anon key in.

### 4. Run the SQL migration

- Dashboard → **SQL** → **New query** → paste the entire contents of `migrations/0001_init.sql` → **Run**.
- You should see "Success. No rows returned" once.
- Verify in the Table editor that `players`, `xp_submissions`, and `bracket_archive` exist.

### 5. Install the Supabase CLI and deploy the Edge Functions

```bash
# Install
npm install -g supabase

# Log in (opens browser)
supabase login

# Link to your project (you'll be prompted for the project ref from the dashboard URL)
cd /Users/nelsoncho/projects/hangul-type
supabase link --project-ref <your-project-ref>

# Set the service role key as a secret (Edge Functions use this to bypass RLS for writes)
# Get the service_role key from Project Settings → API. KEEP IT SECRET. Never paste in the frontend.
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Optional shared secret for the rollover cron (use any random string)
supabase secrets set ROLLOVER_TOKEN=$(openssl rand -hex 32)

# Deploy all three functions
supabase functions deploy submit-xp
supabase functions deploy get-bracket
supabase functions deploy rollover-league
```

### 6. Schedule the weekly rollover

In the Supabase dashboard → **Edge Functions → rollover-league → Schedules**:
- Cron: `59 23 * * SUN` (Sunday 23:59 UTC)
- Headers: `x-rollover-token: <the same token you set above>`

Or run `rollover-league` manually for testing:
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/rollover-league' \
  -H 'x-rollover-token: <your-token>'
```

## How the data flows

1. Player completes a word → `gainXp` → if `mode==='league'`, queues XP locally
2. Every 30s (and on page hide) → POST `/functions/v1/submit-xp` with the queued delta
3. `submit-xp` rate-limits (1/min/player), validates, upserts the player row, increments weekly + all-time XP, assigns a bracket if missing, appends to audit log
4. Frontend GETs `/rest/v1/players?order=weekly_xp.desc&limit=100` for the global leaderboard tab
5. Frontend GETs `/functions/v1/get-bracket?player_id=...` for the league panel
6. Sunday 23:59 UTC: `rollover-league` snapshots each bracket to `bracket_archive`, promotes top 5, demotes bottom 5, resets `weekly_xp=0`, clears `bracket_key`. Next submission triggers re-bracket assignment

## Row-Level Security model

- Reads on `players` and `bracket_archive` are PUBLIC — anyone with the anon key can fetch the leaderboard. That's the intent.
- Writes are blocked for anon. Edge Functions use the service-role key (kept secret) to write.
- Anti-cheat: `submit-xp` flags any submission with `> MAX_WEEKLY_DELTA` XP. Flagged players are excluded from the leaderboard via the partial index.

## Cost estimate

- DB: <1 MB for ~10k players → free
- Edge Functions: ~2 invocations per player per session → 100k req/day = ~50k DAU. Free tier covers it.
- Realtime: not used.
- Egress: trivial.

## Local dev

```bash
supabase start                 # runs Postgres + Auth + Functions locally
supabase functions serve --no-verify-jwt
```

Set `SUPABASE_URL='http://localhost:54321'` in the frontend for local testing.

## Troubleshooting

- **"backend not configured" in Records → Global tab**: `SUPABASE_URL` or `SUPABASE_ANON_KEY` is still empty in `index.html`. Set them.
- **`submit-xp` returns 401**: anon key is missing/wrong in the frontend. Re-check Project Settings → API.
- **`submit-xp` returns 500**: usually the service-role key isn't set. `supabase secrets list` to confirm.
- **Leaderboard is empty**: nobody has typed in League mode yet. Switch to League mode and finish a word.
