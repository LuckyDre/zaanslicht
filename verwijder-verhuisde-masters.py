#!/usr/bin/env python3
"""
Verwijdert lokaal alléén de bestanden die in ~/.zl-r2-verhuis.log staan — dat is
precies de verzameling waarvan met een volledige GET + bytevergelijking bewezen is
dat ze in R2 staan. Zo kan er nooit iets weg dat niet elders bestaat.

Veiligheidsnetten:
  - een pad dat niet bestaat wordt overgeslagen (al weg)
  - een pad waarvan de bytegrootte afwijkt van het logboek wordt GEWEIGERD
  - -thumb en -groot worden nooit aangeraakt (staan niet in het logboek)
"""
import sys
from pathlib import Path
from urllib.parse import unquote

LOG    = Path.home() / '.zl-r2-verhuis.log'
IMAGES = Path.home() / 'fotografie-site' / 'images'
DROOG  = '--uitvoeren' not in sys.argv

weg, mist, mismatch, bytes_vrij = [], [], [], 0

for regel in LOG.read_text().splitlines():
    if not regel.strip():
        continue
    key, grootte = regel.split('\t')
    rel = unquote(key[len('eigen/'):])
    pad = IMAGES / rel

    if not pad.exists():
        mist.append(rel)
        continue
    if pad.stat().st_size != int(grootte):
        mismatch.append((rel, pad.stat().st_size, int(grootte)))
        continue

    assert '-thumb' not in pad.name and '-groot' not in pad.name, f'NOOIT: {rel}'
    weg.append(pad)
    bytes_vrij += pad.stat().st_size

print(f'te verwijderen : {len(weg)}  ({bytes_vrij / 1024**3:.2f} GB)')
print(f'al weg         : {len(mist)}')
print(f'GEWEIGERD      : {len(mismatch)}')
for rel, lokaal, gelogd in mismatch:
    print(f'   {rel}: lokaal {lokaal} != gelogd {gelogd}')

if mismatch:
    print('\n⛔ Afwijkende bytegroottes — niets verwijderd.')
    sys.exit(1)

if DROOG:
    print('\n(droge loop — geef --uitvoeren om echt te verwijderen)')
    for p in weg[:3]:
        print(f'   zou weg: {p.relative_to(IMAGES)}')
else:
    for p in weg:
        p.unlink()
    # lege mappen opruimen (bv. images/_originelen/)
    for d in sorted(IMAGES.rglob('*'), key=lambda x: -len(x.parts)):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()
            print(f'   lege map weg: {d.relative_to(IMAGES)}')
    print(f'\n✅ {len(weg)} bestanden verwijderd, {bytes_vrij / 1024**3:.2f} GB vrijgemaakt.')
