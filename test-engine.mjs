// Quick correctness test for the Hangul composition engine
// Run: node test-engine.mjs
// Imports the REAL shipped engine (hangul-ime.js): no inline copy, so a
// table or composition change in production is what gets tested.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { KEYMAP, HangulIME, wordToKeystrokes } = require('./hangul-ime.js');

function typeString(input) {
  const ime = new HangulIME();
  for (const ch of input) {
    if (ch === ' ') {
      ime.commitBuffer();
      ime.committed += ' ';
      continue;
    }
    const jamo = KEYMAP[ch];
    if (jamo) ime.type(jamo);
  }
  ime.commitBuffer();
  return ime.display;
}

const cases = [
  // QWERTY input -> expected Korean output
  { in: 'dkssud',     out: '안녕',  desc: '안녕 (hello)' },
  { in: 'rkatk',      out: '감사',  desc: '감사 (thanks)' },
  { in: 'tkfkd',      out: '사랑',  desc: '사랑 (love)' },
  { in: 'clsrn',      out: '친구',  desc: '친구 (friend)' },
  { in: 'gkrry',      out: '학교',  desc: '학교 (school)' },
  { in: 'dmatlr',     out: '음식',  desc: '음식 (food)' },
  { in: 'cor',        out: '책',    desc: '책 (book)' },
  { in: 'wlq',        out: '집',    desc: '집 (house)' },
  { in: 'rkwhr',      out: '가족',  desc: '가족 (family)' },
  { in: 'skan',       out: '나무',  desc: '나무 (tree)' },
  { in: 'gksmf',      out: '하늘',  desc: '하늘 (sky)' },
  { in: 'tlrks',      out: '시간',  desc: '시간 (time)' },
  { in: 'tkfka',      out: '사람',  desc: '사람 (person)' },
  { in: 'gksrnr',     out: '한국',  desc: '한국 (Korea)' },
  { in: 'duddj',      out: '영어',  desc: '영어 (English)' },
  { in: 'gkrtod',     out: '학생',  desc: '학생 (student): ㅅ initial of new syllable' },
  { in: 'whgdk',      out: '좋아',  desc: '좋아: kick-out rule' },
  { in: 'aldks',      out: '미안',  desc: '미안 (sorry)' },
  { in: 'dhkdy',      out: '와요',  desc: '와요: compound vowel ㅘ (ㅇ initial required)' },
  { in: 'dmlwk',      out: '의자',  desc: '의자: compound vowel ㅢ' }
];

let passed = 0, failed = 0;
for (const c of cases) {
  const got = typeString(c.in);
  const ok = got === c.out;
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.desc.padEnd(35)}  in="${c.in}"  expected="${c.out}"  got="${got}"`);
}

console.log(`\n${passed}/${passed + failed} cases passed`);

// Additional vocab covering compound finals + kick-out
const moreCases = [
  { in: 'dlfrek', out: '읽다', desc: '읽다: compound final ㄺ (ㄹ+ㄱ)' },
  { in: 'tlfgdjdy', out: '싫어요', desc: '싫어요: compound final ㅀ + kick-out' },
  { in: 'rlQmek', out: '기쁘다', desc: '기쁘다: ㅃ shifted Q' },
  { in: 'ehtjrhks', out: '도서관', desc: '도서관: ㅘ compound vowel' },
  { in: 'quddnjs', out: '병원', desc: '병원: ㅝ compound vowel' },
  { in: 'woaldlTek', out: '재미있다', desc: '재미있다: ㅆ batchim (Shift+T)' }
];

let p2 = 0, f2 = 0;
console.log('\n--- Extended vocab ---');
for (const c of moreCases) {
  const got = typeString(c.in);
  const ok = got === c.out;
  if (ok) p2++; else f2++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.desc.padEnd(45)}  in="${c.in}"  expected="${c.out}"  got="${got}"`);
}
console.log(`${p2}/${p2 + f2} extended cases passed`);

// Sentence-level tests (US-001)
const sentenceCases = [
  { in: 'dkssudgktpdy', out: '안녕하세요', desc: '안녕하세요 (no space, multi-syllable)' },
  { in: 'akssktj qksrkdnjdy', out: '만나서 반가워요', desc: '만나서 반가워요 (with space, ㅝ compound)' },
  { in: 'wjsms gkrtoddldpdy', out: '저는 학생이에요', desc: '저는 학생이에요 (particle 는, batchim ㅅ)' }
];

let p3 = 0, f3 = 0;
console.log('\n--- Sentences (US-001) ---');
for (const c of sentenceCases) {
  const got = typeString(c.in);
  const ok = got === c.out;
  if (ok) p3++; else f3++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.desc.padEnd(45)}  in="${c.in}"  expected="${c.out}"  got="${got}"`);
}
console.log(`${p3}/${p3 + f3} sentence cases passed`);

// Backspace across a syllable boundary. Mirrors index.html: each backspace
// drops one accepted keystroke and the IME is rebuilt by replaying the
// remaining prefix, so a syllable committed by the next jamo (학 in 학교)
// reopens correctly instead of being deleted whole.
function typeWithBackspace(word, backspaces) {
  const ks = wordToKeystrokes(word);
  let pos = ks.length;
  let ime = HangulIME.fromKeystrokes(ks);
  const afterFull = ime.display;
  for (let i = 0; i < backspaces && pos > 0; i++) {
    pos--;
    ime = HangulIME.fromKeystrokes(ks.slice(0, pos));
  }
  const afterBack = ime.display;
  for (const j of ks.slice(pos)) {
    if (j === ' ') { ime.commitBuffer(); ime.committed += ' '; } else ime.type(j);
  }
  ime.commitBuffer();
  return { afterFull, afterBack, final: ime.display };
}

const backspaceCases = [
  { word: '학교', n: 3, mid: '하', desc: '학교: 3 backspaces reopens 학 as 하' },
  { word: '학교', n: 2, mid: '학', desc: '학교: 2 backspaces leaves 학 intact' },
  { word: '안녕', n: 3, mid: '안', desc: '안녕: 3 backspaces back to 안' },
  { word: '안녕', n: 4, mid: '아', desc: '안녕: 4 backspaces reopens 안 as 아' },
  { word: '좋아', n: 2, mid: '좋', desc: '좋아: undo kick-out restores batchim ㅎ' },
  { word: '읽다', n: 3, mid: '일', desc: '읽다: compound final ㄺ splits back to ㄹ' },
  { word: '만나서 반가워요', n: 11, mid: '만나서', desc: 'sentence: backspace through the space' }
];

let p4 = 0, f4 = 0;
console.log('\n--- Backspace across syllables ---');
for (const c of backspaceCases) {
  const r = typeWithBackspace(c.word, c.n);
  const ok = r.afterFull === c.word && r.afterBack === c.mid && r.final === c.word;
  if (ok) p4++; else f4++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.desc.padEnd(45)}  mid="${r.afterBack}" final="${r.final}"`);
}
console.log(`${p4}/${p4 + f4} backspace cases passed`);

// The old in-place backspace() could not reopen a committed syllable: this
// documents why the UI replays instead (학교 x3 would finish as "ㄱ교").
{
  const ime = new HangulIME();
  for (const j of wordToKeystrokes('학교')) ime.type(j);
  ime.backspace(); ime.backspace(); ime.backspace();
  const stale = ime.display;
  const ok = stale !== '하';
  if (ok) p4++; else f4++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  in-place backspace() is lossy (got "${stale}"), replay needed`);
}

process.exit((failed + f2 + f3 + f4) > 0 ? 1 : 0);
