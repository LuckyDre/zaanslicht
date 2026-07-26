#!/usr/bin/env python3
"""
Verhuist Andreas' eigen camera-masters (>2200px) van de GitHub Pages-checkout
naar R2, zodat de gepubliceerde site onder de 1 GB-richtlijn van Pages blijft.

Sinds v0.46 is het masterbestand alleen nog nodig voor de downloadknop: het
raster gebruikt -thumb.webp (400px) en de lightbox -groot.webp (2200px). Die
twee blijven op Pages staan — alleen de master verhuist.

Een foto is een MASTER als er een zusterbestand '<naam>-groot.webp' bestaat.
maak-groot.py maakt die immers uitsluitend voor foto's breder dan 2200px, dus
dat is precies de verzameling die de ruimte opeet.

R2-key: eigen/{categorie}/{map}/{naam} met elk pad-segment URL-geëncodeerd,
exact zoals de gastfoto's. handleFotoServe leest url.pathname ongewijzigd, dus
de key moet de %20's letterlijk bevatten.

De Worker geeft eigen-keys die (nog) niet in R2 staan door vanaf Pages, met een
X-Bron-header (r2 of pages) zodat verificatie ondubbelzinnig is.

Gebruik:
  python3 verhuis-masters-naar-r2.py --dry-run
  python3 verhuis-masters-naar-r2.py --limit 10          # pilot
  python3 verhuis-masters-naar-r2.py --include-originelen
  python3 verhuis-masters-naar-r2.py --verify-only

Het logboek (~/.zl-r2-verhuis.log) staat buiten de repo en maakt een afgebroken
run hervatbaar: al geüploade keys worden overgeslagen.
"""

import argparse
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

BASIS   = Path(__file__).resolve().parent / 'images'
LOG     = Path.home() / '.zl-r2-verhuis.log'
BUCKET  = 'zaanslicht-fotos'
WORKER  = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev'

CONTENT_TYPES = {
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
}


def r2_key(pad: Path) -> str:
    """images/voetbal/Serie X/foto.webp -> eigen/voetbal/Serie%20X/foto.webp"""
    rel = pad.relative_to(BASIS)
    return 'eigen/' + '/'.join(quote(deel, safe='') for deel in rel.parts)


def is_hulpbestand(naam: str) -> bool:
    laag = naam.lower()
    return laag.endswith('-thumb.webp') or laag.endswith('-groot.webp')


def vind_masters():
    """Originelen met een -groot zusterbestand (dus breder dan 2200px)."""
    gevonden = []
    for pad in sorted(BASIS.rglob('*')):
        if not pad.is_file() or pad.suffix.lower() != '.webp':
            continue
        if is_hulpbestand(pad.name):
            continue
        if pad.relative_to(BASIS).parts[0] == '_originelen':
            continue
        stam = pad.with_suffix('')
        if stam.with_name(stam.name + '-groot.webp').exists() \
           or stam.with_name(stam.name + '-groot.WEBP').exists():
            gevonden.append(pad)
    return gevonden


def vind_originelen():
    """images/_originelen/ — oude JPG-bronbestanden, nergens in de site gebruikt."""
    map_ = BASIS / '_originelen'
    if not map_.is_dir():
        return []
    return [p for p in sorted(map_.rglob('*'))
            if p.is_file() and p.name != '.DS_Store']


def gelogd() -> set:
    if not LOG.exists():
        return set()
    return {r.split('\t')[0] for r in LOG.read_text().splitlines() if r.strip()}


def log_toevoegen(key: str, grootte: int):
    with LOG.open('a') as f:
        f.write(f'{key}\t{grootte}\n')


def upload(pad: Path, key: str) -> bool:
    ct = CONTENT_TYPES.get(pad.suffix.lower(), 'application/octet-stream')
    # objectPath is ÉÉN argument: {bucket}/{key}
    resultaat = subprocess.run(
        ['npx', 'wrangler', 'r2', 'object', 'put', f'{BUCKET}/{key}',
         '--file', str(pad), '--content-type', ct, '--remote'],
        capture_output=True, text=True,
    )
    if resultaat.returncode != 0:
        print(f'   ✗ MISLUKT: {resultaat.stderr.strip().splitlines()[-1:] or resultaat.stdout.strip()[-200:]}')
        return False
    return True


def controleer(key: str, verwacht: int):
    """Volledige GET met cache-buster: geeft (bron, bytes) terug.

    De cache-buster is essentieel — een eerder passthrough-antwoord blijft een
    jaar in de edge-cache staan en zou een verse R2-upload maskeren.
    """
    import random
    url = f'{WORKER}/foto/{key}?nc={random.randint(1, 10**9)}'
    resultaat = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-D', '-', '-w', '%{size_download}', url],
        capture_output=True, text=True,
    )
    bron = 'onbekend'
    for regel in resultaat.stdout.splitlines():
        if regel.lower().startswith('x-bron:'):
            bron = regel.split(':', 1)[1].strip()
    try:
        bytes_ = int(resultaat.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        bytes_ = -1
    return bron, bytes_


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--limit', type=int, default=0)
    p.add_argument('--include-originelen', action='store_true')
    p.add_argument('--verify-only', action='store_true')
    args = p.parse_args()

    bestanden = vind_masters()
    if args.include_originelen:
        bestanden += vind_originelen()

    paren = [(pad, r2_key(pad)) for pad in bestanden]
    totaal_bytes = sum(pad.stat().st_size for pad, _ in paren)
    print(f'{len(paren)} bestanden, {totaal_bytes / 1024**3:.2f} GB')

    if args.verify_only:
        klaar = gelogd()
        teControleren = [(pad, key) for pad, key in paren if key in klaar]
        print(f'Controleren: {len(teControleren)} gelogde uploads\n')
        fout = []
        for i, (pad, key) in enumerate(teControleren, 1):
            verwacht = pad.stat().st_size
            bron, bytes_ = controleer(key, verwacht)
            ok = (bron == 'r2' and bytes_ == verwacht)
            if not ok:
                fout.append((key, bron, bytes_, verwacht))
            vlag = '✓' if ok else '✗'
            print(f'[{i}/{len(teControleren)}] {vlag} {bron:6} {bytes_:>9} (verwacht {verwacht:>9})  {key[:70]}')
        print()
        if fout:
            print(f'⛔ {len(fout)} PROBLEMEN — niets lokaal verwijderen:')
            for key, bron, bytes_, verwacht in fout:
                print(f'   {key}\n      bron={bron} bytes={bytes_} verwacht={verwacht}')
            sys.exit(1)
        print(f'✅ Alle {len(teControleren)} bestanden bewezen aanwezig in R2 met kloppende bytegrootte.')
        return

    if args.dry_run:
        for pad, key in paren[:15]:
            print(f'  {pad.stat().st_size / 1024**2:7.2f} MB  {key}')
        if len(paren) > 15:
            print(f'  … en {len(paren) - 15} meer')
        return

    klaar = gelogd()
    todo = [(pad, key) for pad, key in paren if key not in klaar]
    if args.limit:
        todo = todo[:args.limit]
    print(f'Al gedaan: {len(paren) - len([1 for _, k in paren if k not in klaar])}. Nu uploaden: {len(todo)}\n')

    mislukt = 0
    for i, (pad, key) in enumerate(todo, 1):
        mb = pad.stat().st_size / 1024**2
        print(f'[{i}/{len(todo)}] {mb:6.2f} MB  {key[:75]}')
        if upload(pad, key):
            log_toevoegen(key, pad.stat().st_size)
        else:
            mislukt += 1

    print(f'\nKlaar. Geüpload: {len(todo) - mislukt}, mislukt: {mislukt}')
    if mislukt:
        print('Draai het script opnieuw — gelukte uploads worden overgeslagen.')
        sys.exit(1)


if __name__ == '__main__':
    main()
