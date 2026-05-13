// battle-config.js
// Single source of truth for sprite mappings, boss roster, XP curve, and
// per-tier visual sizing in Hangeul Battle. game.html and battle-workshop.html
// both consume window.BATTLE_CONFIG.
//
// Spawn pacing, motion, and admin-overridable knobs live in game.html's ADMIN
// block (separate system with localStorage overrides). Keep that one out of
// here so admin-panel writes don't have to round-trip through this file.

(function () {
  const BATTLE_CONFIG = {
    // ─── Player tiers ───────────────────────────────────────────────────────
    // 7 tiers mapped to Joseon-era social hierarchy. lv = unlock level.
    // attackType drives which combat VFX fires (melee teleport vs ranged
    // projectile vs spell AoE). Cap is 대왕 — once you hit Lv.40 you stay.
    players: [
      { lv: 1,  tier: 1, emoji: '🥋', label: '백의 Commoner',     spriteBack: 'player/01-baegui-back',   spriteFront: 'player/01-baegui-front',   spriteStrike: 'player/01-baegui-back-attack',   attackType: 'melee'  },
      { lv: 5,  tier: 2, emoji: '🪓', label: '나무꾼 Woodcutter', spriteBack: 'player/02-namukkun-back', spriteFront: 'player/02-namukkun-front', spriteStrike: 'player/02-namukkun-back-attack', attackType: 'melee'  },
      { lv: 10, tier: 3, emoji: '📜', label: '선비 Scholar',      spriteBack: 'player/03-seonbi-back',   spriteFront: 'player/03-seonbi-front',   spriteStrike: 'player/03-seonbi-back-attack',   attackType: 'spell'  },
      { lv: 16, tier: 4, emoji: '🖌️', label: '양반 Yangban',     spriteBack: 'player/04-yangban-back',  spriteFront: 'player/04-yangban-front',  spriteStrike: 'player/04-yangban-back-attack',  attackType: 'spell'  },
      { lv: 23, tier: 5, emoji: '⚔️', label: '무관 Officer',      spriteBack: 'player/05-mugwan-back',   spriteFront: 'player/05-mugwan-front',   spriteStrike: 'player/05-mugwan-back-attack',   attackType: 'melee'  },
      { lv: 30, tier: 6, emoji: '🏹', label: '장군 General',      spriteBack: 'player/06-janggun-back',  spriteFront: 'player/06-janggun-front',  spriteStrike: 'player/06-janggun-back-attack',  attackType: 'ranged' },
      { lv: 40, tier: 7, emoji: '👑', label: '대왕 Great King',   spriteBack: 'player/07-daewang-back',  spriteFront: 'player/07-daewang-front',  spriteStrike: 'player/07-daewang-back-attack',  attackType: 'spell'  }
    ],

    // ─── Enemy tier sprite paths (1–5) ──────────────────────────────────────
    // Each tier is one demon archetype. buildMonsterEl appends '-walk-1' /
    // '-walk-3' to compose a 2-frame walk via CSS opacity flicker.
    enemyTiers: {
      1: 'enemies/01-imp',
      2: 'enemies/02-gumiho',
      3: 'enemies/04-oni',
      4: 'enemies/06-jeoseung',
      5: 'enemies/03-cheonyeo'
    },

    // ─── Emoji fallbacks per tier ───────────────────────────────────────────
    // Used by spriteHtml's onerror swap when the PNG 404s.
    tierEmoji: {
      1: ['🐛','🦋','🐌','🐞','🦟','🪲','🐜'],
      2: ['👻','🧚','🐸','🦊','🐰','🦔','🐭'],
      3: ['🦅','🐺','🕷️','🦂','🦇','🦝','🐗'],
      4: ['👹','🧟','🐲','🦹','🧛','🦴'],
      5: ['👾','💀','🦖','🐍','🦑','🧞'],
      boss: ['🐉','🦠','👹','💀']
    },

    // ─── Boss roster ────────────────────────────────────────────────────────
    // Bosses ship as <base>.png + <base>-step.png (NOT a 4-frame walk row).
    // buildMonsterEl branches on tier === 'boss' to pick the right suffix.
    bosses: [
      { sprite: 'enemies/08-hangeulwang',     emoji: '🐉', name: '한글왕',         subtitle: 'Demon King of Hangeul',     flavor: '"All who would speak my tongue, kneel."' },
      { sprite: 'enemies/02-gumiho-mini',     emoji: '🦊', name: '구미호 여왕',     subtitle: 'Queen of Nine Tails',      flavor: '"Your syllables taste like fear, little one."' },
      { sprite: 'enemies/05-dokkaebi-elder',  emoji: '👹', name: '도깨비 대장',     subtitle: 'Goblin Chieftain',         flavor: '"Hahaha! Type if you dare, mortal!"' },
      { sprite: 'enemies/06-jeoseung-saja',   emoji: '🪦', name: '저승사자',        subtitle: 'Reaper of the Underworld', flavor: '"Your ledger… is incomplete."' },
      { sprite: 'enemies/03-cheonyeo-gwisin', emoji: '👻', name: '처녀귀신',        subtitle: 'Maiden of Vengeance',      flavor: '"You forgot me. I have not forgotten you."' }
    ],

    // ─── Per-tier sprite sizes (px) on the battle stage ─────────────────────
    // Used by buildMonsterEl. Sized RELATIVE TO THE PLAYER back-view sprite
    // (renderPlayerSprite renders it at 237px): tier 1 (imp) ≈ half the player
    // — reaches his stomach when they stand together; tier 2 (gumiho) a touch
    // bigger; tier 4 (jeoseung "floating guy") ≈ the player's full height;
    // tier 5 a touch bigger. Keep this in sync with MONSTER_BASE_PX in game.html.
    tierSizePx: {
      1: 119,
      2: 150,
      3: 190,
      4: 237,
      5: 270,
      boss: 351
    },

    // ─── XP curve ───────────────────────────────────────────────────────────
    // Threshold for level lv = base + step * (lv - 1), with optional discount
    // for specific levels (12/13 sit at the deep end of tier 3 word length).
    // History: was quadratic (30·lv·(lv+1)) — too slow, players walled at L2.
    // Then linear 60+40·(lv-1) — too fast, runaway with spawn-rate ramp.
    // Current 90+70·(lv-1) is the middle ground.
    xp: {
      base: 90,
      step: 70,
      lateDiscount: { levels: [12, 13], factor: 0.70 }
    },

    // ─── VFX sprite map ─────────────────────────────────────────────────────
    // Composed with expanding tier-color rings on cast. Each entry is consumed
    // by castSpellAt / fireProjectileAt in game.html.
    vfx: {
      // Player attack overlays per tier (spell tiers + ranged tier 6).
      tier3: { sprite: 'vfx/jamo-burn',       c1: '#3b82f6', c2: '#60a5fa', glyph: '문' },
      tier4: { sprite: 'vfx/ink-splash',      c1: '#1e1b4b', c2: '#7c3aed', glyph: '墨' },
      tier6: { sprite: 'vfx/arrow',           color: '#a16207', trail: 'rgba(161,98,7,0.55)', size: 56, glyph: '🏹' },
      tier7: { sprite: 'vfx/royal-lightning', c1: '#dc2626', c2: '#fbbf24', color: '#dc2626', trail: 'rgba(220,38,38,0.6)', size: 56, glyph: 'ㅎ' }
    }
  };

  // playerForLevel walks the players array; expose helper so workshop and game
  // share the same lookup logic.
  BATTLE_CONFIG.playerForLevel = function (lv) {
    let pick = BATTLE_CONFIG.players[0];
    for (const p of BATTLE_CONFIG.players) if (lv >= p.lv) pick = p;
    return pick;
  };

  window.BATTLE_CONFIG = BATTLE_CONFIG;
})();
