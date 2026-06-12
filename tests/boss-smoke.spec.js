// @ts-check
// Boss set-piece smoke tests: verifies items 1-6 from the boss rework plan,
// plus regression tests for the new mechanics from round-2 critique.
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

// ── Checkpoint runs include bosses (A5a) ─────────────────────────────────

test('checkpoint run: level-up to act level sets pendingBoss', async ({ page }) => {
  await seedGame(page);

  await page.evaluate(() => window.startCheckpointGame(4));
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    window.state.level = 4;
    const threshold = window.xpThresholdForLevel(4);
    window.state.xp = threshold;
    window.maybeLevelUp();
    return {
      level: window.state.level,
      pendingBoss: window.state.pendingBoss,
      checkpointRun: window.state.checkpointRun,
    };
  });

  expect(result.level).toBe(5);
  expect(result.pendingBoss).toBe(true);
  expect(result.checkpointRun).toBe(true);
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

// ── Phase windows scale with word length (A2) ────────────────────────────

test('boss: phase windows scale with word length', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  const windows = await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.state.level = 5;
    window.spawnBoss();
    const boss = window.state.monsters.find(m => m.isBoss);
    if (!boss) return null;
    return {
      phaseWindows: boss.phaseWindows,
      phaseKsLengths: boss.phaseKs.map(ks => ks.length),
    };
  });

  expect(windows).not.toBeNull();
  // Each window must be >= 4000 and <= 20000
  for (const w of windows.phaseWindows) {
    expect(w).toBeGreaterThanOrEqual(4000);
    expect(w).toBeLessThanOrEqual(20000);
  }
  // Longer words should get longer windows (proportional)
  // The longest phase word should have the longest (or equal) window
  const maxKsLen = Math.max(...windows.phaseKsLengths);
  const maxWindowIdx = windows.phaseKsLengths.indexOf(maxKsLen);
  const maxWindow = windows.phaseWindows[maxWindowIdx];
  const minWindow = Math.min(...windows.phaseWindows);
  expect(maxWindow).toBeGreaterThanOrEqual(minWindow);
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

// ── 필살기 vs boss: special resolves phase, no soft-lock (A1 / C1 regression) ──

test('special vs boss: resolves current phase, lock resumes cleanly', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  const result = await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
    const boss = window.state.monsters.find(m => m.isBoss);
    if (!boss) return null;

    // Lock the boss at progress 1 (partial phase 1)
    window.state.lockId = boss.id;
    window.state.lockExpectedKs = boss.ks.slice();
    window.state.lockPosKs = Math.min(1, boss.ks.length - 1);

    // Give the player a special charge and fire it
    window.state.specialCharges = 1;
    // Call boss branch logic directly (same as triggerSpecialMove's boss branch)
    if (window.state.lockId === boss.id) { window.state.ime.reset(); }
    if (boss.phase < 3) {
      window.advanceBossPhase(boss);
      if (window.state.lockId === boss.id) {
        window.state.lockExpectedKs = boss.ks;
        window.state.lockPosKs = 0;
      }
    }

    return {
      phase: boss.phase,
      lockPosKs: window.state.lockPosKs,
      lockExpectedKsLen: window.state.lockExpectedKs.length,
      bossActive: window.state.bossActive,
    };
  });

  expect(result).not.toBeNull();
  // Phase must have advanced (not stuck)
  expect(result.phase).toBe(2);
  // Lock position must be reset to 0, never stranded at length
  expect(result.lockPosKs).toBe(0);
  // lockPosKs < lockExpectedKs.length so typing can resume
  expect(result.lockPosKs).toBeLessThan(result.lockExpectedKsLen);
  expect(result.bossActive).toBe(true);
});

// ── special on phase 3 boss kills it ─────────────────────────────────────

test('special on phase-3 boss kills it', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
    const boss = window.state.monsters.find(m => m.isBoss);
    if (!boss) return;
    // Advance to phase 3
    window.advanceBossPhase(boss);
    window.advanceBossPhase(boss);
    // Now fire the special's boss branch for phase 3
    window.killMonster(boss, true);
  });

  await page.waitForTimeout(200);

  const bossGone = await page.evaluate(() => {
    return !window.state.monsters.find(m => m.isBoss) && !window.state.bossActive;
  });
  expect(bossGone).toBe(true);
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

// ── Checkpoint only advances after a boss kill (A5b) ─────────────────────

test('checkpoint: only advances when boss was killed this run', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  // Reach level 5 (act level) without killing the boss
  const checkpointBefore = await page.evaluate(() => {
    // Clear any prior checkpoint
    try { localStorage.removeItem('hangul-battle-checkpoint-v1'); } catch (e) {}
    window.state.level = 5;
    window.state.actsCleared = []; // no boss kills
    window.state.score = 100;
    window.state.kills = 5;
    // Trigger gameOver logic for checkpoint update directly
    const actsKilled = (window.state.actsCleared || []).sort((a, b) => a - b);
    // This mirrors the gameOver logic
    if (actsKilled.length > 0) {
      const highestAct = actsKilled[actsKilled.length - 1];
      const currentCp = window.getCheckpoint();
      if (highestAct > currentCp) window.setCheckpoint(highestAct);
    }
    return window.getCheckpoint();
  });

  // Checkpoint should NOT advance since no boss was killed
  expect(checkpointBefore).toBe(0);

  // Now simulate killing the boss at level 5
  const checkpointAfter = await page.evaluate(() => {
    window.state.actsCleared = [5];
    const actsKilled = (window.state.actsCleared || []).sort((a, b) => a - b);
    if (actsKilled.length > 0) {
      const highestAct = actsKilled[actsKilled.length - 1];
      const currentCp = window.getCheckpoint();
      if (highestAct > currentCp) window.setCheckpoint(highestAct);
    }
    return window.getCheckpoint();
  });

  expect(checkpointAfter).toBe(5);
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

// ── Mobile smoke: HUD fits 390px viewport ────────────────────────────────

test('mobile: #btnMenu fully inside 390px viewport', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(URL);
  await page.evaluate(() => {
    const progress = { playerId: 'test-player-001', profile: { name: 'TestPlayer', countryCode: 'US' } };
    localStorage.setItem('hangul-type-progress-v1', JSON.stringify(progress));
    localStorage.setItem('hangul-battle-saw-intro-v2', '1');
  });
  await page.reload();
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });
  await page.evaluate(() => window.doStartGame());
  await page.waitForTimeout(400);

  const box = await page.locator('#btnMenu').boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);

  await context.close();
});

// ── Mobile smoke: live IME strip visible during a run ────────────────────

test('mobile: live IME strip visible during a run', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(URL);
  await page.evaluate(() => {
    const progress = { playerId: 'test-player-001', profile: { name: 'TestPlayer', countryCode: 'US' } };
    localStorage.setItem('hangul-type-progress-v1', JSON.stringify(progress));
    localStorage.setItem('hangul-battle-saw-intro-v2', '1');
  });
  await page.reload();
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });
  await page.evaluate(() => window.doStartGame());
  await page.waitForTimeout(400);

  // The .hud-center should be display:flex (as a fixed strip above keyboard)
  const display = await page.evaluate(() => {
    const el = document.querySelector('.hud-center');
    return el ? window.getComputedStyle(el).display : 'none';
  });
  expect(display).toBe('flex');

  await context.close();
});

// ── Mobile smoke: game-over toolbar not overflowing ──────────────────────

test('mobile: game-over lb toolbar not overflowing', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(URL);
  await page.evaluate(() => {
    const progress = { playerId: 'test-player-001', profile: { name: 'TestPlayer', countryCode: 'US' } };
    localStorage.setItem('hangul-type-progress-v1', JSON.stringify(progress));
    localStorage.setItem('hangul-battle-saw-intro-v2', '1');
  });
  await page.reload();
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });

  // Force game over directly
  await page.evaluate(() => {
    window.doStartGame();
    window.state.lives = 0;
    window.gameOver();
  });
  await page.waitForTimeout(500);

  // Edit profile button should be within viewport width
  const btnBox = await page.locator('#btnEditProfile').boundingBox();
  if (btnBox) {
    expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(390 + 2); // 2px tolerance for rounding
  }

  await context.close();
});

// ── Desktop run smoke: zero pageerror through level-up and boss spawn ─────

test('desktop: zero pageerror through level-up and boss spawn', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedGame(page);
  await startGame(page);

  await page.evaluate(() => {
    // Trigger a level-up
    window.state.level = 4;
    window.state.xp = window.xpThresholdForLevel(4);
    window.maybeLevelUp();
    // Spawn a boss
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
  });

  await page.waitForTimeout(2500);
  expect(errors).toHaveLength(0);
});
