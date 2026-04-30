// SRS regression test — locks the simplified SM-2 behavior in index.html.
// The functions are inlined here because index.html doesn't export modules.
// Run: node test-srs.mjs

const DAY_MS = 86400000;
const TEN_MIN_MS = 10 * 60 * 1000;

function nowIso() { return new Date().toISOString(); }

function rateWord(s, rating) {
  s.lastRated = nowIso();
  if (rating < 3) {
    s.lapses++;
    s.reps = 0;
    s.interval = 0;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.dueAt = new Date(Date.now() + TEN_MIN_MS).toISOString();
    return s;
  }
  s.ease = Math.max(1.3, s.ease + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));
  s.reps++;
  if (s.reps === 1) s.interval = 1;
  else if (s.reps === 2) s.interval = 6;
  else s.interval = Math.round(s.interval * s.ease);
  s.dueAt = new Date(Date.now() + s.interval * DAY_MS).toISOString();
  return s;
}

function ratingFromAccuracy(acc) {
  if (acc >= 95) return 5;
  if (acc >= 85) return 4;
  if (acc >= 70) return 3;
  return 2;
}

function decayDaysForLevel(lv) {
  if (lv >= 5) return Infinity;
  if (lv === 4) return 14;
  if (lv === 3) return 7;
  return 4;
}

const cases = [];
function expect(name, ok, detail) { cases.push({ name, ok, detail: detail || '' }); }

// Rating-from-accuracy boundaries
expect('100% accuracy → 5', ratingFromAccuracy(100) === 5);
expect('95% accuracy → 5', ratingFromAccuracy(95) === 5);
expect('94% accuracy → 4', ratingFromAccuracy(94) === 4);
expect('85% accuracy → 4', ratingFromAccuracy(85) === 4);
expect('70% accuracy → 3', ratingFromAccuracy(70) === 3);
expect('69% accuracy → 2 (lapse)', ratingFromAccuracy(69) === 2);
expect('0% accuracy → 2 (lapse)', ratingFromAccuracy(0) === 2);

// Standard SM-2 progression
{
  const s = { ease: 2.5, interval: 0, dueAt: nowIso(), reps: 0, lapses: 0, lastRated: null };
  rateWord(s, 5);
  expect('first review (rating 5): reps=1, interval=1', s.reps === 1 && s.interval === 1);
  rateWord(s, 5);
  expect('second review (rating 5): reps=2, interval=6', s.reps === 2 && s.interval === 6);
  const beforeEase = s.ease;
  rateWord(s, 5);
  expect('third review uses NEW ease (canonical SM-2 order)', s.interval >= 14 && s.interval <= 18 && s.ease > beforeEase);
}

// Lapse behavior
{
  const s = { ease: 2.5, interval: 16, dueAt: nowIso(), reps: 5, lapses: 0, lastRated: null };
  rateWord(s, 2);
  expect('lapse: reps reset to 0', s.reps === 0);
  expect('lapse: interval = 0 (relearn)', s.interval === 0);
  expect('lapse: lapses incremented', s.lapses === 1);
  expect('lapse: ease decreased by 0.2', Math.abs(s.ease - 2.3) < 0.001);
  const due = new Date(s.dueAt).getTime() - Date.now();
  expect('lapse: dueAt is ~10 min ahead, not 1 day', due > 9 * 60 * 1000 && due < 11 * 60 * 1000);
}

// Ease floor
{
  const s = { ease: 1.4, interval: 5, dueAt: nowIso(), reps: 3, lapses: 0, lastRated: null };
  rateWord(s, 0);
  expect('ease cannot drop below 1.3', s.ease >= 1.3 - 0.0001);
}

// Decay schedule
expect('decay: Lv 5 never decays', decayDaysForLevel(5) === Infinity);
expect('decay: Lv 4 → 3 after 14 days', decayDaysForLevel(4) === 14);
expect('decay: Lv 3 → 2 after 7 days', decayDaysForLevel(3) === 7);
expect('decay: Lv 2 → 1 after 4 days', decayDaysForLevel(2) === 4);

let pass = 0, fail = 0;
for (const c of cases) {
  if (c.ok) { pass++; console.log('PASS  ' + c.name); }
  else { fail++; console.log('FAIL  ' + c.name + (c.detail ? ' :: ' + c.detail : '')); }
}
console.log(`\n${pass}/${cases.length} SRS cases passed`);
process.exit(fail > 0 ? 1 : 0);
