// Highlight regression tests.
// Verifies every precomposed Hangul syllable has exactly one active jamo
// at every keystroke position.
// Run: node test-highlight.mjs

// Imports the REAL shipped engine (hangul-ime.js): no inline copy.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { syllableToKeystrokes } = require('./hangul-ime.js');

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
