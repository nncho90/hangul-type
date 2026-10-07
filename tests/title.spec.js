// @ts-check
// Title screen overlay on index.html.
const { test, expect } = require('./fixtures');

test.beforeEach(async ({ page }) => {
  // Skip the first-run coachmark so it can't interfere with key checks.
  await page.addInitScript(() => {
    try { localStorage.setItem('hangul-type-seen-intro-v1', '1'); } catch (e) {}
  });
});

async function gotoIndex(page, hash = '') {
  await page.goto('/index.html' + hash);
  await page.waitForFunction(() => typeof state !== 'undefined' && state.expectedKs.length > 0);
}

test('title shows on load with START GAME focused', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await gotoIndex(page);
  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.locator('#titleScreen')).toHaveAttribute('role', 'dialog');
  expect(await page.evaluate(() => document.activeElement.dataset.choice)).toBe('game');
  expect(errors).toEqual([]);
});

test('keys do not type into practice while the title is open', async ({ page }) => {
  await gotoIndex(page);
  const before = await page.evaluate(() => ({ pos: state.posKs, total: state.totalKeys }));
  await page.keyboard.press('d');
  await page.keyboard.press('k');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => ({ pos: state.posKs, total: state.totalKeys }))).toEqual(before);
  await expect(page.locator('#titleScreen')).toBeVisible();
});

test('ArrowDown + Enter on PRACTICE reveals practice and typing works', async ({ page }) => {
  await gotoIndex(page);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.ts-item.is-active')).toHaveAttribute('data-choice', 'practice');
  await page.keyboard.press('Enter');
  await expect(page.locator('#titleScreen')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement.id)).toBe('shield');
  await page.evaluate(() => { state.activeWords = [{ ko: '집', en: 'home' }]; loadWord(0); });
  await page.keyboard.press('w');
  await page.keyboard.press('l');
  await page.keyboard.press('q');
  expect(await page.evaluate(() => ({ done: state.wordsDone, total: state.totalKeys, hits: state.hitKeys })))
    .toEqual({ done: 1, total: 3, hits: 3 });
});

test('W/S also move the cursor', async ({ page }) => {
  await gotoIndex(page);
  await page.keyboard.press('s');
  await expect(page.locator('.ts-item.is-active')).toHaveAttribute('data-choice', 'practice');
  await page.keyboard.press('w');
  await expect(page.locator('.ts-item.is-active')).toHaveAttribute('data-choice', 'game');
});

test('START GAME navigates to game.html', async ({ page }) => {
  await gotoIndex(page);
  await Promise.all([
    page.waitForURL(/game\.html/),
    page.keyboard.press('Enter'),
  ]);
  expect(page.url()).toMatch(/game\.html$/);
});

test('#practice skips the title', async ({ page }) => {
  await gotoIndex(page, '#practice');
  await expect(page.locator('#titleScreen')).toBeHidden();
});

test('Menu button reopens the title', async ({ page }) => {
  await gotoIndex(page, '#practice');
  await page.click('#btnTitle');
  await expect(page.locator('#titleScreen')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement.dataset.choice)).toBe('game');
  await page.click('.ts-item[data-choice="practice"]');
  await expect(page.locator('#titleScreen')).toBeHidden();
});

test('first-run coachmark waits for PRACTICE', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.removeItem('hangul-type-seen-intro-v1'); } catch (e) {} });
  await gotoIndex(page);
  await expect(page.locator('.coachmark-overlay')).toHaveCount(0);
  await page.click('.ts-item[data-choice="practice"]');
  await expect(page.locator('.coachmark-overlay')).toBeVisible();
});
