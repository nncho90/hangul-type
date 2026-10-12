// @ts-check
// Soundtrack: every map has a song that renders, map changes and boss fights
// switch songs, and pause / game over leave nothing playing.
const { test, expect } = require('./fixtures');

const URL = '/game.html';

async function seedGame(page) {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.setItem('hangul-type-progress-v1', JSON.stringify({ playerId: 'test-player-001' }));
    localStorage.setItem('hangul-battle-saw-intro-v2', '1');
  });
  await page.reload();
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });
}

test('every song renders audible, unclipped audio', async ({ page }) => {
  test.setTimeout(60000);
  const warnings = [];
  page.on('console', m => { if (m.text().includes('[bgm]')) warnings.push(m.text()); });
  await seedGame(page);
  const songs = await page.evaluate(() => Bgm.songs);
  expect(songs).toEqual(expect.arrayContaining(
    ['village', 'forest', 'study', 'courtyard', 'camp', 'battlefield', 'palace', 'boss']));
  for (const key of songs) {
    const { peak, rms } = await page.evaluate(async (k) => {
      const buf = await Bgm.render(k, 12, 16000);
      const d = buf.getChannelData(0);
      let peak = 0, sum = 0;
      for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); sum += d[i] * d[i]; }
      return { peak, rms: Math.sqrt(sum / d.length) };
    }, key);
    expect(rms, key).toBeGreaterThan(0.02);
    expect(peak, key).toBeLessThan(1);
  }
  expect(warnings).toEqual([]);
});

test('map change, boss fight and game over drive the music', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await seedGame(page);
  await page.evaluate(() => window.doStartGame());
  await page.waitForFunction(() => Bgm.state().playing === 'village', { timeout: 4000 });

  await page.evaluate(() => window.applyTheme('forest'));
  await page.waitForFunction(() => Bgm.state().playing === 'forest', { timeout: 4000 });

  await page.evaluate(() => { window.state.bossActive = false; window.state.pendingBoss = false; window.spawnBoss(); });
  await expect.poll(() => page.evaluate(() => Bgm.state().playing)).toBe('boss');
  // A map change mid-boss is remembered but doesn't interrupt the boss song
  await page.evaluate(() => window.applyTheme('study'));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => Bgm.state())).toMatchObject({ playing: 'boss', theme: 'study' });

  await page.evaluate(() => window.gameOver());
  await expect.poll(() => page.evaluate(() => Bgm.state())).toMatchObject({ playing: 'study', boss: false, paused: true });
  expect(errors).toEqual([]);
});
