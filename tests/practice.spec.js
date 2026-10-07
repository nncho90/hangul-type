// @ts-check
// Practice page (index.html) keyboard behavior.
const { test, expect } = require('./fixtures');

test.beforeEach(async ({ page }) => {
  // Skip the first-run welcome card so keys go straight to the drill.
  await page.addInitScript(() => {
    try { localStorage.setItem('hangul-type-seen-intro-v1', '1'); } catch (e) {}
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => typeof state !== 'undefined' && state.expectedKs.length > 0);
});

// Load a specific word so the key sequence is known.
async function loadTestWord(page, ko, en) {
  await page.evaluate(([ko, en]) => {
    state.activeWords = [{ ko, en }, { ko: '안녕', en: 'hello' }];
    loadWord(0);
    document.getElementById('shield').focus();
  }, [ko, en]);
}

async function typeKeys(page, keys) {
  for (const k of keys) await page.keyboard.press(k);
}

test('no console errors on load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.reload();
  await page.waitForFunction(() => typeof state !== 'undefined' && state.expectedKs.length > 0);
  await page.waitForTimeout(300);
  expect(errors.filter(e => !/net::|Failed to load resource/.test(e))).toEqual([]);
});

test('backspace across a syllable, then finishing the word, counts as correct', async ({ page }) => {
  await loadTestWord(page, '학교', 'school');
  // ㅎ ㅏ ㄱ ㄱ: the second ㄱ commits 학 and starts the next syllable
  await typeKeys(page, ['g', 'k', 'r', 'r']);
  expect(await page.evaluate(() => state.ime.display)).toBe('학ㄱ');
  await typeKeys(page, ['Backspace', 'Backspace', 'Backspace']);
  expect(await page.evaluate(() => ({ pos: state.posKs, shown: state.ime.display })))
    .toEqual({ pos: 1, shown: 'ㅎ' });
  await typeKeys(page, ['k', 'r', 'r', 'y']);
  const r = await page.evaluate(() => ({ done: state.wordsDone, shown: state.ime.display, total: state.totalKeys, hits: state.hitKeys }));
  expect(r.done).toBe(1);
  expect(r.shown).toBe('학교');
  expect(r.total).toBe(r.hits); // no misses recorded
});

test('backspace across 안녕 then finishing counts as correct', async ({ page }) => {
  await loadTestWord(page, '안녕', 'hello');
  // ㅇ ㅏ ㄴ ㄴ ㅕ: the second ㄴ commits 안, then three backspaces reopen it as 아
  await typeKeys(page, ['d', 'k', 's', 's', 'u']);
  await typeKeys(page, ['Backspace', 'Backspace', 'Backspace']);
  expect(await page.evaluate(() => state.ime.display)).toBe('아');
  await typeKeys(page, ['s', 's', 'u', 'd']);
  expect(await page.evaluate(() => ({ done: state.wordsDone, shown: state.ime.display })))
    .toEqual({ done: 1, shown: '안녕' });
});

test('Space right after completing a word is not a miss', async ({ page }) => {
  await loadTestWord(page, '집', 'home');
  await typeKeys(page, ['w', 'l', 'q']);
  await page.keyboard.press('Space');
  await page.keyboard.press('x'); // a stray letter during the advance delay
  const r = await page.evaluate(() => ({ done: state.wordsDone, total: state.totalKeys, hits: state.hitKeys, combo: state.combo }));
  expect(r.done).toBe(1);
  expect(r.total).toBe(r.hits);
  expect(r.combo).toBe(3);
  // The next word still loads on schedule
  await page.waitForFunction(() => state.posKs === 0 && !state.advancing);
});

test('a held key types once', async ({ page }) => {
  await loadTestWord(page, '집', 'home');
  await page.keyboard.down('w');
  await page.evaluate(() => {
    // Simulate auto-repeat events while the key is held
    for (let i = 0; i < 3; i++) {
      document.getElementById('shield').dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', repeat: true, bubbles: true, cancelable: true }));
    }
  });
  await page.keyboard.up('w');
  expect(await page.evaluate(() => ({ pos: state.posKs, total: state.totalKeys }))).toEqual({ pos: 1, total: 1 });
});

test('Tab moves focus normally', async ({ page }) => {
  await page.evaluate(() => document.getElementById('shield').focus());
  const prevented = page.evaluate(() => new Promise(resolve => {
    document.addEventListener('keydown', e => { if (e.key === 'Tab') setTimeout(() => resolve(e.defaultPrevented), 0); }, { once: true });
  }));
  await page.keyboard.press('Tab');
  expect(await prevented).toBe(false);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  expect(focused).not.toBe('shield');
  expect(focused).toBe('profileChip');
  // Space on a control reached by Tab activates it instead of typing
  const before = await page.evaluate(() => state.totalKeys);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => state.totalKeys)).toBe(before);
});

test('reset keeps Battle fields in the shared progress key', async ({ page }) => {
  await page.evaluate(() => {
    progress.xp = 1234;
    progress.profile = { name: 'Tester', countryCode: 'KR', fandom: 'army' };
    progress.battleOnlyField = 'keep me';
    pushDoneWord(progress.topicCompleted, 'food', '김치');
    saveProgress(progress);
    flushSaves();
  });
  const oldId = await page.evaluate(() => progress.playerId);
  page.once('dialog', d => d.accept());
  await page.evaluate(() => document.getElementById('btnReset').click());
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hangul-type-progress-v1')));
  expect(saved.xp).toBe(1234);
  expect(saved.profile.fandom).toBe('army');
  expect(saved.battleOnlyField).toBe('keep me');
  expect(saved.topicCompleted).toEqual({});
  expect(saved.playerId).toBe(oldId); // leaderboard identity survives a reset
});

test('jamo drill runs through its words and does not credit topics', async ({ page }) => {
  await page.evaluate(() => {
    stats.perJamo['ㅎ'] = { tries: 10, hits: 5 };
    startJamoDrill('ㅎ');
  });
  const n = await page.evaluate(() => state.activeWords.length);
  expect(n).toBeGreaterThan(1);
  expect(await page.evaluate(() => state.activeTopic)).toBe('drill:ㅎ');
  const before = await page.evaluate(() => JSON.stringify(progress.topicCompleted) + JSON.stringify(progress.lessonsCompleted));
  // Finish two drill words by feeding their expected jamo
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => { for (const j of state.expectedKs.slice()) j === ' ' ? handleKeystroke(' ', false) : handleKoreanJamoInput(j); });
    await page.waitForFunction(() => !state.advancing);
  }
  expect(await page.evaluate(() => state.activeTopic)).toBe('drill:ㅎ');
  expect(await page.evaluate(() => state.wordsDone)).toBe(2);
  const after = await page.evaluate(() => JSON.stringify(progress.topicCompleted) + JSON.stringify(progress.lessonsCompleted));
  expect(after).toBe(before);
});

test('after Enter on a tabbed-to card, Space types again', async ({ page }) => {
  await page.evaluate(() => document.getElementById('shield').focus());
  // Tab forward until a topic card has keyboard focus
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement.classList.contains('cr-card'))) break;
  }
  expect(await page.evaluate(() => document.activeElement.classList.contains('cr-card'))).toBe(true);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('shield');
  // Load a two-word phrase without touching focus, then type it with a space
  await page.evaluate(() => { state.activeWords = [{ ko: '내일 만나요', en: 'see you tomorrow' }]; loadWord(0); });
  await typeKeys(page, ['s', 'o', 'd', 'l', 'f', 'Space', 'a', 'k', 's', 's', 'k', 'd', 'y']);
  const r = await page.evaluate(() => ({ done: state.wordsDone, total: state.totalKeys, hits: state.hitKeys }));
  expect(r.done).toBe(1);
  expect(r.total).toBe(r.hits);
});

test('deleting a whole OS IME composition undoes its jamo', async ({ page }) => {
  await loadTestWord(page, '학교', 'school');
  await page.evaluate(() => {
    const shield = document.getElementById('shield');
    const fire = (v, composing) => { shield.value = v; shield.dispatchEvent(new InputEvent('input', { isComposing: composing, bubbles: true })); };
    shield.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    fire('ㅎ', true);
    fire('하', true);
  });
  expect(await page.evaluate(() => state.posKs)).toBe(2);
  await page.evaluate(() => {
    const shield = document.getElementById('shield');
    shield.value = '';
    shield.dispatchEvent(new InputEvent('input', { isComposing: true, bubbles: true }));
  });
  expect(await page.evaluate(() => ({ pos: state.posKs, shown: state.ime.display }))).toEqual({ pos: 0, shown: '' });
});
