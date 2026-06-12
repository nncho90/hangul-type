// @ts-check
// Boss set-piece smoke tests — verifies items 1-6 from the boss rework plan.
const { test, expect } = require('@playwright/test');

const URL = '/game.html';

// Load the page with seeded profile so startGame flows without profile/intro gates.
async function seedGame(page) {
  await page.goto(URL);
  await page.evaluate(() => {
    const progress = {
      playerId: 'test-player-001',
      profile: { name: 'TestPlayer', countryCode: 'US' }
    };
    localStorage.setItem('hangul-type-progress-v1', JSON.stringify(progress));
    localStorage.setItem('hangul-battle-saw-intro-v2', '1');
  });
  await page.reload();
  // Wait for scripts to load and state to be defined
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });
}

// Start the game directly (bypass intro/profile gates, which are UI-only).
async function startGame(page) {
  await page.evaluate(() => window.doStartGame());
  // Give rAF a chance to fire at least one frame
  await page.waitForTimeout(300);
}

// ── Boot smoke ────────────────────────────────────────────────────────────

test('boot: zero page errors after 4s', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedGame(page);
  await startGame(page);
  await page.waitForTimeout(4000);
  expect(errors).toHaveLength(0);
});

// ── Item 1: pendingBoss set on level-up to an act level ──────────────────

test('pendingBoss: true after level-up to level 5', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  const result = await page.evaluate(() => {
    // Level 5 is an act level — pendingBoss must be set by onLevelUp
    window.state.level = 4;
    const threshold = window.xpThresholdForLevel(4);
    window.state.xp = threshold;
    window.maybeLevelUp();
    return {
      level: window.state.level,
      pendingBoss: window.state.pendingBoss,
    };
  });

  expect(result.level).toBe(5);
  expect(result.pendingBoss).toBe(true);
});

// ── Item 1: checkpoint game does NOT set pendingBoss ─────────────────────

test('checkpoint: starting at level 5 does NOT spawn instant boss', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  const result = await page.evaluate(() => {
    window.startCheckpointGame(5);
    return {
      level: window.state.level,
      pendingBoss: window.state.pendingBoss,
      bossActive: window.state.bossActive,
    };
  });

  expect(result.level).toBe(5);
  expect(result.pendingBoss).toBe(false);
  expect(result.bossActive).toBe(false);

  // Wait 5s and assert still no boss
  await page.waitForTimeout(5000);
  const bossAfter = await page.evaluate(() => window.state.bossActive);
  expect(bossAfter).toBe(false);
});

// ── Item 2: boss has 3 phases, phase advances on word completion ──────────

test('boss: spawns with phase 1, advances to phase 2 on word completion', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  const phase1 = await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
    const boss = window.state.monsters.find(m => m.isBoss);
    if (!boss) return null;
    return {
      phase: boss.phase,
      phaseCount: Array.isArray(boss.phaseWords) ? boss.phaseWords.length : 0,
      ksLen: boss.ks.length
    };
  });

  expect(phase1).not.toBeNull();
  expect(phase1.phase).toBe(1);
  expect(phase1.phaseCount).toBe(3);

  // Complete phase 1 and verify phase advances to 2
  const phase2 = await page.evaluate(() => {
    const boss = window.state.monsters.find(m => m.isBoss);
    if (!boss) return null;
    window.state.lockId = boss.id;
    window.state.lockExpectedKs = [...boss.ks];
    window.state.lockPosKs = boss.ks.length; // simulate all keystrokes done
    // Trigger phase advance directly (same branch as advanceLock)
    if (boss.isBoss && boss.phase < 3) {
      window.state.ime.reset();
      window.advanceBossPhase(boss);
    }
    return { phase: boss.phase, bossActive: window.state.bossActive };
  });

  expect(phase2).not.toBeNull();
  expect(phase2.phase).toBe(2);
  expect(phase2.bossActive).toBe(true);
});

// ── Item 3: phase deadline expiry decrements lives ───────────────────────

test('boss: phase deadline expiry damages player', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  const livesBefore = await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
    const boss = window.state.monsters.find(m => m.isBoss);
    if (!boss) return null;
    // Force the deadline to the past so the next loop tick fires it
    boss.phaseDeadline = performance.now() - 100;
    boss.phaseHit = false;
    return window.state.lives;
  });

  expect(livesBefore).toBeGreaterThan(0);

  // Wait for loop tick + damagePlayer 300ms delay + buffer
  await page.waitForTimeout(1000);

  const livesAfter = await page.evaluate(() => window.state.lives);
  expect(livesAfter).toBe(livesBefore - 1);
});

// ── Item 5: boss reward modal appears and choice 1 resumes game ──────────

test('boss reward: modal appears on boss kill, choice 1 resumes', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  // Spawn boss, skip to phase 3, then kill it
  await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
    const boss = window.state.monsters.find(m => m.isBoss);
    if (!boss) return;
    boss.phase = 3; // skip to final phase so kill goes straight through
    window.killMonster(boss, true);
  });

  // Modal appears after 400ms delay
  await page.waitForTimeout(700);

  const modalVisible = await page.evaluate(() => !!document.getElementById('bossRewardModal'));
  expect(modalVisible).toBe(true);

  const paused = await page.evaluate(() => window.state.paused);
  expect(paused).toBe(true);

  // Choose reward 1
  await page.keyboard.press('1');
  await page.waitForTimeout(200);

  const [gone, resumed] = await page.evaluate(() => [
    !document.getElementById('bossRewardModal'),
    !window.state.paused
  ]);
  expect(gone).toBe(true);
  expect(resumed).toBe(true);
});

// ── Daily regression: timer present, zero errors ─────────────────────────

test('daily run: 90s timer present, zero errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedGame(page);

  await page.evaluate(() => window.startDailyGame());
  await page.waitForTimeout(800);

  const timerVisible = await page.evaluate(() => {
    const el = document.getElementById('hudDailyTimer');
    return el && el.style.display !== 'none';
  });
  expect(timerVisible).toBe(true);
  expect(errors).toHaveLength(0);
});
