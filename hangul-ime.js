// ============================================================
// Hangul composition engine: shared by index.html and game.html
// Canonical source: index.html (game.html's copy mirrors this)
// ============================================================

const INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const MEDIALS  = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const FINALS   = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const KEYMAP = {
  'q':'ㅂ','w':'ㅈ','e':'ㄷ','r':'ㄱ','t':'ㅅ','y':'ㅛ','u':'ㅕ','i':'ㅑ','o':'ㅐ','p':'ㅔ',
  'a':'ㅁ','s':'ㄴ','d':'ㅇ','f':'ㄹ','g':'ㅎ','h':'ㅗ','j':'ㅓ','k':'ㅏ','l':'ㅣ',
  'z':'ㅋ','x':'ㅌ','c':'ㅊ','v':'ㅍ','b':'ㅠ','n':'ㅜ','m':'ㅡ',
  'Q':'ㅃ','W':'ㅉ','E':'ㄸ','R':'ㄲ','T':'ㅆ','O':'ㅒ','P':'ㅖ'
};

// Reverse: jamo -> {key, shift}
const JAMO_TO_KEY = {};
for (const [k, v] of Object.entries(KEYMAP)) {
  JAMO_TO_KEY[v] = { key: k.toLowerCase(), shift: k !== k.toLowerCase() };
}

const VOWEL_COMPOUND = {
  'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ',
  'ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ',
  'ㅡㅣ':'ㅢ'
};
const VOWEL_DECOMPOSE = {
  'ㅘ':['ㅗ','ㅏ'],'ㅙ':['ㅗ','ㅐ'],'ㅚ':['ㅗ','ㅣ'],
  'ㅝ':['ㅜ','ㅓ'],'ㅞ':['ㅜ','ㅔ'],'ㅟ':['ㅜ','ㅣ'],
  'ㅢ':['ㅡ','ㅣ']
};

const FINAL_COMPOUND = {
  'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ',
  'ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ',
  'ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ',
  'ㅂㅅ':'ㅄ'
};
const FINAL_DECOMPOSE = {
  'ㄳ':['ㄱ','ㅅ'],'ㄵ':['ㄴ','ㅈ'],'ㄶ':['ㄴ','ㅎ'],
  'ㄺ':['ㄹ','ㄱ'],'ㄻ':['ㄹ','ㅁ'],'ㄼ':['ㄹ','ㅂ'],'ㄽ':['ㄹ','ㅅ'],
  'ㄾ':['ㄹ','ㅌ'],'ㄿ':['ㄹ','ㅍ'],'ㅀ':['ㄹ','ㅎ'],
  'ㅄ':['ㅂ','ㅅ']
};

const CONSONANTS = new Set('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split(''));
const VOWELS_BASIC = new Set('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣ'.split(''));

function composeSyllable(initial, medial, final) {
  const i = INITIALS.indexOf(initial);
  const m = MEDIALS.indexOf(medial);
  const f = FINALS.indexOf(final || '');
  if (i < 0 || m < 0) return (initial || '') + (medial || '') + (final || '');
  return String.fromCharCode(0xAC00 + i * 588 + m * 28 + f);
}

// Decompose a Hangul syllable to keystrokes (sequence of basic jamo from KEYMAP)
function syllableToKeystrokes(syl) {
  const code = syl.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) {
    // Not a precomposed Hangul syllable: return as is
    return [syl];
  }
  const x = code - 0xAC00;
  const i = INITIALS[Math.floor(x / 588)];
  const m = MEDIALS[Math.floor((x % 588) / 28)];
  const f = FINALS[x % 28];

  const ks = [i];
  // Decompose medial if compound
  if (VOWEL_DECOMPOSE[m]) {
    ks.push(...VOWEL_DECOMPOSE[m]);
  } else {
    ks.push(m);
  }
  // Decompose final if compound
  if (f) {
    if (FINAL_DECOMPOSE[f]) {
      ks.push(...FINAL_DECOMPOSE[f]);
    } else {
      ks.push(f);
    }
  }
  return ks;
}

// Convert a Korean word into the expected basic-jamo sequence
function wordToKeystrokes(word) {
  const ks = [];
  for (const ch of word) {
    if (ch === ' ') { ks.push(' '); continue; }
    ks.push(...syllableToKeystrokes(ch));
  }
  return ks;
}

// Same, but grouped per syllable, so the UI can show syllable boundaries
function wordToSyllableKeystrokes(word) {
  const out = [];
  for (const ch of word) {
    if (ch === ' ') { out.push([' ']); continue; }
    out.push(syllableToKeystrokes(ch));
  }
  return out;
}

// ============================================================
// IME state machine
// ============================================================

class HangulIME {
  constructor() { this.reset(); }
  reset() {
    this.committed = '';
    this.buf = { initial: '', medial: '', final: '' };
  }

  get display() {
    let out = this.committed;
    if (this.buf.initial || this.buf.medial || this.buf.final) {
      out += composeSyllable(this.buf.initial, this.buf.medial, this.buf.final);
    }
    return out;
  }

  // Returns the in-progress part separately so the UI can color it
  get parts() {
    let composing = '';
    if (this.buf.initial || this.buf.medial || this.buf.final) {
      composing = composeSyllable(this.buf.initial, this.buf.medial, this.buf.final);
    }
    return { committed: this.committed, composing };
  }

  commitBuffer() {
    if (this.buf.initial || this.buf.medial || this.buf.final) {
      this.committed += composeSyllable(this.buf.initial, this.buf.medial, this.buf.final);
    }
    this.buf = { initial: '', medial: '', final: '' };
  }

  type(jamo) {
    const isCons = CONSONANTS.has(jamo);
    const isVow = VOWELS_BASIC.has(jamo);
    if (!isCons && !isVow) return;

    if (isCons) this._typeConsonant(jamo);
    else this._typeVowel(jamo);
  }

  _typeConsonant(c) {
    const b = this.buf;
    if (!b.initial && !b.medial && !b.final) {
      b.initial = c;
    } else if (b.initial && !b.medial) {
      // Two consonants in a row, no vowel: commit first as orphan, start new
      this.commitBuffer();
      this.buf.initial = c;
    } else if (b.initial && b.medial && !b.final) {
      // Try to set as final
      if (FINALS.includes(c)) {
        b.final = c;
      } else {
        // ㄸ ㅃ ㅉ can't be finals
        this.commitBuffer();
        this.buf.initial = c;
      }
    } else if (b.initial && b.medial && b.final) {
      // Try compound final
      const compound = FINAL_COMPOUND[b.final + c];
      if (compound) {
        b.final = compound;
      } else {
        this.commitBuffer();
        this.buf.initial = c;
      }
    }
  }

  _typeVowel(v) {
    const b = this.buf;
    if (!b.initial && !b.medial) {
      // Orphan vowel
      this.committed += v;
      return;
    }
    if (b.initial && !b.medial) {
      b.medial = v;
      return;
    }
    if (b.initial && b.medial && !b.final) {
      const compound = VOWEL_COMPOUND[b.medial + v];
      if (compound) {
        b.medial = compound;
      } else {
        // Commit current, then orphan vowel
        this.commitBuffer();
        this.committed += v;
      }
      return;
    }
    if (b.initial && b.medial && b.final) {
      // Kick-out rule: last jamo of final moves to be initial of new syllable
      const finalDecomposed = FINAL_DECOMPOSE[b.final] || [b.final];
      const newInitial = finalDecomposed[finalDecomposed.length - 1];
      const remainingFinal = finalDecomposed.length > 1 ? finalDecomposed.slice(0, -1).join('') : '';

      // Re-compose remaining final (might still be compound after remove)
      let rfFinal = '';
      if (remainingFinal.length === 1) rfFinal = remainingFinal;
      else if (remainingFinal.length > 1) rfFinal = FINAL_COMPOUND[remainingFinal] || remainingFinal[0];

      // Commit syllable with reduced final
      this.committed += composeSyllable(b.initial, b.medial, rfFinal);
      this.buf = { initial: newInitial, medial: v, final: '' };
    }
  }

  backspace() {
    const b = this.buf;
    if (b.final) {
      // If compound final, remove last; else clear
      const dec = FINAL_DECOMPOSE[b.final];
      if (dec) b.final = dec[0];
      else b.final = '';
      return;
    }
    if (b.medial) {
      const dec = VOWEL_DECOMPOSE[b.medial];
      if (dec) b.medial = dec[0];
      else b.medial = '';
      return;
    }
    if (b.initial) {
      b.initial = '';
      return;
    }
    if (this.committed.length) {
      this.committed = this.committed.slice(0, -1);
    }
  }
}

// CommonJS export guard for Node.js test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    INITIALS, MEDIALS, FINALS, KEYMAP, JAMO_TO_KEY,
    VOWEL_COMPOUND, VOWEL_DECOMPOSE, FINAL_COMPOUND, FINAL_DECOMPOSE,
    CONSONANTS, VOWELS_BASIC,
    composeSyllable, syllableToKeystrokes, wordToKeystrokes, wordToSyllableKeystrokes,
    HangulIME
  };
}
