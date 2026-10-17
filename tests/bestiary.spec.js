// @ts-check
// 요괴 도감 (bestiary) + enemy speech bubbles.
const { test, expect } = require('./fixtures.js');

const URL = '/game.html';

async function seedGame(page) {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.setItem('hangul-type-progress-v1', JSON.stringify({
      playerId: 'test-player-bestiary',
      profile: { name: 'TestPlayer', countryCode: 'US' }
    }));
    localStorage.setItem('hangul-battle-saw-intro-v2', '1');
    localStorage.removeItem('hangul-bestiary-v1');
  });
  await page.reload();
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });
}

// Spawn one regular monster of a given kind (1-8) and return its id.
function spawnKind(page, kind) {
  return page.evaluate((k) => {
    const orig = window.monsterKindFor;
    window.monsterKindFor = () => k;
    try { window.spawnMonster(); } finally { window.monsterKindFor = orig; }
    const s = window.state;
    return s.monsters[s.monsters.length - 1].id;
  }, kind);
}

test('bestiary opens from the intro and Esc closes it', async ({ page }) => {
  await seedGame(page);
  await page.click('#btnBestiaryIntro');
  const modal = page.locator('#bestiaryModal');
  await expect(modal).toBeVisible();
  // 8 regular tiers + 5 bosses, all locked on a fresh save.
  await expect(modal.locator('.bestiary-card')).toHaveCount(13);
  await expect(modal.locator('.bestiary-card.locked')).toHaveCount(13);
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  // Intro modal is still up underneath.
  await expect(page.locator('#introModal')).toBeVisible();
});

test('keys typed while the bestiary is open do not reach the game', async ({ page }) => {
  await seedGame(page);
  await page.evaluate(() => window.doStartGame());
  await page.evaluate(() => { window.state.paused = true; window.openBestiary('test'); });
  const before = await page.evaluate(() => window.state.running);
  await page.keyboard.press('Escape');
  // Esc closed the bestiary instead of toggling pause.
  const after = await page.evaluate(() => ({
    hidden: document.getElementById('bestiaryModal').hidden,
    paused: window.state.paused,
    running: window.state.running
  }));
  expect(before).toBe(true);
  expect(after.hidden).toBe(true);
  expect(after.paused).toBe(true);
});

test('first kill unlocks the entry and counts kills', async ({ page }) => {
  await seedGame(page);
  await page.evaluate(() => window.doStartGame());
  for (const kind of [1, 8, 8]) {
    const id = await spawnKind(page, kind);
    await page.evaluate((mid) => {
      const m = window.state.monsters.find(x => x.id === mid);
      window.killMonster(m, true);
    }, id);
  }
  const kills = await page.evaluate(() => JSON.parse(localStorage.getItem('hangul-bestiary-v1')).kills);
  expect(kills['tier:1']).toBe(1);
  expect(kills['tier:8']).toBe(2);

  await page.evaluate(() => { window.state.paused = true; window.openBestiary('test'); });
  const t8 = page.locator('.bestiary-card[data-key="tier:8"]');
  await expect(t8).not.toHaveClass(/locked/);
  await expect(t8.locator('.bc-name')).toHaveText('염라대왕');
  await expect(t8.locator('.bc-kills')).toHaveText('처치 2');
  await expect(page.locator('.bestiary-card[data-key="tier:2"]')).toHaveClass(/locked/);
  await expect(page.locator('.bestiary-card[data-key="tier:2"] .bc-name')).toHaveText('???');
});

test('minions spawn silently; one speech bubble at most', async ({ page }) => {
  await seedGame(page);
  await page.evaluate(() => window.doStartGame());
  await page.evaluate(() => { window.state.level = 40; window.state.spawnInterval = 1e9; });
  for (const kind of [6, 7, 8, 5, 1]) await spawnKind(page, kind);
  expect(await page.locator('.monster-say').count()).toBe(0);
  // Boss phase taunts use monsterSay; a second unforced line never stacks.
  await page.evaluate(() => {
    const [a, b] = window.state.monsters;
    window.monsterSay(a, { ko: '아야!', en: 'Ouch!' });
    window.monsterSay(b, { ko: '졌다!', en: 'I lost!' });
  });
  expect(await page.locator('.monster-say').count()).toBe(1);
  // The bubble ignores the pointer, so it never blocks input.
  await expect(page.locator('.monster-say')).toHaveCSS('pointer-events', 'none');
  // It times out on its own (~1.6s).
  await expect(page.locator('.monster-say')).toHaveCount(0, { timeout: 4000 });
});
