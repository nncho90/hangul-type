# Hangul Type — Market Research

## Existing solutions

| Tool | Audience | Platform | Verdict |
|------|----------|----------|---------|
| 한컴타자연습 (Hancom) | Koreans | Web | Default in KR schools, dated, assumes Hangul fluency |
| TadakTadak | Koreans | Web | Korean-only UI |
| type.sam.today | Foreigners | Web | Closest competitor. Solo-dev, TOPIK 1 only, no mobile, no gamification |
| Hangul – Type Korean (iOS/Android) | Foreigners | Mobile | "Serves an ad after every single word" (verbatim review). Keyboard bugs |
| TypeRacer Korean | Intermediate+ | Web | Useless for beginners |
| 10FastFingers Korean | Both | Web | Test only, no teaching |
| Hangul Attack (GoBilly) | Foreigners | Web | One-trick game. Users want slower mode for beginners |
| Memrise Typing Korean | Foreigners | Web | Slow, dated, abandoned-feeling |
| LKI Korean Typing Tutor | Foreigners | Web | Static, basic, no adaptivity |
| SayJack Dubeolsik trainer | Foreigners | Web | Targets the right concept, abandoned UX |
| Taza | Sebeolsik enthusiasts | macOS | Niche, paid |
| Cheonjiin trainer (Naver) | Elderly Koreans | Android | Korean-language UI |

**Notable**: TypingClub does NOT have a Korean course (often confused for one).

## What research says about teaching typing

- Motor skill, not knowledge. Two 15-minute sessions/day beat one 60-minute session.
- Accuracy first, speed follows. Backspacing wastes more time than slowing down.
- Deliberate practice on weak keys. Identify miss-prone bigrams, drill in isolation, then in context.
- Foundation, then gamify. Proper finger placement first, layer XP/levels for retention.
- Real content over nonsense drills. Vocab acquisition co-benefit for L2 learners.
- Multi-sensory: audio + visual finger-cue + key prompt outperforms silent drills.

## Korean-specific pain points

1. **Composition layer is the real pain.** Beginners struggle with: jamo-to-syllable timing (when does ㄱ + ㅏ + ㅁ become 감 vs 가 ㅁ?), shift-key double consonants (ㄲㄸㅃㅆㅉ), double batchim (ㄶㄻㄺ), and knowing whether the next consonant attaches as batchim or starts a new syllable. **No existing tool surfaces this conceptually**, only "wrong key."

2. **OS IME is broken everywhere.** GitHub issues for Korean IME bugs in Claude Code, Gemini CLI, Ghostty, Zed, Firefox, AppFlowy. A webapp shipping its own composition engine sidesteps this entirely.

3. **Dubeolsik (두벌식) is the only practical target.** ~99% of Koreans use it.

4. **Mobile = different game.** Cheonjiin (천지인) vs QWERTY-Hangul vs Naratgeul. No tool teaches mobile Korean typing to foreigners in English.

## User pain (verbatim quotes)

- "It took me forever to type a decent sentence."
- "I struggled a lot at remembering the correct key for each character."
- "It took me forever and seemed so tedious."
- "I do wish there was a way to make the letters fall more slowly for beginners." (Hangul Attack)
- "This app serves an ad after every single word." (App Store review of Hangul-Type-Korean)
- 90DayKorean lists beginner pains: "memorizing spelling, understanding the correct order for double vowel words, being slow, mistyping from not knowing the keyboard layout."

Dominant sentiment: "I just powered through it." Nobody recommends a single product enthusiastically. **That is the gap signal.**

## The gap (synthesized)

1. Foreigner-first adaptive jamo trainer
2. IME-aware error feedback (jamo-vs-batchim composition)
3. Mobile-native Korean typing trainer for foreigners
4. Vocab + typing co-learning (KOEN integration)
5. No-ad, no-IME-friction web product

## Recommendation: BUILD, narrow

Strongest gap = #1 + #2: adaptive, IME-aware Hangul typing trainer for English-speaking Korean learners, mobile-first, integrated with KOEN vocab.

Why:
- KOEN has ~5M downloads of the exact target audience. Distribution solved.
- Existing tools are Korean-only, abandoned, one-trick, or ad-hostile.
- IME-aware error model (jamo-vs-batchim composition feedback) is genuinely novel and defensible. Requires linguistic engineering, not just a typing engine.
- Reinforces KOEN's loop: vocab → reading → typing → output. Currently no production-side practice in KOEN.

## MVP (4–6 weeks)

- Web app, mobile-responsive, no app store
- 50 KOEN-aligned beginner words, 20 sentences
- Custom in-browser Hangul composition engine (no OS IME dependency)
- Per-jamo accuracy tracking + spaced repetition queue of weak jamo
- Novel feedback mode: "you typed 가ㅁ, meant 감? Hold the next consonant as batchim" with visual block diagram
- Ship to a 500-user KOEN segment, measure: D7 retention, time-to-30-WPM, conversion to KOEN paid

## Validation criteria

- D7 retention > 25%
- 60%+ of testers say "I wish this existed when I started" in qual feedback
- Net-new KOEN signups attributable to the typing tool > 5% of MAU exposed

## Sources

- 90DayKorean — Korean Typing Practice
- FluentU — Korean Typing Practice
- Lingomae — 6 Korean Typing Practice Websites
- Hancom Taja
- type.sam.today
- Hangul – Type Korean (App Store)
- SayJack Dubeolsik trainer
- Wikipedia — Korean language and computers
- Cheonjiin keyboard (Namuwiki)
- Naratgeul Korean Mobile Keyboard (FutureLearn)
- Loving Korean — Touch typing Korean with all ten fingers
- Hangul Attack (GoBillyKorean)
- Taza on Mac App Store
- Korean IME bug threads on GitHub
- Rocket Typing — How to increase typing speed
- Springer — Using Gamification to Improve Students' Typing Skills
