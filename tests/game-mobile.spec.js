// @ts-check
// Mobile layout checks for game.html: touch pause/resume, tablet touch
// layout, HUD vs stage overlap, and the compact landscape HUD.
const { test, expect } = require('./fixtures');

const URL = '/game.html';

async function startBattle(page) {
  await page.goto(URL);
  await page.evaluate(() => localStorage.setItem('hangul-battle-saw-intro-v2', '1'));
  await page.reload();
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });
  await page.evaluate(() => {
    document.getElementById('introModal').style.display = 'none';
    window.doStartGame();
  });
  await page.waitForFunction(() => window.state && window.state.running, { timeout: 4000 });
  await page.waitForTimeout(300);
}

const rect = (page, sel) => page.evaluate((s) => {
  const b = document.querySelector(s).getBoundingClientRect();
  return { top: b.top, bottom: b.bottom, height: b.height, width: b.width };
}, sel);

test.describe('phone portrait 393x852', () => {
  test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });

  test('pause overlay Resume button resumes on touch', async ({ page }) => {
    await startBattle(page);
    await page.locator('#btnMenu').tap();
    await expect(page.locator('#pauseOverlay')).toBeVisible();
    await expect(page.locator('#pauseHint')).toHaveText(/tap/i);
    const resume = page.locator('#btnResume');
    await expect(resume).toBeVisible();
    const box = await resume.boundingBox();
    expect(box && box.height).toBeGreaterThanOrEqual(48);
    await resume.tap();
    await expect(page.locator('#pauseOverlay')).toBeHidden();
    expect(await page.evaluate(() => window.state.paused)).toBe(false);
  });

  test('HUD bottom does not overlap the stage', async ({ page }) => {
    await startBattle(page);
    const hud = await rect(page, '.hud');
    const stage = await rect(page, '#stage');
    expect(hud.bottom).toBeLessThanOrEqual(stage.top + 0.5);
  });
});

test.describe('iPad 820x1180', () => {
  test.use({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });

  test('touch tablet gets the on-screen keyboard and no shield focus', async ({ page }) => {
    await startBattle(page);
    await expect(page.locator('#battleKb')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe('shield');
    // A hardware keyboard still types through the document keydown handler.
    await page.evaluate(() => { window.state.spawnPauseMs = 0; window.spawnMonster(); });
    const before = await page.evaluate(() => window.state.lockId);
    expect(before).toBeNull();
    const firstKey = await page.evaluate(() => window.state.monsters[0].ks[0]);
    const code = await page.evaluate((jamo) => {
      const k = Object.keys(KEYMAP).find(c => KEYMAP[c] === jamo);
      return k ? { code: 'Key' + k.toUpperCase(), shift: k !== k.toLowerCase() } : null;
    }, firstKey);
    expect(code).not.toBeNull();
    if (code.shift) await page.keyboard.down('Shift');
    await page.keyboard.press(code.code);
    if (code.shift) await page.keyboard.up('Shift');
    expect(await page.evaluate(() => window.state.lockId)).not.toBeNull();
  });
});

test.describe('phone landscape 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('no horizontal overflow and compact HUD', async ({ page }) => {
    await startBattle(page);
    const { sw, cw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
    }));
    expect(sw).toBeLessThanOrEqual(cw);
    const hud = await rect(page, '.hud');
    expect(hud.height).toBeLessThanOrEqual(44);
    const stage = await rect(page, '#stage');
    expect(hud.bottom).toBeLessThanOrEqual(stage.top + 0.5);
  });
});
