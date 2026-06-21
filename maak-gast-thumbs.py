#!/usr/bin/env python3
"""
Genereert thumbnails voor gastfotograaf-foto's in R2.
Download → resize met magick → upload naar R2 als thumbs/{key}
Gebruik: python3 maak-gast-thumbs.py
"""
import subprocess, sys, json, urllib.request, os
from pathlib import Path

WORKER_URL = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev'
BUCKET     = 'zaanslicht-fotos'
MAGICK     = '/opt/homebrew/bin/magick'
THUMB_W    = 400
THUMB_Q    = 72
TMP_IN     = '/tmp/gast_orig'
TMP_OUT    = '/tmp/gast_thumb.webp'


def download(url, dest):
    r = subprocess.run(['curl', '-sL', '--max-time', '30', '-o', dest, url], capture_output=True)
    if r.returncode != 0:
        raise Exception(f'curl fout: {r.stderr.decode()[:80]}')

def upload_thumb(lokaal, r2_key):
    r = subprocess.run(
        ['npx', 'wrangler', 'r2', 'object', 'put', BUCKET, r2_key,
         '--file', lokaal, '--content-type', 'image/webp', '--remote'],
        capture_output=True, cwd=Path(__file__).parent
    )
    return r.returncode == 0

def main():
    # Haal lijst op van alle foto's
    print('Foto-lijst ophalen...')
    r = subprocess.run(['curl', '-sL', f'{WORKER_URL}/fotograaf/fotos?id=5aaa4a798ac6fc01'], capture_output=True)
    data = json.loads(r.stdout)

    fotos = [f for f in data.get('fotos', []) if 'profiel' not in f['key']]
    print(f'{len(fotos)} foto\'s gevonden\n')

    gemaakt = overgeslagen = fouten = 0

    for i, foto in enumerate(fotos, 1):
        key       = foto['key']
        thumb_key = 'thumbs/' + key.rsplit('.', 1)[0] + '-thumb.webp'

        # Al aanwezig?
        if wrangler_exists(thumb_key):
            overgeslagen += 1
            if i % 50 == 0: print(f'  {i}/{len(fotos)} verwerkt...')
            continue

        # Download origineel
        ext = key.rsplit('.', 1)[-1].lower()
        tmp_in = TMP_IN + '.' + ext
        try:
            download(f'{WORKER_URL}/foto/{key}', tmp_in)
        except Exception as e:
            print(f'  ✗ Download {key}: {e}')
            fouten += 1
            continue

        # Resize
        r = subprocess.run(
            [MAGICK, tmp_in, '-resize', f'{THUMB_W}x>', '-quality', str(THUMB_Q), TMP_OUT],
            capture_output=True
        )
        if r.returncode != 0:
            print(f'  ✗ Resize {key}: {r.stderr.decode()[:80]}')
            fouten += 1
            continue

        # Upload
        if upload_thumb(TMP_OUT, thumb_key):
            gemaakt += 1
        else:
            print(f'  ✗ Upload mislukt: {thumb_key}')
            fouten += 1

        if i % 25 == 0:
            print(f'  {i}/{len(fotos)} — {gemaakt} aangemaakt, {overgeslagen} overgeslagen, {fouten} fouten')

    print(f'\n✓ Klaar — {gemaakt} thumbnails aangemaakt, {overgeslagen} al aanwezig, {fouten} fouten')

if __name__ == '__main__':
    main()
