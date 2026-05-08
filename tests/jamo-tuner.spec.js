// @ts-check
const { test, expect } = require('@playwright/test');

const URL = '/jamo-tuner.html';

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.removeItem('jamo-tuner-v2');
    localStorage.removeItem('jamo-tuner-guide-v1');
  });
  await page.goto(URL);
  await page.waitForSelector('#glyphCanvas');
  await page.waitForTimeout(300);
});

// ── Page load ──────────────────────────────────────────────────────────────

test('page loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(URL);
  await page.waitForTimeout(500);
  expect(errors).toHaveLength(0);
});

test('title is "Jamo Tuner"', async ({ page }) => {
  await expect(page).toHaveTitle('Jamo Tuner');
});

test('sample list renders all 30 syllable buttons', async ({ page }) => {
  const btns = await page.locator('.sample-btn').count();
  expect(btns).toBe(30);
});

test('initial sample label shows 화', async ({ page }) => {
  const label = await page.locator('#sampleLabel').textContent();
  expect(label).toContain('화');
});

test('layout label shows compound for 화', async ({ page }) => {
  const label = await page.locator('#layoutLabel').textContent();
  expect(label).toBe('compound');
});

// ── Navigation ─────────────────────────────────────────────────────────────

test('Next button advances to next sample', async ({ page }) => {
  await page.click('#nextBtn');
  await page.waitForTimeout(200);
  const label = await page.locator('#sampleLabel').textContent();
  expect(label).toContain('원');
});

test('Prev button wraps around from first sample to last', async ({ page }) => {
  await page.click('#prevBtn');
  await page.waitForTimeout(200);
  const label = await page.locator('#sampleLabel').textContent();
  expect(label).not.toContain('화');
});

test('arrow keys navigate samples', async ({ page }) => {
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const label = await page.locator('#sampleLabel').textContent();
  expect(label).toContain('원');

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);
  const label2 = await page.locator('#sampleLabel').textContent();
  expect(label2).toContain('화');
});

test('clicking a sample button in the sidebar navigates to it', async ({ page }) => {
  await page.locator('.sample-btn').nth(1).click();
  await page.waitForTimeout(200);
  const label = await page.locator('#sampleLabel').textContent();
  expect(label).toContain('원');
});

// ── Canvas ─────────────────────────────────────────────────────────────────

test('glyphCanvas has non-zero dimensions', async ({ page }) => {
  const dims = await page.evaluate(() => {
    const c = document.getElementById('glyphCanvas');
    return { w: c.width, h: c.height };
  });
  expect(dims.w).toBeGreaterThan(0);
  expect(dims.h).toBeGreaterThan(0);
});

test('canvas renders a visible glyph (ink pixels present)', async ({ page }) => {
  await page.waitForTimeout(500);
  const hasInk = await page.evaluate(() => {
    const c = document.getElementById('glyphCanvas');
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 128) return true;
    }
    return false;
  });
  expect(hasInk).toBe(true);
});

// ── Walkthrough (guide) controls ───────────────────────────────────────────

test('Start button activates walkthrough mode', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);
  const status = await page.locator('#guideStatus').textContent();
  expect(status).toContain('Step 1');
});

test('Start → draw box → Done advances to Step 2', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);

  const frame = await page.locator('#frame').boundingBox();
  const cx = frame.x + frame.width * 0.3;
  const cy = frame.y + frame.height * 0.3;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 80);
  await page.mouse.up();
  await page.waitForTimeout(200);

  const guideList = await page.locator('#guideList').textContent();
  expect(guideList).toBeTruthy();

  await page.click('#guideDoneBtn');
  await page.waitForTimeout(200);
  const status = await page.locator('#guideStatus').textContent();
  expect(status).toContain('Step 2');
});

test('Undo removes last op', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);

  const frame = await page.locator('#frame').boundingBox();
  const cx = frame.x + frame.width * 0.3;
  const cy = frame.y + frame.height * 0.3;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 80);
  await page.mouse.up();
  await page.waitForTimeout(200);

  await page.click('#guideUndoBtn');
  await page.waitForTimeout(200);
  const status = await page.locator('#guideStatus').textContent();
  expect(status).toContain('Step 1');
  const guideList = await page.locator('#guideList .guide-step.active').textContent();
  expect(guideList).toContain('0 ops');
});

test('Clear resets guide to initial state', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);
  await page.click('#guideClearBtn');
  await page.waitForTimeout(200);
  const status = await page.locator('#guideStatus').textContent();
  expect(status).toContain('Ready');
});

test('Save persists guide to localStorage', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);

  const frame = await page.locator('#frame').boundingBox();
  const cx = frame.x + frame.width * 0.3;
  const cy = frame.y + frame.height * 0.3;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 80);
  await page.mouse.up();
  await page.waitForTimeout(200);

  await page.click('#guideDoneBtn');
  await page.waitForTimeout(200);
  await page.click('#guideSaveBtn');
  await page.waitForTimeout(200);

  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('jamo-tuner-guide-v1');
    return raw ? JSON.parse(raw) : null;
  });
  expect(saved).not.toBeNull();
  expect(saved['화']).toBeDefined();
});

// ── Duplicate event handler check ──────────────────────────────────────────

test('dragging box during walkthrough commits exactly one op', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);

  const frame = await page.locator('#frame').boundingBox();
  const cx = frame.x + frame.width * 0.3;
  const cy = frame.y + frame.height * 0.3;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 80);
  await page.mouse.up();
  await page.waitForTimeout(300);

  const opCount = await page.evaluate(() => {
    return window.__state?.guide?.current?.ops?.length ?? -1;
  });
  expect(opCount).toBe(1);
});

// ── Practice pad ──────────────────────────────────────────────────────────

test('practice pad canvas exists and is visible', async ({ page }) => {
  const dims = await page.evaluate(() => {
    const c = document.getElementById('practiceCanvas');
    return c ? { w: c.width, h: c.height } : null;
  });
  expect(dims).not.toBeNull();
  expect(dims.w).toBeGreaterThan(0);
  expect(dims.h).toBeGreaterThan(0);
});

test('practice pad input exists', async ({ page }) => {
  const exists = await page.locator('#practiceInput').count();
  expect(exists).toBe(1);
});

test('practice pad status shows next keystroke for 화', async ({ page }) => {
  await page.waitForTimeout(300);
  const status = await page.locator('#practiceStatus').textContent();
  expect(status).toContain('ㅎ');
});

test('typing g in practice input advances posKs', async ({ page }) => {
  await page.locator('#practiceInput').click();
  await page.keyboard.press('g');
  await page.waitForTimeout(150);
  const status = await page.locator('#practiceStatus').textContent();
  expect(status).toContain('ㅗ');
});

test('typing wrong key flashes err and does not advance', async ({ page }) => {
  await page.locator('#practiceInput').click();
  await page.keyboard.press('z');
  await page.waitForTimeout(150);
  const status = await page.locator('#practiceStatus').textContent();
  expect(status).toContain('ㅎ');
});

test('practice keyboard renders 26 letter keys', async ({ page }) => {
  const count = await page.locator('.practice-kb-key').count();
  expect(count).toBe(26);
});

test('practice keyboard highlights g (ㅎ) for 화 initial', async ({ page }) => {
  await page.waitForTimeout(300);
  const isHighlighted = await page.evaluate(() => {
    const k = document.querySelector('.practice-kb-key[data-key="g"]');
    return !!k && (k.classList.contains('next') || k.classList.contains('next-shift'));
  });
  expect(isHighlighted).toBe(true);
});

test('typing g moves keyboard highlight to h (ㅗ)', async ({ page }) => {
  await page.locator('#practiceInput').click();
  await page.keyboard.press('g');
  await page.waitForTimeout(150);
  const next = await page.evaluate(() => {
    const lit = document.querySelector('.practice-kb-key.next, .practice-kb-key.next-shift');
    return lit ? lit.dataset.key : null;
  });
  expect(next).toBe('h');
});

test('changing sample resets practice progress', async ({ page }) => {
  await page.locator('#practiceInput').click();
  await page.keyboard.press('g');
  await page.waitForTimeout(150);
  await page.click('#nextBtn');
  await page.waitForTimeout(300);
  const status = await page.locator('#practiceStatus').textContent();
  // 원 starts with ㅇ
  expect(status).toContain('ㅇ');
});

// ── Photoshop-style modifiers ─────────────────────────────────────────────

test('option+drag adds a subtract op (not metaKey)', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);
  const frame = await page.locator('#frame').boundingBox();
  // First plain drag to add an additive op
  const cx = frame.x + frame.width * 0.3;
  const cy = frame.y + frame.height * 0.3;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 100);
  await page.mouse.up();
  await page.waitForTimeout(200);

  // Now Alt+drag (Option on Mac) to subtract
  await page.keyboard.down('Alt');
  const cx2 = frame.x + frame.width * 0.4;
  const cy2 = frame.y + frame.height * 0.4;
  await page.mouse.move(cx2, cy2);
  await page.mouse.down();
  await page.mouse.move(cx2 + 40, cy2 + 40);
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await page.waitForTimeout(200);

  const ops = await page.evaluate(() => {
    return window.__state?.guide?.current?.ops?.map(op => op.mode) ?? [];
  });
  expect(ops).toContain('subtract');
});

test('shift+drag adds an additive op without replacing', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);
  const frame = await page.locator('#frame').boundingBox();
  // First plain drag to add (replace)
  await page.mouse.move(frame.x + 50, frame.y + 50);
  await page.mouse.down();
  await page.mouse.move(frame.x + 130, frame.y + 130);
  await page.mouse.up();
  await page.waitForTimeout(200);

  // Shift+drag to add another
  await page.keyboard.down('Shift');
  await page.mouse.move(frame.x + 200, frame.y + 50);
  await page.mouse.down();
  await page.mouse.move(frame.x + 280, frame.y + 130);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(200);

  const opCount = await page.evaluate(() => {
    return window.__state?.guide?.current?.ops?.length ?? -1;
  });
  expect(opCount).toBe(2);
});

test('practice canvas is positioned inside the practice pad (not floating)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const c = document.getElementById('practiceCanvas');
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return { top: r.top, position: cs.position };
  });
  expect(result.position).toBe('static');
  expect(result.top).toBeGreaterThan(100); // not floating at viewport top
});

test('saved syllable shows checkmark in sample list', async ({ page }) => {
  // Save a guide for 화
  await page.click('#guideStartBtn');
  await page.waitForTimeout(150);
  const frame = await page.locator('#frame').boundingBox();
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(frame.x + 60 + i * 10, frame.y + 60 + i * 10);
    await page.mouse.down();
    await page.mouse.move(frame.x + 140 + i * 10, frame.y + 140 + i * 10);
    await page.mouse.up();
    await page.waitForTimeout(100);
    await page.click('#guideDoneBtn');
    await page.waitForTimeout(100);
  }
  await page.click('#guideSaveBtn');
  await page.waitForTimeout(300);
  const hasCheck = await page.evaluate(() => {
    const btn = document.querySelector('.sample-btn[data-index="0"]');
    return btn && btn.classList.contains('saved') && !!btn.querySelector('.check');
  });
  expect(hasCheck).toBe(true);
});

test('clicking a committed step in walkthrough re-enters edit mode for that step', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(150);
  const frame = await page.locator('#frame').boundingBox();
  // Commit 3 steps for 화 (ㅎ, ㅗ, ㅏ)
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(frame.x + 60 + i * 10, frame.y + 60 + i * 10);
    await page.mouse.down();
    await page.mouse.move(frame.x + 140 + i * 10, frame.y + 140 + i * 10);
    await page.mouse.up();
    await page.waitForTimeout(100);
    await page.click('#guideDoneBtn');
    await page.waitForTimeout(100);
  }
  // Click step 1 (ㅎ) in the guide list
  await page.locator('.guide-step.editable[data-order="1"]').click();
  await page.waitForTimeout(150);
  const editing = await page.evaluate(() => {
    return {
      currentOrder: window.__state?.guide?.current?.order,
      currentOps: window.__state?.guide?.current?.ops?.length,
      stepsRemaining: window.__state?.guide?.steps?.length,
      active: window.__state?.guide?.active
    };
  });
  expect(editing.currentOrder).toBe(1);
  expect(editing.currentOps).toBe(0);
  expect(editing.stepsRemaining).toBe(2);
  expect(editing.active).toBe(true);
});

test('shape toggle: clicking Ellipse switches drag shape to ellipse', async ({ page }) => {
  await page.click('.shape-toggle .shape-btn[data-shape="ellipse"]');
  await page.click('#guideStartBtn');
  await page.waitForTimeout(150);
  const frame = await page.locator('#frame').boundingBox();
  await page.mouse.move(frame.x + 60, frame.y + 60);
  await page.mouse.down();
  await page.mouse.move(frame.x + 160, frame.y + 160);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const op = await page.evaluate(() => {
    const ops = window.__state?.guide?.current?.ops;
    return ops && ops.length ? { shape: ops[0].shape, mode: ops[0].mode } : null;
  });
  expect(op).toEqual({ shape: 'ellipse', mode: 'add' });
});

test('shape toggle: pressing E switches to ellipse, R back to rect', async ({ page }) => {
  await page.keyboard.press('e');
  await page.waitForTimeout(100);
  let active = await page.evaluate(() => document.querySelector('.shape-toggle .shape-btn.active')?.dataset.shape);
  expect(active).toBe('ellipse');
  await page.keyboard.press('r');
  await page.waitForTimeout(100);
  active = await page.evaluate(() => document.querySelector('.shape-toggle .shape-btn.active')?.dataset.shape);
  expect(active).toBe('rect');
});

test('plain drag replaces previous boxes in current step', async ({ page }) => {
  await page.click('#guideStartBtn');
  await page.waitForTimeout(200);
  const frame = await page.locator('#frame').boundingBox();
  // First plain drag
  await page.mouse.move(frame.x + 50, frame.y + 50);
  await page.mouse.down();
  await page.mouse.move(frame.x + 130, frame.y + 130);
  await page.mouse.up();
  await page.waitForTimeout(200);
  // Second plain drag should REPLACE, not add
  await page.mouse.move(frame.x + 200, frame.y + 50);
  await page.mouse.down();
  await page.mouse.move(frame.x + 280, frame.y + 130);
  await page.mouse.up();
  await page.waitForTimeout(200);

  const opCount = await page.evaluate(() => {
    return window.__state?.guide?.current?.ops?.length ?? -1;
  });
  expect(opCount).toBe(1);
});
