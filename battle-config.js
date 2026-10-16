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

    // ─── Enemy tier sprite paths (1–8) ──────────────────────────────────────
    // Each tier is one demon archetype. game.html cycles '-walk-1'..'-walk-4'
    // (and '-hit-1' / '-hit-2' on a hit) by swapping one img's src.
    // Tiers 1-5 follow the vocab tiers. 6-8 are late-game demons that MIX IN
    // with tier 5 (they still carry tier-5 words); their unlock levels live in
    // game.html ADMIN_DEFAULTS.levelTiers (tier6Start / 7 / 8).
    // 05-dokkaebi-jangsu is 05-dokkaebi with the purple hide shifted to
    // crimson (gold untouched) so the minion doesn't read as the 도깨비 대장
    // boss or the purple 두억시니.
    enemyTiers: {
      1: 'enemies/01-imp',
      2: 'enemies/02-gumiho',
      3: 'enemies/04-oni',
      4: 'enemies/06-jeoseung',
      5: 'enemies/03-cheonyeo',
      6: 'enemies/05-dokkaebi-jangsu',
      7: 'enemies/07-yeowang',
      8: 'enemies/08-yeomra'
    },

    // ─── Bestiary (요괴 도감) entries per regular tier ───────────────────────
    // Shown on the 도감 cards. Bosses carry their own roman / note fields.
    tierInfo: {
      1: { name: '도깨비',    roman: 'dokkaebi',        en: 'Goblin',                note: 'A prankster more than a villain. Beat one at 씨름 wrestling and it may pay you in gold.' },
      2: { name: '구미호',    roman: 'gumiho',          en: 'Nine-tailed fox',       note: 'A fox that lived a thousand years. The old stories say it eats a human liver to become human.' },
      3: { name: '두억시니',  roman: 'dueoksini',       en: 'Head-smashing demon',   note: 'A brute from folk tales that crushes heads with its fists. It hits hard and thinks slowly.' },
      4: { name: '저승사자',  roman: 'jeoseung saja',   en: 'Underworld messenger',  note: 'The reaper in a black 갓 hat. He carries a list of names, and he checks it twice.' },
      5: { name: '처녀귀신',  roman: 'cheonyeo gwisin', en: 'Maiden ghost',          note: 'A young woman who died with 한, a deep grudge. White dress, long black hair, unfinished business.' },
      6: { name: '도깨비 장수', roman: 'dokkaebi jangsu', en: 'Goblin general',        note: 'A veteran dokkaebi with a magic club. Strike the ground and shout 금 나와라, 뚝딱! for gold.' },
      7: { name: '무당 여왕',  roman: 'mudang yeowang',  en: 'Shaman queen',          note: 'Queen of the shamans who call spirits in the 굿 ritual. She vanishes between drum beats.' },
      8: { name: '염라대왕',  roman: 'yeomra daewang',  en: 'King of the Underworld', note: 'Judge of the dead. Every soul stands in his court and answers for what it did in life.' }
    },

    // ─── Enemy voice lines (speech bubbles) ─────────────────────────────────
    // Reading practice, so keep every line short and A1-A2 level.
    // spawn = taunt when it appears, death = cry when it is defeated.
    lines: {
      1: {
        spawn: [{ ko: '씨름 하자!', en: "Let's wrestle!" }, { ko: '메밀묵 줘!', en: 'Give me buckwheat jelly!' }, { ko: '나 배고파!', en: "I'm hungry!" }, { ko: '같이 놀자!', en: "Let's play!" }],
        death: [{ ko: '아야!', en: 'Ouch!' }, { ko: '내 메밀묵!', en: 'My buckwheat jelly!' }, { ko: '또 놀자!', en: 'Play again later!' }]
      },
      2: {
        spawn: [{ ko: '간 주세요.', en: 'Give me your liver.' }, { ko: '너 맛있겠다.', en: 'You look tasty.' }, { ko: '꼬리가 아홉 개!', en: 'Nine tails!' }, { ko: '사람이 되고 싶어.', en: 'I want to be human.' }],
        death: [{ ko: '내 간!', en: 'My liver!' }, { ko: '꼬리가 아파!', en: 'My tails hurt!' }, { ko: '다시 올게.', en: "I'll be back." }]
      },
      3: {
        spawn: [{ ko: '머리 조심해!', en: 'Watch your head!' }, { ko: '쾅! 쾅!', en: 'Bang! Bang!' }, { ko: '다 부술 거야!', en: "I'll smash it all!" }, { ko: '나는 힘이 세!', en: "I'm strong!" }],
        death: [{ ko: '머리 아파!', en: 'My head hurts!' }, { ko: '졌다!', en: 'I lost!' }, { ko: '너무 세!', en: "You're too strong!" }]
      },
      4: {
        spawn: [{ ko: '이름이 뭐예요?', en: 'What is your name?' }, { ko: '명단에 있어요.', en: "You're on the list." }, { ko: '같이 가요.', en: 'Come with me.' }, { ko: '시간이 됐어요.', en: 'It is time.' }],
        death: [{ ko: '명단이 틀렸어!', en: 'The list was wrong!' }, { ko: '다음에 올게요.', en: "I'll come next time." }, { ko: '이름을 잃었어!', en: 'I lost the name!' }]
      },
      5: {
        spawn: [{ ko: '억울해…', en: "It isn't fair..." }, { ko: '나를 기억해?', en: 'Do you remember me?' }, { ko: '한이 많아요.', en: 'I have so much grief.' }, { ko: '왜 나만…', en: 'Why only me...' }],
        death: [{ ko: '이제 편해요.', en: "Now I'm at peace." }, { ko: '고마워요…', en: 'Thank you...' }, { ko: '안녕히…', en: 'Farewell...' }]
      },
      6: {
        spawn: [{ ko: '씨름 한 판!', en: 'One round of wrestling!' }, { ko: '금 나와라, 뚝딱!', en: 'Gold, come out! Ttukttak!' }, { ko: '내 방망이 봐!', en: 'Look at my club!' }, { ko: '메밀묵 내놔!', en: 'Hand over the jelly!' }],
        death: [{ ko: '씨름 졌다!', en: 'I lost the match!' }, { ko: '내 방망이!', en: 'My club!' }, { ko: '다음엔 이긴다!', en: "I'll win next time!" }]
      },
      7: {
        spawn: [{ ko: '굿을 하자.', en: "Let's start the ritual." }, { ko: '점을 봐 줄게.', en: "I'll read your fortune." }, { ko: '방울 소리 들려?', en: 'Do you hear the bells?' }, { ko: '네 운명이 보여.', en: 'I see your fate.' }],
        death: [{ ko: '점이 틀렸어!', en: 'My fortune was wrong!' }, { ko: '신이 떠났어…', en: 'The spirits left me...' }, { ko: '방울이 깨졌어!', en: 'My bells broke!' }]
      },
      8: {
        spawn: [{ ko: '죄를 말해라.', en: 'Tell me your sins.' }, { ko: '재판을 시작한다.', en: 'The trial begins.' }, { ko: '거짓말 하지 마라.', en: 'Do not lie.' }, { ko: '너를 심판한다.', en: 'I judge you.' }],
        death: [{ ko: '무죄다…', en: 'Not guilty...' }, { ko: '재판 끝!', en: 'The trial is over!' }, { ko: '너는 살아라.', en: 'You may live.' }]
      }
    },

    // Bubble frequency. Regular minions only (bosses use phaseLines).
    // Death lines are off (2026-10-16): too distracting mid-kill. The
    // `death` pools above are kept in case they come back.
    lineChance: { spawn: 0.20, death: 0 },

    // ─── Emoji fallbacks per tier ───────────────────────────────────────────
    // Used by spriteHtml's onerror swap when the PNG 404s.
    tierEmoji: {
      1: ['🐛','🦋','🐌','🐞','🦟','🪲','🐜'],
      2: ['👻','🧚','🐸','🦊','🐰','🦔','🐭'],
      3: ['🦅','🐺','🕷️','🦂','🦇','🦝','🐗'],
      4: ['👹','🧟','🐲','🦹','🧛','🦴'],
      5: ['👾','💀','🦖','🐍','🦑','🧞'],
      6: ['👹'],
      7: ['🔔'],
      8: ['👑'],
      boss: ['🐉','🦠','👹','💀']
    },

    // ─── Boss roster ────────────────────────────────────────────────────────
    // Bosses ship as <base>.png + <base>-step.png (NOT a 4-frame walk row).
    // buildMonsterEl branches on tier === 'boss' to pick the right suffix.
    // portrait (optional) = sprites/<portrait>.webp, the 384px close-up the
    // boss intro cutscene shows; bosses without one fall back to their sprite.
    // act = the LEVEL_ACTS level whose story card introduces this boss, so the
    // chapter text and the boss that appears always match (14 names 저승사자,
    // 23 names 한글왕). Bosses past Lv.23 cycle through the list in order.
    // A missing portrait file falls back to the sprite in playBossCutscene.
    // phaseLines = [phase 2, phase 3] taunts and defeatLine = last words,
    // shown in the boss speech bubble. roman / note feed the 요괴 도감.
    bosses: [
      { act: 23, sprite: 'enemies/08-hangeulwang',     portrait: 'portraits/hangeulwang', emoji: '🐉', name: '한글왕',         subtitle: 'Demon King of Hangeul',     flavor: '"All who would speak my tongue, kneel."',
        roman: 'hangeul-wang', note: 'The demon who stole the letters. Win them back one word at a time.',
        phaseLines: [{ ko: '아직 멀었다!', en: 'You are not there yet!' }, { ko: '무릎을 꿇어라!', en: 'Kneel!' }],
        defeatLine: { ko: '한글이… 빛난다…', en: 'Hangeul... shines...' } },
      { act: 5,  sprite: 'enemies/02-gumiho-mini',     portrait: 'portraits/gumiho',      emoji: '🦊', name: '구미호 여왕',     subtitle: 'Queen of Nine Tails',      flavor: '"Your syllables taste like fear, little one."',
        roman: 'gumiho yeowang', note: 'The oldest fox in the forest, one liver away from becoming human.',
        phaseLines: [{ ko: '꼬리가 더 있어!', en: 'I have more tails!' }, { ko: '네 간은 내 거야!', en: 'Your liver is mine!' }],
        defeatLine: { ko: '천 년이… 끝났어.', en: 'A thousand years... over.' } },
      { act: 9,  sprite: 'enemies/05-dokkaebi-elder',  portrait: 'portraits/dokkaebi',    emoji: '👹', name: '도깨비 대장',     subtitle: 'Goblin Chieftain',         flavor: '"Hahaha! Type if you dare, mortal!"',
        roman: 'dokkaebi daejang', note: 'Chief of the forest goblins. Very loud, very proud, and a bad loser.',
        phaseLines: [{ ko: '방망이, 뚝딱!', en: 'Magic club, ttukttak!' }, { ko: '씨름으로 끝내자!', en: "Let's settle it with ssireum!" }],
        defeatLine: { ko: '졌다! 메밀묵 줄게!', en: 'I lose! Have some jelly!' } },
      { act: 14, sprite: 'enemies/06-jeoseung-saja',   portrait: 'portraits/jeoseung',    emoji: '🪦', name: '저승사자',        subtitle: 'Reaper of the Underworld', flavor: '"Your ledger… is incomplete."',
        roman: 'jeoseung saja', note: 'The senior reaper who keeps the master list. Nobody leaves it early.',
        phaseLines: [{ ko: '명단을 다시 본다.', en: 'Checking the list again.' }, { ko: '네 이름을 부른다.', en: 'I call your name.' }],
        defeatLine: { ko: '명단에… 없네.', en: "You're... not on the list." } },
      { act: 19, sprite: 'enemies/03-cheonyeo-gwisin', portrait: 'portraits/cheonyeo',    emoji: '👻', name: '처녀귀신',        subtitle: 'Maiden of Vengeance',      flavor: '"You forgot me. I have not forgotten you."',
        roman: 'cheonyeo gwisin', note: 'The first of the maiden ghosts. Her grudge has waited a hundred years.',
        phaseLines: [{ ko: '더 억울해!', en: 'It is even more unfair!' }, { ko: '나를 잊지 마!', en: "Don't forget me!" }],
        defeatLine: { ko: '이제… 가요.', en: 'Now... I go.' } }
    ],

    // ─── Per-tier sprite sizes (px) on the battle stage ─────────────────────
    // Used by buildMonsterEl. Sized RELATIVE TO THE PLAYER back-view sprite
    // (renderPlayerSprite renders it at 237px): tier 1 (imp) ≈ half the player
    // (reaches his stomach when they stand together); tier 2 (gumiho) a touch
    // bigger; tier 4 (jeoseung "floating guy") ≈ the player's full height;
    // tier 5 a touch bigger. game.html multiplies both by spriteScale() on
    // short stages (phones). Keep this in sync with MONSTER_BASE_PX in game.html.
    // Tiers 6-8: the dokkaebi and yeomra art fills more of its 512 frame, so
    // the box sizes are smaller than the visual size step suggests.
    tierSizePx: {
      1: 119,
      2: 150,
      3: 190,
      4: 237,
      5: 270,
      6: 245,
      7: 275,
      8: 330,
      boss: 351
    },

    // ─── Death-burst particle colors per tier ───────────────────────────────
    // Picked from each demon's sprite so the chips read as pieces of it.
    // Consumed by particleBurst via tierParticleColors() in game.html.
    tierParticles: {
      1:    ['#1f2937', '#d4a017', '#f59e0b', '#fb923c'],   // imp: soot + brass horn
      2:    ['#ffffff', '#fee2e2', '#dc2626', '#fca5a5'],   // gumiho: white fur + red marks
      3:    ['#3730a3', '#4c1d95', '#dc2626', '#d4a017'],   // oni: indigo robe + red sash
      4:    ['#111827', '#374151', '#d4a017', '#fbbf24'],   // jeoseung: black gat + lantern
      5:    ['#f8fafc', '#cbd5e1', '#93c5fd', '#1f2937'],   // cheonyeo: pale robe + hair
      6:    ['#7a2430', '#4a1820', '#e0a030', '#7a4a1e'],   // dokkaebi general: crimson hide + tiger pelt
      7:    ['#d62828', '#1d4ed8', '#f4c430', '#f8fafc'],   // shaman queen: 오방색 robe + bells
      8:    ['#111827', '#e85d24', '#ffb703', '#5b3a6e'],   // yeomra: black robe + hellfire
      boss: ['#fbbf24', '#dc2626', '#fff7ed', '#7c3aed']
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
