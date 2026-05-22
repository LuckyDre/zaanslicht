#!/usr/bin/env python3
"""
Scant images/voetbal/ en images/nosports/ voor submappen (wedstrijden/albums)
en genereert manifest.json. Nieuwe mappen verschijnen bovenaan (volgorde 0).
Bestaande volgorde blijft bewaard.
Automatisch aangeroepen door sync.sh voor elke push.
"""
import os, json, re
from pathlib import Path

SITE = Path(__file__).parent

def scan(category):
    cat_dir = SITE / 'images' / category
    if not cat_dir.exists():
        return []

    # Bewaar bestaande volgorde uit manifest
    existing_order = {}
    manifest_file = SITE / 'manifest.json'
    if manifest_file.exists():
        with open(manifest_file, encoding='utf-8') as f:
            data = json.load(f)
            for item in data.get(category, []):
                existing_order[item['map']] = item.get('volgorde', 9999)

    items = []
    for d in cat_dir.iterdir():
        if not d.is_dir():
            continue
        fotos = sorted([f.name for f in d.iterdir() if f.suffix.lower() == '.webp'])
        if not fotos:
            continue
        item_id = re.sub(r'[^a-z0-9]+', '-', d.name.lower()).strip('-')
        volgorde = existing_order.get(d.name, -1)  # -1 = nieuw, komt bovenaan
        items.append({
            'id': item_id,
            'naam': d.name,
            'map': d.name,
            'fotos': fotos,
            'volgorde': volgorde
        })

    # Nieuwe items bovenaan, daarna bestaande op volgorde
    new_items = [x for x in items if x['volgorde'] == -1]
    old_items = sorted([x for x in items if x['volgorde'] >= 0], key=lambda x: x['volgorde'])
    all_items = new_items + old_items

    # Hernummer
    for i, item in enumerate(all_items):
        item['volgorde'] = i

    return all_items

manifest = {
    'voetbal':  scan('voetbal'),
    'nosports': scan('nosports'),
}

with open(SITE / 'manifest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print('✓ manifest.json gegenereerd')
for cat, items in manifest.items():
    print(f'  {cat}: {len(items)} mappen, {sum(len(i["fotos"]) for i in items)} foto\'s')
