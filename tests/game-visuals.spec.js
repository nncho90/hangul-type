// @ts-check
// Regression tests for the game.html animation / graphics / performance
// pass: lazy WebP backgrounds, z-order bands, loop-driven walk frames,
// hit-stop timing, and content that must stay visible under reduced motion.
const { test, expect } = require('./fixtures');

const URL = '/game.html';

async function seedGame(page) {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.setItem('hangul-type-progress-v1', JSON.stringify({
      playerId: 'test-player-001',
      profile: { name: 'TestPlayer', countryCode: 'US' }
    }));
    localStorage.setItem('hangul-battle-saw-intro-v2', '1');
  });
  await page.reload();
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });
}

test('specs never reach production Supabase', async ({ page, browser }) => {
  const hits = [];
  let blocked = 0;
  const ctx = await browser.newContext();
  for (const p of [page, await ctx.newPage()]) {
    p.on('requestfinished', r => { if (/supabase\.co/.test(r.url())) hits.push(r.url()); });
    p.on('requestfailed', r => { if (/supabase\.co/.test(r.url())) blocked++; });
    await seedGame(p);
    await p.evaluate(() => { window.doStartGame(); window.state.lives = 0; window.gameOver(); });
    await p.waitForTimeout(500);
  }
  await ctx.close();
  expect(hits).toEqual([]);
  // The game did try (leaderboard / attempt log), and both contexts blocked it.
  expect(blocked).toBeGreaterThan(1);
});

test('game start loads only the first background, as WebP', async ({ page }) => {
  const bgs = [];
  page.on('request', r => { if (/sprites\/backgrounds\//.test(r.url())) bgs.push(r.url().split('/').pop()); });
  await seedGame(page);
  expect(bgs).toHaveLength(0);
  await page.evaluate(() => window.doStartGame());
  await page.waitForFunction(() => !!document.querySelector('.backdrop .bg-layer.on'), { timeout: 4000 });
  expect([...new Set(bgs)]).toEqual(['01-village.webp']);
});

test('monsters stay in the 38-58 z band, under the player and the fx layer', async ({ page }) => {
  await seedGame(page);
  await page.evaluate(() => window.doStartGame());
  const res = await page.evaluate(() => {
    window.state.spawnPauseMs = 1e9;
    let g = 0;
    while (window.state.monsters.length < 3 && g++ < 40) window.spawnMonster();
    const sr = window.getStageRect();
    window.state.monsters.forEach((m, i) => { m.y = sr.height * (0.1 + i * 0.3); window.renderMonsterDepth(m); });
    const z = window.state.monsters.map(m => Number(m.el.style.zIndex));
    return {
      min: Math.min(...z), max: Math.max(...z),
      player: Number(getComputedStyle(document.getElementById('player')).zIndex),
      fx: Number(getComputedStyle(document.getElementById('fxLayer')).zIndex),
    };
  });
  expect(res.min).toBeGreaterThanOrEqual(38);
  expect(res.max).toBeLessThanOrEqual(58);
  expect(res.player).toBeGreaterThan(res.max);
  expect(res.fx).toBeGreaterThan(95);
});

test('walk frames cycle through all four frames and freeze while paused', async ({ page }) => {
  await seedGame(page);
  await page.evaluate(() => window.doStartGame());
  await page.evaluate(() => {
    window.state.spawnPauseMs = 1e9;
    let g = 0;
    while (window.state.monsters.filter(m => m.spriteFile).length < 1 && g++ < 40) window.spawnMonster();
    const m = window.state.monsters.find(x => x.spriteFile);
    m.speed = 0; m.diveSpeed = 0; m.motion = 'straight';
    window.__seen = new Set();
    window.__m = m;
    (function watch() {
      if (!m.el || !m.el.isConnected) return;
      const src = m.el.querySelector('img.sprite-img').getAttribute('src');
      window.__seen.add(src.replace(/.*-(walk-\d)\.png$/, '$1'));
      requestAnimationFrame(watch);
    })();
  });
  await page.waitForTimeout(1000);
  const seen = await page.evaluate(() => [...window.__seen].sort());
  expect(seen).toEqual(['walk-1', 'walk-2', 'walk-3', 'walk-4']);

  await page.evaluate(() => window.togglePause());
  const before = await page.evaluate(() => window.__m.walkT);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ t: window.__m.walkT, cls: document.body.classList.contains('paused') }));
  expect(after.t).toBe(before);
  expect(after.cls).toBe(true);
});

test('hit-stop freezes monster motion briefly, then it resumes', async ({ page }) => {
  await seedGame(page);
  await page.evaluate(() => window.doStartGame());
  await page.evaluate(() => {
    window.state.spawnPauseMs = 1e9;
    let g = 0;
    while (window.state.monsters.length < 1 && g++ < 40) window.spawnMonster();
    const m = window.state.monsters[0];
    m.motion = 'straight'; m.speed = 40; m.y = 120;
    window.__m = m;
    window.hitStop(250);
  });
  const y0 = await page.evaluate(() => window.__m.y);
  await page.waitForTimeout(120);
  const y1 = await page.evaluate(() => window.__m.y);
  expect(y1).toBe(y0);
  await page.waitForTimeout(500);
  const res = await page.evaluate(() => ({ y: window.__m.y, cls: document.getElementById('stage').classList.contains('hitstop') }));
  expect(res.y).toBeGreaterThan(y0);
  expect(res.cls).toBe(false);
});

test('reduced motion keeps the English reveal and level banner visible', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  await seedGame(page);
  await page.evaluate(() => window.doStartGame());
  await page.evaluate(() => {
    window.state.spawnPauseMs = 1e9;
    let g = 0;
    while (window.state.monsters.length < 1 && g++ < 40) window.spawnMonster();
    const m = window.state.monsters[0];
    window.state.xp = window.xpThresholdForLevel(window.state.level) - 1;
    window.killMonster(m, true);
  });
  await page.waitForTimeout(400);
  const op = await page.evaluate(() => ['.english-reveal', '.level-banner'].map(sel => {
    const el = document.querySelector(sel);
    return el ? Number(getComputedStyle(el).opacity) : -1;
  }));
  expect(op[0]).toBeGreaterThan(0.9);
  expect(op[1]).toBeGreaterThan(0.9);
  await context.close();
});
