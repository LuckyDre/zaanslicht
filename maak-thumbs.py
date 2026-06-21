#!/usr/bin/env python3
"""
Genereert -thumb.webp voor alle bestaande WebP-foto's in images/voetbal/ en images/nosports/
Gebruik: python3 maak-thumbs.py
"""
from pathlib import Path
import subprocess, sys

SITE   = Path(__file__).parent
MAGICK = '/opt/homebrew/bin/magick'

THUMB_W   = 400
THUMB_Q   = 72
CATEGORIEEN = ['voetbal', 'nosports']

def maak_thumb(src: Path) -> bool:
    thumb = src.with_name(src.stem + '-thumb.webp')
    if thumb.exists():
        return False  # al gedaan
    try:
        subprocess.run(
            [MAGICK, str(src), '-resize', f'{THUMB_W}x>', '-quality', str(THUMB_Q), str(thumb)],
            capture_output=True, check=True
        )
        return True
    except Exception as e:
        print(f'  ✗ {src.name}: {e}')
        return False

def main():
    gemaakt = 0
    overgeslagen = 0
    for cat in CATEGORIEEN:
        cat_pad = SITE / 'images' / cat
        if not cat_pad.exists():
            continue
        # Zoek zowel lowercase als uppercase extensies (rglob is case-sensitive op macOS)
        gevonden = set()
        fotos = []
        for ext in ['webp', 'WEBP']:
            for f in cat_pad.rglob(f'*.{ext}'):
                if '-thumb' not in f.stem and str(f) not in gevonden:
                    gevonden.add(str(f))
                    fotos.append(f)
        print(f'\n{cat}: {len(fotos)} foto\'s te verwerken')
        for i, f in enumerate(fotos, 1):
            if maak_thumb(f):
                gemaakt += 1
                if i % 50 == 0:
                    print(f'  {i}/{len(fotos)} verwerkt...')
            else:
                overgeslagen += 1

    print(f'\n✓ Klaar — {gemaakt} thumbnails aangemaakt, {overgeslagen} al aanwezig')
    print('  Start watch.sh of run sync om naar GitHub te pushen.')

if __name__ == '__main__':
    main()
