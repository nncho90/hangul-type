# Design Spec: 원고지 (Wongoji) Motif

**Date:** 2026-05-16
**Status:** Approved
**Scope:** index.html, game.html

---

## Summary

Add a 원고지 (Korean manuscript paper) visual motif to Type Hangeul. The design has two parts: a soft blue grid tiling the page background, and a live 원고지 widget in the sidebar that fills with typed characters as the user practices — mirroring the actual TOPIK essay writing experience.

---

## Background Context

원고지 is the squared manuscript paper used in TOPIK handwritten essay sections. Rules: one Hangul character per cell, blank cell for a space, first cell of each paragraph left empty for indent. Standard format: 20 columns × 10 rows = 200 characters per page. This matches the TOPIK II short essay target length, making the motif both decorative and pedagogically resonant.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Placement | Page background texture | Non-intrusive, atmospheric |
| Color | Soft blue (rgba(96,165,250,0.35)) | Matches actual 원고지 paper color |
| Detail level | Numbered rows | Immediately recognizable as the real exam sheet |
| Pages | index.html + game.html | Consistent site-wide theme |
| Implementation | CSS grid bg + live widget | Most functional; connects motif to actual typing activity |

---

## Part 1: Page Background

**Both pages (index.html, game.html) — `body` styles:**

```css
body {
  background-color: #f0f4f8;
  background-image:
    linear-gradient(rgba(96,165,250,0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(96,165,250,0.32) 1px, transparent 1px);
  background-size: 18px 18px;
}
```

Card backgrounds change to `rgba(255,255,255,0.92)` so the grid peeks through subtly. No other card or component styles change.

---

## Part 2: 원고지 Widget (index.html only)

A new card in the sidebar (right column of the existing `.grid` layout). Does not exist in game.html — that page has a different layout and the background alone is sufficient.

### Structure

```
[원고지 header: title + character count (N / 200자)]
[Row numbers 1–10 on the left]
[20×10 grid of cells]
[Progress bar + % label]
[Rule reminder: 한 칸에 한 글자 · 띄어쓰기는 빈 칸]
```

### Grid spec

- 20 columns × 10 rows = 200 cells
- Cell borders: `1px solid rgba(96,165,250,0.25)`
- Outer border: `1.5px solid rgba(96,165,250,0.6)`
- Row numbers: font-size 7px, `rgba(59,130,246,0.55)`, monospace, right-aligned in a 12px-wide column to the left of the grid
- Bold row separator at row 5 border: `1.5px solid rgba(96,165,250,0.45)`

### Cell states

| State | Style |
|---|---|
| Empty | transparent bg |
| Typed character | `background: rgba(219,234,254,0.4)`, `color: #1e40af`, character rendered in Noto Sans KR |
| Space | `background: rgba(219,234,254,0.15)`, no character |
| Cursor (next empty cell) | `box-shadow: inset 0 0 0 1.5px rgba(37,99,235,0.5)` |

### Behavior

- Widget hooks into the same input/keydown handler already used for the typing field in index.html
- Characters fill cells LIVE as typed (not only on correct word completion) — this mirrors writing on real 원고지
- On each character keydown: mark next empty cell as typed with the character, advance cursor
- On space: mark next cell as space (blank cell, light bg), advance cursor
- On backspace: revert last filled cell to empty, move cursor back
- On word completion (correct submit): cells stay as-is — they were already filled live
- On incorrect word attempt + re-entry: backspace events already revert cells; user re-types into the same cells
- On session reset (new game start): clear all cells, reset cursor to cell 0
- On session reset (new game start): clear all cells, reset cursor to cell 0
- Character count label updates live: `N / 200자`
- Progress bar width: `(filledCells / 200) * 100%`
- When all 200 cells are filled: widget shows a soft "완료!" state (blue border glow, count turns green) — does not block typing, just celebrates

### Widget card CSS

```css
.wongoji-card {
  background: rgba(255,255,255,0.92);
  border: 1.5px solid rgba(96,165,250,0.5);
  border-radius: 14px;
  padding: 14px 16px;
}
```

---

## Part 3: Widget Font

The characters rendered inside 원고지 cells use a handwritten Korean Google Font to evoke actually writing on manuscript paper.

**Font:** `Nanum Pen Script` (Google Fonts) — lightest-weight handwritten Korean font, legible at small sizes.

```html
<!-- Add to both pages' <head> alongside existing font imports -->
<link href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap" rel="stylesheet">
```

Apply only to `.wongoji-cell` text content, not to the widget labels/count (those stay JetBrains Mono).

---

## Part 4: Finger Color Re-tune

All existing features are preserved unchanged:
- Jamo coloring on the target word
- Finger-color keyboard highlighting (`.key.target.f-*`, `.key.shifted.f-*`)
- Finger bar diagram below the keyboard (`.fbar-f.active[data-f$="*"]`)

Only the 4 finger hue values change. New palette is harmonized with the wongoji blue (`#60a5fa`, HSL 213°, 93%, 65%) — same saturation and lightness tier, evenly spread across the hue wheel:

| Finger | Old | New | Hue |
|---|---|---|---|
| pinky | `#a855f7` | `#c084fc` | 270° violet |
| ring | `#0ea5e9` | `#34d399` | 160° emerald (previously too close to site blue) |
| middle | `#f59e0b` | `#fb923c` | 24° orange-amber |
| index | `#ec4899` | `#f472b6` | 330° rose-pink |

Each value appears in 4 places in index.html (`.key.target`, `.key.shifted`, `.fbar-f.active` × 2 box-shadow variants). Replace all 4 occurrences per finger color as a batch.

---

## Acceptance Criteria

1. Both pages have the soft blue 18px grid on the body background.
2. Existing card `background: #fff` → `background: rgba(255,255,255,0.92)` so grid shows through.
3. 원고지 widget appears in index.html sidebar, below or instead of any existing sidebar stub.
4. Widget grid is exactly 20 cols × 10 rows; row numbers 1–10 visible on left.
5. Widget cell characters render in Nanum Pen Script; labels/count stay in JetBrains Mono.
6. Typing a character fills the next cell live; space fills a blank cell; backspace reverts.
7. Character count label and progress bar update on every keystroke.
8. Session reset (new word set / game restart) clears the widget.
9. Finger colors updated to new palette in all 4 CSS locations per finger; box-shadow colors match.
10. Jamo coloring on target word and finger bar diagram visually unchanged (just recolored).
11. No visual regression on mobile (375px): widget stacks below the practice card, grid cells stay square.
12. No regression in game.html layout — background only, no widget or color changes added.

---

## Out of Scope

- 원고지 widget in game.html (different layout, background alone is sufficient)
- Cell size matching actual typed character size (decorative scale is fine)
- Animated character-drop effect (can add later)
- Paragraph indent rule enforcement (informational tip only, not enforced in widget)
