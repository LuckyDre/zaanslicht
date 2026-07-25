#!/usr/bin/env python3
"""
Genereert -groot.webp (2200px) voor eigen foto's die BREDER zijn dan 2200px.

Waarom een derde formaat naast het origineel en -thumb.webp:
  -thumb.webp (400px)  → rasters en sliders
  -groot.webp (2200px) → de lightbox (foto groot bekijken)
  origineel            → alleen nog de downloadknop, blijft dus volle kwaliteit

Een deel van de bibliotheek staat op camera-resolutie (tot 6960px / 7 MB per
foto). Die in de lightbox laden kostte ~30x meer data dan nodig.

Foto's die al 2200px of smaller zijn krijgen GEEN -groot.webp; de site valt
daar automatisch terug op het origineel.

Gebruik: python3 maak-groot.py [--dry-run]
"""
from pathlib import Path
import subprocess, sys

SITE   = Path(__file__).parent
MAGICK = '/opt/homebrew/bin/magick'

GROOT_W = 2200
GROOT_Q = 85
CATEGORIEEN = ['voetbal', 'nosports', 'othersports']

DRY = '--dry-run' in sys.argv


def breedte(src: Path) -> int:
    try:
        r = subprocess.run([MAGICK, 'identify', '-format', '%w', str(src)],
                           capture_output=True, check=True, text=True)
        return int(r.stdout.strip().split()[0])
    except Exception:
        return 0


def maak_groot(src: Path) -> str:
    """Geeft terug: 'gemaakt', 'bestaat', 'klein-genoeg' of 'fout'."""
    doel = src.with_name(src.stem + '-groot.webp')
    if doel.exists():
        return 'bestaat'
    if breedte(src) <= GROOT_W:
        return 'klein-genoeg'
    if DRY:
        return 'gemaakt'
    try:
        subprocess.run(
            [MAGICK, str(src), '-resize', f'{GROOT_W}x>', '-quality', str(GROOT_Q), str(doel)],
            capture_output=True, check=True
        )
        return 'gemaakt'
    except Exception as e:
        print(f'  ✗ {src.name}: {e}')
        return 'fout'


def main():
    telling = {'gemaakt': 0, 'bestaat': 0, 'klein-genoeg': 0, 'fout': 0}

    for cat in CATEGORIEEN:
        cat_pad = SITE / 'images' / cat
        if not cat_pad.exists():
            continue
        # Zowel lowercase als uppercase: rglob is case-sensitive op macOS
        gevonden, fotos = set(), []
        for ext in ['webp', 'WEBP']:
            for f in cat_pad.rglob(f'*.{ext}'):
                if '-thumb' in f.stem or '-groot' in f.stem:
                    continue
                if str(f) not in gevonden:
                    gevonden.add(str(f))
                    fotos.append(f)

        print(f"\n{cat}: {len(fotos)} foto's controleren")
        for i, f in enumerate(fotos, 1):
            telling[maak_groot(f)] += 1
            if i % 100 == 0:
                print(f'  {i}/{len(fotos)}...')

    kop = '(DRY-RUN, niets geschreven) ' if DRY else ''
    print(f"\n✓ Klaar {kop}— {telling['gemaakt']} aangemaakt, "
          f"{telling['bestaat']} bestond al, {telling['klein-genoeg']} al ≤{GROOT_W}px, "
          f"{telling['fout']} mislukt")


if __name__ == '__main__':
    main()
