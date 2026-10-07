// @ts-check
// Regression tests for the game.html gameplay bug pass: double game over,
// boss HP refills, pause-aware boss timer, heart leaks, daily-run death,
// run-state leaks, and 필살기 on an empty field.
const { test, expect } = require('./fixtures');

const URL = '/game.html';

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
  await page.waitForFunction(() => typeof window.doStartGame === 'function', { timeout: 8000 });
}

async function startGame(page) {
  await page.evaluate(() => window.doStartGame());
  await page.waitForTimeout(300);
}

// Spawn a boss and wait for its intro cutscene to finish (handleKey and the
// pause toggle both stand aside while the cutscene overlay is up).
async function spawnBossAndWait(page) {
  await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
  });
  await page.waitForFunction(() => !document.querySelector('.boss-cutscene'), { timeout: 4000 });
}

test('game over fires once when two monsters cross the line at 1 life', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedGame(page);
  await startGame(page);

  await page.evaluate(() => {
    window.__gameOvers = 0;
    const orig = window.logBattleAttempt;
    // logBattleAttempt runs once per real game over (after the re-entry guard)
    window.logBattleAttempt = (...a) => { window.__gameOvers++; return orig(...a); };
    window.state.spawnPauseMs = 1e9;
    let guard = 0;
    while (window.state.monsters.filter(m => !m.isHeart).length < 2 && guard++ < 50) window.spawnMonster();
    window.state.monsters = window.state.monsters.filter(m => !m.isHeart).slice(0, 2);
    window.state.lives = 1;
    window.state.activePowerups = { shield: 0, slowmo: 0, xp: 0 };
    for (const m of window.state.monsters) m.y = 100000;
  });
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => ({
    gameOvers: window.__gameOvers,
    lives: window.state.lives,
    running: window.state.running,
    modal: document.getElementById('gameOverModal').style.display,
  }));
  expect(result.gameOvers).toBe(1);
  expect(result.lives).toBe(0);
  expect(result.running).toBe(false);
  expect(result.modal).toBe('flex');
  expect(errors).toHaveLength(0);
});

test('boss HP never increases across phase transitions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await seedGame(page);
  await startGame(page);
  await spawnBossAndWait(page);

  const hps = await page.evaluate(() => {
    const boss = window.state.monsters.find(m => m.isBoss);
    if (!boss) return null;
    boss.phaseRemainingMs = 1e9;   // keep the boss from attacking mid-test
    const keyFor = (jamo) => {
      // KEYMAP maps QWERTY -> jamo; shifted jamo live under the uppercase key.
      for (const [k, j] of Object.entries(KEYMAP)) {
        if (j === jamo && k === k.toLowerCase()) return { key: k, shift: false };
      }
      for (const [k, j] of Object.entries(KEYMAP)) {
        if (j === jamo) return { key: k, shift: true };
      }
      return null;
    };
    const seq = [boss.hp];
    let safety = 0;
    while (window.state.monsters.includes(boss) && safety++ < 300) {
      const pos = boss.id === window.state.lockId ? window.state.lockPosKs : (boss.lockProgressKs || 0);
      const jamo = boss.ks[pos];
      if (jamo === ' ') window.handleKey(' ', false);
      else {
        const k = keyFor(jamo);
        if (!k) return { error: 'no key for ' + jamo };
        window.handleKey(k.key, k.shift);
      }
      seq.push(boss.hp);
    }
    return { seq, killed: !window.state.monsters.includes(boss), phase: boss.phase };
  });

  expect(hps).not.toBeNull();
  expect(hps.error).toBeUndefined();
  expect(hps.killed).toBe(true);
  expect(hps.phase).toBe(3);
  for (let i = 1; i < hps.seq.length; i++) {
    expect(hps.seq[i]).toBeLessThanOrEqual(hps.seq[i - 1]);
  }
  expect(hps.seq[hps.seq.length - 1]).toBe(0);
  expect(errors).toHaveLength(0);
});

test('pausing longer than the boss phase timer does not cost a life on resume', async ({ page }) => {
  await seedGame(page);
  await startGame(page);
  await spawnBossAndWait(page);

  const livesBefore = await page.evaluate(() => {
    const boss = window.state.monsters.find(m => m.isBoss);
    boss.phaseRemainingMs = 2000;
    boss.phaseHit = false;
    window.togglePause();
    return window.state.lives;
  });
  expect(await page.evaluate(() => window.state.paused)).toBe(true);

  // Stay paused well past the 2s phase window
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.togglePause());
  expect(await page.evaluate(() => window.state.paused)).toBe(false);
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => {
    const boss = window.state.monsters.find(m => m.isBoss);
    return { lives: window.state.lives, remaining: boss ? boss.phaseRemainingMs : null };
  });
  expect(after.lives).toBe(livesBefore);
  // Timer only advanced by the ~500ms of unpaused time
  expect(after.remaining).toBeGreaterThan(1000);
});

test('auto-pause on tab hide freezes the boss timer', async ({ page }) => {
  await seedGame(page);
  await startGame(page);
  await spawnBossAndWait(page);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = await page.evaluate(() => ({
    paused: window.state.paused,
    overlay: document.getElementById('pauseOverlay').style.display,
  }));
  expect(paused.paused).toBe(true);
  expect(paused.overlay).toBe('flex');
});

test('heart pickup reaching the bottom does not cost a life', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  const before = await page.evaluate(() => {
    window.state.spawnPauseMs = 1e9;
    window.state.monsters.forEach(m => m.el && m.el.remove());
    window.state.monsters = [];
    window.state.lives = 2;
    window.state.spawnsSinceHeart = 10000;  // pity chance > 1: always spawns
    const ok = window.maybeSpawnHeart();
    const heart = window.state.monsters.find(m => m.isHeart);
    if (heart) heart.y = 100000;
    return { ok, lives: window.state.lives, leaks: window.state.levelLeaks || 0 };
  });
  expect(before.ok).toBe(true);

  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    lives: window.state.lives,
    hearts: window.state.monsters.filter(m => m.isHeart).length,
    leaks: window.state.levelLeaks || 0,
  }));
  expect(after.hearts).toBe(0);
  expect(after.lives).toBe(before.lives);
  expect(after.leaks).toBe(before.leaks);
});

test('daily run death goes through the daily end screen', async ({ page }) => {
  await seedGame(page);
  await page.evaluate(() => window.startDailyGame());
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    window.state.lives = 1;
    window.state.activePowerups = { shield: 0, slowmo: 0, xp: 0 };
    window.damagePlayer();
  });
  await page.waitForFunction(() => document.getElementById('gameOverModal').style.display === 'flex', { timeout: 8000 });

  const res = await page.evaluate(() => {
    const panel = document.getElementById('overDailyResult');
    return {
      running: window.state.running,
      dailyPanel: panel ? panel.style.display : 'missing',
      timerHud: document.getElementById('hudDailyTimer').style.display,
    };
  });
  expect(res.running).toBe(false);
  expect(res.dailyPanel).toBe('');
  expect(res.timerHud).toBe('none');

  // A following story run must not show the stale daily panel
  await page.evaluate(() => { window.doStartGame(); window.state.lives = 0; window.gameOver(); });
  const panelAfter = await page.evaluate(() => document.getElementById('overDailyResult').style.display);
  expect(panelAfter).toBe('none');
});

test('boss state does not leak into the next run', async ({ page }) => {
  await seedGame(page);
  await startGame(page);

  await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
    // Die mid-cutscene
    window.state.lives = 0;
    window.gameOver();
    window.doStartGame();
  });
  const res = await page.evaluate(() => ({
    bossAlive: document.body.classList.contains('boss-alive'),
    cutscene: !!document.querySelector('.boss-cutscene'),
    bossActive: window.state.bossActive,
    monsters: window.state.monsters.filter(m => m.isBoss).length,
  }));
  expect(res.bossAlive).toBe(false);
  expect(res.cutscene).toBe(false);
  expect(res.bossActive).toBe(false);
  expect(res.monsters).toBe(0);
});

test('pending boss spawn is cancelled by game over', async ({ page }) => {
  await seedGame(page);
  await startGame(page);
  await page.evaluate(() => {
    window.triggerBossFight();
    window.state.lives = 0;
    window.gameOver();
  });
  await page.waitForTimeout(1000);
  const res = await page.evaluate(() => ({
    bossActive: window.state.bossActive,
    bossAlive: document.body.classList.contains('boss-alive'),
    cutscene: !!document.querySelector('.boss-cutscene'),
  }));
  expect(res.bossActive).toBe(false);
  expect(res.bossAlive).toBe(false);
  expect(res.cutscene).toBe(false);
});

test('필살기 on an empty field keeps the charge', async ({ page }) => {
  await seedGame(page);
  await startGame(page);
  const res = await page.evaluate(async () => {
    window.state.spawnPauseMs = 1e9;
    window.state.monsters.forEach(m => m.el && m.el.remove());
    window.state.monsters = [];
    window.state.specialCharges = 1;
    await window.triggerSpecialMove();
    return { charges: window.state.specialCharges, active: window.state.specialMoveActive };
  });
  expect(res.charges).toBe(1);
  expect(res.active).toBeFalsy();
});

test('Esc while paused resumes even with a lock held', async ({ page }) => {
  await seedGame(page);
  await startGame(page);
  await page.evaluate(() => {
    let guard = 0;
    while (window.state.monsters.length === 0 && guard++ < 20) window.spawnMonster();
    const m = window.state.monsters[0];
    window.state.lockId = m.id;
    window.state.lockExpectedKs = m.ks.slice();
    window.state.lockPosKs = 0;
    window.togglePause();
  });
  expect(await page.evaluate(() => window.state.paused)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.state.paused)).toBe(false);
});

test('WAVE CLEAR bonus fires when the last monster dies on a level-up', async ({ page }) => {
  await seedGame(page);
  await startGame(page);
  const res = await page.evaluate(() => {
    window.state.spawnPauseMs = 1e9;
    window.state.monsters.forEach(m => m.el && m.el.remove());
    window.state.monsters = [];
    let guard = 0;
    while (window.state.monsters.length === 0 && guard++ < 20) window.spawnMonster();
    window.state.monsters = window.state.monsters.slice(0, 1);
    const m = window.state.monsters[0];
    window.state.xp = window.xpThresholdForLevel(window.state.level) - 1;
    const scoreBefore = window.state.score;
    const levelBefore = window.state.level;
    window.killMonster(m, true);
    return { leveled: window.state.level > levelBefore, gained: window.state.score - scoreBefore, level: window.state.level };
  });
  expect(res.leveled).toBe(true);
  // Kill score + wave-clear bonus (250 + level * 25)
  expect(res.gained).toBeGreaterThanOrEqual(250 + res.level * 25);
});

test('tab hidden during the boss cutscene pauses once the cutscene ends', async ({ page }) => {
  await seedGame(page);
  await startGame(page);
  await page.evaluate(() => {
    window.state.bossActive = false;
    window.state.pendingBoss = false;
    window.spawnBoss();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // Cutscene owns the screen: no pause menu yet.
  expect(await page.evaluate(() => window.state.paused)).toBe(false);
  await page.waitForFunction(() => !document.querySelector('.boss-cutscene'), { timeout: 4000 });
  const res = await page.evaluate(() => ({
    paused: window.state.paused,
    overlay: document.getElementById('pauseOverlay').style.display,
  }));
  expect(res.paused).toBe(true);
  expect(res.overlay).toBe('flex');
});

test('daily run end shows the modal before the network settles', async ({ page }) => {
  await seedGame(page);
  // Hold every Supabase call open so only an eager modal can pass.
  await page.route(/supabase\.co/, () => {});
  await page.evaluate(() => window.startDailyGame());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.state.lives = 1;
    window.state.activePowerups = { shield: 0, slowmo: 0, xp: 0 };
    window.damagePlayer();
  });
  await page.waitForFunction(() => document.getElementById('gameOverModal').style.display === 'flex', { timeout: 2000 });
  const lb = await page.evaluate(() => document.getElementById('overDailyLb').textContent);
  expect(lb).toContain('Loading');
});
