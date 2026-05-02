// Highlight regression tests.
// Verifies every precomposed Hangul syllable has exactly one active jamo
// at every keystroke position.
// Run: node test-highlight.mjs

const INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const MEDIALS  = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const FINALS   = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const VOWEL_DECOMPOSE = {
  'ㅘ':['ㅗ','ㅏ'], 'ㅙ':['ㅗ','ㅐ'], 'ㅚ':['ㅗ','ㅣ'],
  'ㅝ':['ㅜ','ㅓ'], 'ㅞ':['ㅜ','ㅔ'], 'ㅟ':['ㅜ','ㅣ'],
  'ㅢ':['ㅡ','ㅣ']
};
const FINAL_DECOMPOSE = {
  'ㄳ':['ㄱ','ㅅ'], 'ㄵ':['ㄴ','ㅈ'], 'ㄶ':['ㄴ','ㅎ'],
  'ㄺ':['ㄹ','ㄱ'], 'ㄻ':['ㄹ','ㅁ'], 'ㄼ':['ㄹ','ㅂ'], 'ㄽ':['ㄹ','ㅅ'],
  'ㄾ':['ㄹ','ㅌ'], 'ㄿ':['ㄹ','ㅍ'], 'ㅀ':['ㄹ','ㅎ'],
  'ㅄ':['ㅂ','ㅅ']
};

function syllableToKeystrokes(syl) {
  const code = syl.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return [syl];
  const x = code - 0xAC00;
  const i = INITIALS[Math.floor(x / 588)];
  const m = MEDIALS[Math.floor((x % 588) / 28)];
  const f = FINALS[x % 28];
  const ks = [i];
  ks.push(...(VOWEL_DECOMPOSE[m] || [m]));
  if (f) ks.push(...(FINAL_DECOMPOSE[f] || [f]));
  return ks;
}

function jamoStateClass(idx, posKs, errFlashIdx = -1) {
  if (idx < posKs) return 'done';
  if (idx === posKs) return errFlashIdx === idx ? 'err' : 'now';
  return '';
}

function tokenStates(ks, posKs, errFlashIdx = -1) {
  return ks.map((_, idx) => jamoStateClass(idx, posKs, errFlashIdx));
}

let checked = 0;
const failures = [];

for (let code = 0xAC00; code <= 0xD7A3; code++) {
  const syl = String.fromCharCode(code);
  const ks = syllableToKeystrokes(syl);
  for (let pos = 0; pos < ks.length; pos++) {
    const states = tokenStates(ks, pos);
    const nowCount = states.filter(s => s === 'now').length;
    const activeIdx = states.indexOf('now');
    checked++;
    if (nowCount !== 1 || activeIdx !== pos) {
      failures.push(`${syl} ${ks.join('')} pos=${pos} states=${states.join(',')}`);
      if (failures.length >= 10) break;
    }

    const errStates = tokenStates(ks, pos, pos);
    const errCount = errStates.filter(s => s === 'err').length;
    if (errCount !== 1 || errStates.indexOf('err') !== pos) {
      failures.push(`${syl} ${ks.join('')} err pos=${pos} states=${errStates.join(',')}`);
      if (failures.length >= 10) break;
    }
  }
  if (failures.length >= 10) break;
}

if (failures.length) {
  console.log('FAIL  one-active-jamo invariant');
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}

console.log(`PASS  one-active-jamo invariant across ${checked} syllable cursor positions`);
