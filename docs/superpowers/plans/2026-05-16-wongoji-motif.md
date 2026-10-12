# Wongoji Motif Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 원고지 (Korean manuscript paper) visual motif to Type Hangeul: a soft blue 18px grid on the body background of both pages, and a live 200-cell wongoji widget in the index.html sidebar that fills with typed characters in real time.

**Architecture:** All changes are inline CSS/JS in two single-file HTML pages. The wongoji widget is a plain `<aside>` card added as a sibling to `.practice-card` inside `.practice-main`, which becomes a flex row. The widget's JS is a self-contained `WG` state object with `wgInit / wgRefresh / wgWordDone / wgReset` functions that hook into four existing call sites.

**Tech Stack:** Vanilla HTML/CSS/JS · Gaegu font (Google Fonts) · No build step

---

### Task 1: Background grid CSS on both pages

**Files:**
- Modify: `index.html` (body CSS ~line 48, card CSS ~line 278)
- Modify: `game.html` (html/body CSS ~line 48)

- [ ] **Step 1: Update `index.html` body background**

Find this block (around line 48):
```css
  body {
    background: var(--bg);
    color: var(--thi);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    min-height: 100vh;
  }
```
Replace with:
```css
  body {
    background-color: var(--bg);
    background-image:
      linear-gradient(rgba(96,165,250,0.32) 1px, transparent 1px),
      linear-gradient(90deg, rgba(96,165,250,0.32) 1px, transparent 1px);
    background-size: 18px 18px;
    color: var(--thi);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    min-height: 100vh;
  }
```

- [ ] **Step 2: Update `.card` background in `index.html`**

Find (around line 278):
```css
  .card {
    background: var(--l1);
    border: 1px solid var(--bd);
    border-radius: 14px;
    padding: 22px;
  }
```
Replace with:
```css
  .card {
    background: rgba(255,255,255,0.92);
    border: 1px solid var(--bd);
    border-radius: 14px;
    padding: 22px;
  }
```

- [ ] **Step 3: Update `game.html` body background**

In `game.html` find (around line 48):
```css
  html, body {
    height: 100%;
    overflow: hidden;
    background: var(--bg);
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--thi);
    user-select: none;
    -webkit-user-select: none;
  }
```
Replace with:
```css
  html, body {
    height: 100%;
    overflow: hidden;
    background-color: var(--bg);
    background-image:
      linear-gradient(rgba(96,165,250,0.32) 1px, transparent 1px),
      linear-gradient(90deg, rgba(96,165,250,0.32) 1px, transparent 1px);
    background-size: 18px 18px;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--thi);
    user-select: none;
    -webkit-user-select: none;
  }
```

- [ ] **Step 4: Verify visually**

Open `index.html` and `game.html` in a browser. Both pages should show a soft blue 18px square grid tiling the background. Cards should look slightly translucent (grid faintly visible behind them). No layout shifts.

- [ ] **Step 5: Commit**

```bash
git add index.html game.html
git commit -m "style: add wongoji blue grid to body background on both pages"
```

---

### Task 2: Finger color re-tune in index.html

**Files:**
- Modify: `index.html` — 3 CSS blocks + 1 JS object (4 hex values each)

All changes are in `index.html` only. `game.html` does not have finger colors.

- [ ] **Step 1: Update `.key.target.f-*` CSS (lines ~1287-1290)**

Find:
```css
  .key.target.f-pinky  { background: #a855f7; border-color: #a855f7; }
  .key.target.f-ring   { background: #0ea5e9; border-color: #0ea5e9; }
  .key.target.f-middle { background: #f59e0b; border-color: #f59e0b; }
  .key.target.f-index  { background: #ec4899; border-color: #ec4899; }
```
Replace with:
```css
  .key.target.f-pinky  { background: #9d8ee0; border-color: #9d8ee0; }
  .key.target.f-ring   { background: #de85a8; border-color: #de85a8; }
  .key.target.f-middle { background: #62b882; border-color: #62b882; }
  .key.target.f-index  { background: #c9a040; border-color: #c9a040; }
```

- [ ] **Step 2: Update `.key.shifted.f-*` CSS (lines ~1295-1298)**

Find:
```css
  .key.shifted.f-pinky  { background: #a855f7; border-color: #a855f7; }
  .key.shifted.f-ring   { background: #0ea5e9; border-color: #0ea5e9; }
  .key.shifted.f-middle { background: #f59e0b; border-color: #f59e0b; }
  .key.shifted.f-index  { background: #ec4899; border-color: #ec4899; }
```
Replace with:
```css
  .key.shifted.f-pinky  { background: #9d8ee0; border-color: #9d8ee0; }
  .key.shifted.f-ring   { background: #de85a8; border-color: #de85a8; }
  .key.shifted.f-middle { background: #62b882; border-color: #62b882; }
  .key.shifted.f-index  { background: #c9a040; border-color: #c9a040; }
```

- [ ] **Step 3: Update `.fbar-f.active` CSS (lines ~1356-1359)**

Find:
```css
  .fbar-f.active[data-f$="-pinky"]  { background: #a855f7; box-shadow: 0 2px 10px #a855f760; transform: none; }
  .fbar-f.active[data-f$="-ring"]   { background: #0ea5e9; box-shadow: 0 2px 10px #0ea5e960; transform: none; }
  .fbar-f.active[data-f$="-middle"] { background: #f59e0b; box-shadow: 0 2px 10px #f59e0b60; transform: none; }
  .fbar-f.active[data-f$="-index"]  { background: #ec4899; box-shadow: 0 2px 10px #ec489960; transform: none; }
```
Replace with:
```css
  .fbar-f.active[data-f$="-pinky"]  { background: #9d8ee0; box-shadow: 0 2px 10px #9d8ee060; transform: none; }
  .fbar-f.active[data-f$="-ring"]   { background: #de85a8; box-shadow: 0 2px 10px #de85a860; transform: none; }
  .fbar-f.active[data-f$="-middle"] { background: #62b882; box-shadow: 0 2px 10px #62b88260; transform: none; }
  .fbar-f.active[data-f$="-index"]  { background: #c9a040; box-shadow: 0 2px 10px #c9a04060; transform: none; }
```

- [ ] **Step 4: Update `STATE_COLORS` JS object (lines ~4500-4503)**

Find:
```js
  'f-pinky':  '#a855f7',
  'f-ring':   '#0ea5e9',
  'f-middle': '#f59e0b',
  'f-index':  '#ec4899',
```
Replace with:
```js
  'f-pinky':  '#9d8ee0',
  'f-ring':   '#de85a8',
  'f-middle': '#62b882',
  'f-index':  '#c9a040',
```

- [ ] **Step 5: Verify visually**

Open `index.html`. Type a few characters. Keys should light up: index=gold, middle=sage green, ring=dusty rose, pinky=muted violet. Finger bar dots below keyboard should glow the same colors. The per-jamo canvas coloring on the target word should still work (the individual jamo regions light up in their respective finger colors).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "style: retune finger colors to muted wongoji-harmonized palette"
```

---

### Task 3: Gaegu font + wongoji widget HTML + CSS

**Files:**
- Modify: `index.html` — `<head>` font link, new CSS block, new `<aside>` in HTML, `.practice-main` layout CSS

- [ ] **Step 1: Add Gaegu font to `<head>`**

In `index.html`, find the existing Google Fonts link (it loads Inter, JetBrains Mono, Black Han Sans, Noto Sans KR). Add Gaegu alongside. Find:
```html
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
```
Replace with (add `&family=Gaegu`):
```html
<link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gaegu&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
```

If the font link has a different format, grep for `googleapis.com/css2` and add `&family=Gaegu` to the same link. If the link uses `|` separators instead of `&family=`, adapt accordingly.

- [ ] **Step 2: Add `.practice-main` flex layout CSS**

Find the `.card {}` block (line ~278) and add NEW rules immediately after the closing `}`:
```css
  .practice-main {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .practice-card {
    flex: 1 1 0;
    min-width: 0;
  }
  @media (max-width: 700px) {
    .practice-main { flex-direction: column; }
    .wongoji-card  { width: 100%; }
  }
```

- [ ] **Step 3: Add wongoji widget CSS**

In the same CSS block area, after the rules added in Step 2, add:
```css
  /* ---- Wongoji widget ---- */
  .wongoji-card {
    background: rgba(255,255,255,0.92);
    border: 1.5px solid rgba(96,165,250,0.5);
    border-radius: 14px;
    padding: 14px 16px;
    width: 280px;
    flex-shrink: 0;
    box-sizing: border-box;
  }
  .wongoji-card.wg-done {
    box-shadow: 0 0 0 2px rgba(37,99,235,0.35);
  }
  .wg-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .wg-title {
    font-size: 12px;
    font-weight: 600;
    color: rgba(37,99,235,0.8);
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.04em;
  }
  .wg-count {
    font-size: 11px;
    color: var(--tmd);
    font-family: 'JetBrains Mono', monospace;
  }
  .wg-grid-wrap {
    display: flex;
    gap: 3px;
    align-items: stretch;
  }
  .wg-row-nums {
    display: flex;
    flex-direction: column;
    width: 12px;
    flex-shrink: 0;
  }
  .wg-row-num {
    flex: 1;
    font-size: 7px;
    color: rgba(59,130,246,0.55);
    font-family: 'JetBrains Mono', monospace;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 1px;
    line-height: 1;
  }
  .wg-grid {
    display: grid;
    grid-template-columns: repeat(20, 1fr);
    border: 1.5px solid rgba(96,165,250,0.6);
    flex: 1;
  }
  .wongoji-cell {
    aspect-ratio: 1;
    border-right: 1px solid rgba(96,165,250,0.25);
    border-bottom: 1px solid rgba(96,165,250,0.25);
    font-family: 'Gaegu', cursive;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-sizing: border-box;
  }
  /* Bold separator between row 5 and row 6 */
  .wongoji-cell:nth-child(n+81):nth-child(-n+100) {
    border-bottom: 1.5px solid rgba(96,165,250,0.45);
  }
  .wongoji-cell.wc-typed {
    background: rgba(219,234,254,0.4);
    color: #1e40af;
  }
  .wongoji-cell.wc-space {
    background: rgba(219,234,254,0.15);
  }
  .wongoji-cell.wc-cursor {
    box-shadow: inset 0 0 0 1.5px rgba(37,99,235,0.5);
  }
  .wg-footer {
    margin-top: 8px;
  }
  .wg-progress-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .wg-progress-track {
    flex: 1;
    height: 4px;
    background: rgba(96,165,250,0.15);
    border-radius: 2px;
    overflow: hidden;
  }
  .wg-progress-fill {
    height: 100%;
    background: rgba(37,99,235,0.5);
    border-radius: 2px;
    transition: width 0.1s;
  }
  .wg-pct {
    font-size: 9px;
    color: var(--tlo);
    font-family: 'JetBrains Mono', monospace;
    min-width: 28px;
    text-align: right;
  }
  .wg-rule {
    margin-top: 6px;
    font-size: 9px;
    color: rgba(37,99,235,0.5);
    font-family: 'JetBrains Mono', monospace;
    text-align: center;
    letter-spacing: 0.02em;
  }
```

- [ ] **Step 4: Add wongoji widget HTML**

Find (line ~2225):
```html
  <main class="practice-main">

    <!-- Practice -->
    <section class="card practice-card">
```
Replace with:
```html
  <main class="practice-main">

    <!-- Practice -->
    <section class="card practice-card">
```
(No change to this anchor line — just confirming location.)

Find the CLOSING `</main>` tag that closes `<main class="practice-main">`. It will be after `</section>`. Insert the wongoji card BEFORE that `</main>`:

Specifically, find (the closing tag of practice-main):
```html
  </main>
```
But you need to be sure it's the right `</main>`. Grep for `practice-main` to confirm its extent, then add the widget as the last child before `</main>`. The widget HTML to insert:

```html

    <!-- Wongoji live widget -->
    <aside class="wongoji-card" id="wongoji-card">
      <div class="wg-header">
        <span class="wg-title">원고지</span>
        <span class="wg-count"><span id="wgCount">0</span>&nbsp;/ 200자</span>
      </div>
      <div class="wg-grid-wrap">
        <div class="wg-row-nums" id="wgRowNums"></div>
        <div class="wg-grid" id="wgGrid"></div>
      </div>
      <div class="wg-footer">
        <div class="wg-progress-wrap">
          <div class="wg-progress-track"><div class="wg-progress-fill" id="wgBar" style="width:0%"></div></div>
          <span class="wg-pct" id="wgPct">0%</span>
        </div>
        <div class="wg-rule">한 칸에 한 글자 &middot; 띄어쓰기는 빈 칸</div>
      </div>
    </aside>

```

- [ ] **Step 5: Verify layout**

Open `index.html`. The practice card should be on the left (taking remaining width) and the wongoji card should appear to its right, 280px wide, with a grid of empty cells and row numbers 1-10 on the left edge. On mobile (375px), the two cards should stack vertically.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add wongoji widget HTML and CSS to index.html sidebar"
```

---

### Task 4: Wongoji JS module

**Files:**
- Modify: `index.html` — add `WG` state object and four functions to the `<script>` block

Add this entire block to `index.html`'s `<script>` section, BEFORE the first `addEventListener` or event setup code (a safe anchor: find the line `// ============================================================` that precedes `// Input handling` at line ~5618, and insert this block just above it):

- [ ] **Step 1: Add the WG module**

Find this comment line in the script:
```js
// ============================================================
// Input handling
// ============================================================
```
Insert this block immediately above that comment:
```js
// ============================================================
// Wongoji widget
// ============================================================

const WG = { committed: '' };

function wgInit() {
  const grid = document.getElementById('wgGrid');
  const rowNums = document.getElementById('wgRowNums');
  if (!grid || !rowNums) return;
  for (let r = 1; r <= 10; r++) {
    const d = document.createElement('div');
    d.className = 'wg-row-num';
    d.textContent = r;
    rowNums.appendChild(d);
  }
  for (let i = 0; i < 200; i++) {
    const cell = document.createElement('div');
    cell.className = 'wongoji-cell';
    cell.id = 'wc-' + i;
    grid.appendChild(cell);
  }
  wgRefresh('');
}

// composing: the in-progress word being typed. Pass '' on word completion
// so the committed word isn't double-counted with state.ime.display.
function wgRefresh(composing) {
  if (composing === undefined) composing = (state && state.ime && state.ime.display) || '';
  const live = WG.committed + composing;
  const cells = document.querySelectorAll('.wongoji-cell');
  cells.forEach((cell, i) => {
    if (i < live.length) {
      const ch = live[i];
      if (ch === ' ') {
        cell.className = 'wongoji-cell wc-space';
        cell.textContent = '';
      } else {
        cell.className = 'wongoji-cell wc-typed';
        cell.textContent = ch;
      }
    } else if (i === live.length && live.length < 200) {
      cell.className = 'wongoji-cell wc-cursor';
      cell.textContent = '';
    } else {
      cell.className = 'wongoji-cell';
      cell.textContent = '';
    }
  });
  const count = live.length;
  const countEl = document.getElementById('wgCount');
  const barEl   = document.getElementById('wgBar');
  const pctEl   = document.getElementById('wgPct');
  const card    = document.getElementById('wongoji-card');
  if (countEl) countEl.textContent = count;
  if (barEl)   barEl.style.width = Math.min((count / 200) * 100, 100) + '%';
  if (pctEl)   pctEl.textContent = Math.min(Math.round((count / 200) * 100), 100) + '%';
  if (card) {
    if (count >= 200) {
      card.classList.add('wg-done');
      if (countEl) countEl.style.color = '#16a34a';
    } else {
      card.classList.remove('wg-done');
      if (countEl) countEl.style.color = '';
    }
  }
}

function wgWordDone(word) {
  const remaining = 200 - WG.committed.length;
  if (remaining <= 0) return;
  const append = word.length < remaining ? word + ' ' : word.slice(0, remaining);
  WG.committed += append;
}

function wgReset() {
  WG.committed = '';
  wgRefresh('');
}
```

- [ ] **Step 2: Verify no syntax errors**

Open `index.html` in a browser and open the browser console. There should be no JS errors. The wongoji grid should be visible and show empty cells. (wgInit hasn't been wired yet, so the grid cells won't be rendered from JS — that's OK, that's Task 5.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add WG wongoji state module (wgInit/wgRefresh/wgWordDone/wgReset)"
```

---

### Task 5: Wire hooks and call wgInit

**Files:**
- Modify: `index.html` — 5 hook points + 1 init call

- [ ] **Step 1: Call wgRefresh on every correct jamo (afterCorrectKeystroke normal path)**

Find (near end of `afterCorrectKeystroke`, around line 5697):
```js
  // Per-keystroke "Hit." messages were noise — the keyboard highlight + canvas color already say it.
```
Add `wgRefresh();` immediately before that comment line:
```js
  wgRefresh();
  // Per-keystroke "Hit." messages were noise — the keyboard highlight + canvas color already say it.
```

- [ ] **Step 2: Call wgWordDone + wgRefresh on word completion (success path)**

Inside `afterCorrectKeystroke`, find the word-success block. Locate `updateStats();` that appears INSIDE the `if (displayed === target) {` block (the one at approximately line 5689, before the closing `}` of that block and before the `} else {`). It looks like:

```js
      updateStats();
    } else {
      setDiag('err',
```

Add `wgWordDone(target);` immediately before that `updateStats()`:
```js
      wgWordDone(target);
      updateStats();
    } else {
      setDiag('err',
```

- [ ] **Step 3: Call wgRefresh before the word-complete return**

Still in `afterCorrectKeystroke`, find the `return;` that closes the word-complete branch (the one at line ~5694, after both the success `}` and error `}` blocks):
```js
    return;
  }
```
Add `wgRefresh('');` immediately before that `return;`:
```js
    wgRefresh('');
    return;
  }
```

- [ ] **Step 4: Call wgRefresh after desktop backspace (keydown handler)**

Find the desktop backspace handler (around line 5911):
```js
    if (e.key === 'Backspace') {
      e.preventDefault();
      state.ime.backspace();
      if (state.posKs > 0) state.posKs--;
      renderLive();
      updateTargetJamoStates();
      updateProgress();
      highlightNextKey();
      return;
    }
```
Replace with:
```js
    if (e.key === 'Backspace') {
      e.preventDefault();
      state.ime.backspace();
      if (state.posKs > 0) state.posKs--;
      renderLive();
      updateTargetJamoStates();
      updateProgress();
      highlightNextKey();
      wgRefresh();
      return;
    }
```

- [ ] **Step 5: Call wgRefresh after mobile backspace (touch keyboard handler)**

Find the mobile backspace handler (around line 5835):
```js
      if (action === 'backspace') {
        flashTap(keyEl);
        state.ime.backspace();
        if (state.posKs > 0) state.posKs--;
        renderLive();
        updateTargetJamoStates();
        updateProgress();
        highlightNextKey();
        if (shiftArmed) setShift(false);
        return;
      }
```
Replace with:
```js
      if (action === 'backspace') {
        flashTap(keyEl);
        state.ime.backspace();
        if (state.posKs > 0) state.posKs--;
        renderLive();
        updateTargetJamoStates();
        updateProgress();
        highlightNextKey();
        wgRefresh();
        if (shiftArmed) setShift(false);
        return;
      }
```

- [ ] **Step 6: Call wgReset on session reset**

Find the reset button handler's `loadWord(0)` call (around line 6092):
```js
    loadWord(0);
  });
```
Replace with:
```js
    loadWord(0);
    wgReset();
  });
```

- [ ] **Step 7: Call wgInit at page load**

Find the end of the main `<script>` block. Look for the last substantive initialization call near the bottom. A reliable anchor is the `loadWord(0)` call in the reset handler just edited. After all event listener setup, find the very last line before `</script>`. Add `wgInit();` there.

A safe grep: search for `</script>` — add `wgInit();` on the line just before the first `</script>` that closes the main inline script block. If there are multiple `</script>` tags, use the one that closes the big JS block (the one that contains `afterCorrectKeystroke`, `handleKeystroke`, etc.).

```js
  wgInit();
</script>
```

- [ ] **Step 8: Full end-to-end test**

Open `index.html` in a browser. Perform these checks in order:

1. Grid renders: 200 cells visible, row numbers 1-10 on the left edge.
2. Type a Korean character (e.g. press `r` for ㄱ): the first cell shows a character in Gaegu handwriting font, cursor moves to cell 2.
3. Type a complete word: all cells for that word fill, then a space cell appears, cursor advances.
4. Press Backspace: last filled cell reverts to empty, cursor steps back.
5. Complete 10+ words: character count label and progress bar update correctly.
6. Click Reset stats (in the settings gear): all cells clear, count returns to 0.
7. Finger colors: type characters that use different fingers, confirm index=gold, middle=green, ring=pink, pinky=violet.
8. Per-jamo canvas: confirm jamo regions on the target word still light up individually (not whole syllable blocks).
9. Mobile (resize browser to 375px): wongoji card stacks below the practice card, grid cells stay square.
10. Open `game.html`: background grid present, no wongoji widget, no layout changes.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: wire wongoji hooks — live cell fill, backspace, word-done, reset"
```

---

## Acceptance Criteria Checklist

Before calling this done, verify all 12 spec criteria:

- [ ] 1. Both pages have soft blue 18px grid on body background
- [ ] 2. Card backgrounds show `rgba(255,255,255,0.92)` so grid shows through
- [ ] 3. Widget appears in index.html sidebar, to the right of the practice card
- [ ] 4. Widget grid is exactly 20 cols x 10 rows; row numbers 1-10 visible on left
- [ ] 5. Cell characters render in Gaegu; labels/count stay in JetBrains Mono
- [ ] 6. Typing fills next cell live; space fills blank cell; backspace reverts
- [ ] 7. Character count label and progress bar update on every keystroke
- [ ] 8. Session reset clears widget to 0
- [ ] 9. Finger colors updated in all 4 CSS locations per finger; box-shadow colors match
- [ ] 10. Jamo coloring on target word and finger bar diagram visually unchanged (just recolored)
- [ ] 11. No visual regression on mobile (375px): widget stacks below practice card, cells stay square
- [ ] 12. No regression in game.html layout (background only, no widget or color changes)
