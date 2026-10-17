#!/usr/bin/env python3
"""Rebuild the pixel UI font subsets in fonts/ from a Galmuri release.

Usage: python3 tools/subset-ui-font.py /path/to/galmuri/package/dist

Galmuri (OFL-1.1, https://github.com/quiple/galmuri) is subset to ASCII,
Latin-1 punctuation, a few symbols, and every Hangul syllable or jamo that
appears in the UI source files. Target words (vocab.js) draw in Noto Sans KR,
so they are left out on purpose. The subsets are renamed "TH Pixel" because
"Galmuri" is a Reserved Font Name and a subset is a Modified Version.
Rerun this after adding Hangul to UI copy. Needs fonttools + brotli.
"""
import os
import subprocess
import sys

from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI_SOURCES = ['index.html', 'game.html', 'battle-config.js', 'shared.js']
LATIN = ('U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-203A,U+2190-2193,'
         'U+25A0-25FF,U+2600-2606,U+2713,U+00D7')
MONO = 'U+0020-007E,U+00B7,U+00D7,U+2013,U+2014,U+2212'
OUTPUTS = [
    ('Galmuri11.ttf', 'galmuri11-ui.woff2', 'TH Pixel', 'Regular', True),
    ('Galmuri11-Bold.ttf', 'galmuri11-bold-ui.woff2', 'TH Pixel', 'Bold', True),
    ('GalmuriMono11.ttf', 'galmurimono11-ui.woff2', 'TH Pixel Mono', 'Regular', False),
]


def ui_hangul():
    chars = set()
    for name in UI_SOURCES:
        with open(os.path.join(ROOT, name), encoding='utf-8') as f:
            chars.update(c for c in f.read()
                         if 0xAC00 <= ord(c) <= 0xD7A3 or 0x3131 <= ord(c) <= 0x318E)
    return ''.join(sorted(chars))


def rename(path, family, style):
    font = TTFont(path)
    ps = (family + '-' + style).replace(' ', '')
    full = family if style == 'Regular' else family + ' ' + style
    table = font['name']
    for rec in table.names:
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID in (2, 17):
            rec.string = style
        elif rec.nameID == 3:
            rec.string = ps + ';subset'
        elif rec.nameID == 4:
            rec.string = full
        elif rec.nameID == 6:
            rec.string = ps
    for nid in (21, 22, 25):
        table.removeNames(nameID=nid)
    font.save(path)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    dist = sys.argv[1]
    hangul = ui_hangul()
    out_dir = os.path.join(ROOT, 'fonts')
    os.makedirs(out_dir, exist_ok=True)
    for src, out, family, style, with_hangul in OUTPUTS:
        dest = os.path.join(out_dir, out)
        cmd = ['pyftsubset', os.path.join(dist, src), '--flavor=woff2',
               '--output-file=' + dest]
        if with_hangul:
            cmd += ['--unicodes=' + LATIN, '--text=' + hangul]
        else:
            cmd += ['--unicodes=' + MONO]
        subprocess.run(cmd, check=True)
        rename(dest, family, style)
        print(f'{out}: {os.path.getsize(dest)} bytes')
    print(f'{len(hangul)} Hangul characters')


if __name__ == '__main__':
    main()
