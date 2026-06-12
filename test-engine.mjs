// Quick correctness test for the Hangul composition engine
// Run: node test-engine.mjs
// Imports the REAL shipped engine (hangul-ime.js): no inline copy, so a
// table or composition change in production is what gets tested.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { KEYMAP, HangulIME } = require('./hangul-ime.js');

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

process.exit((failed + f2 + f3) > 0 ? 1 : 0);
