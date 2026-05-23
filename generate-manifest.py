#!/usr/bin/env python3
"""
Scant images/voetbal/ en images/nosports/ voor submappen (wedstrijden/albums)
en genereert manifest.json. Nieuwe mappen verschijnen bovenaan.
Bestaande volgorde van sliders én foto's blijft bewaard.
"""
import os, json, re
from pathlib import Path

SITE = Path(__file__).parent

def scan(category):
    cat_dir = SITE / 'images' / category
    if not cat_dir.exists():
        return []

    # Laad bestaande manifest voor volgorde-bewaring
    existing_sliders = {}
    existing_foto_order = {}
    manifest_file = SITE / 'manifest.json'
    if manifest_file.exists():
        with open(manifest_file, encoding='utf-8') as f:
            data = json.load(f)
            for item in data.get(category, []):
                existing_sliders[item['map']] = item.get('volgorde', 9999)
                existing_foto_order[item['map']] = item.get('fotos', [])

    items = []
    for d in cat_dir.iterdir():
        if not d.is_dir():
            continue

        # Alle webp bestanden in deze map
        all_fotos = set(f.name for f in d.iterdir() if f.suffix.lower() == '.webp')
        if not all_fotos:
            continue

        # Bewaar bestaande fotovolgorde, voeg nieuwe foto's toe aan het einde
        existing_order = existing_foto_order.get(d.name, [])
        ordered = [f for f in existing_order if f in all_fotos]  # bestaande volgorde
        new_fotos = sorted(all_fotos - set(ordered))             # nieuwe foto's achteraan
        fotos = ordered + new_fotos

        item_id = re.sub(r'[^a-z0-9]+', '-', d.name.lower()).strip('-')
        volgorde = existing_sliders.get(d.name, -1)  # -1 = nieuw → bovenaan
        items.append({
            'id': item_id,
            'naam': d.name,
            'map': d.name,
            'fotos': fotos,
            'volgorde': volgorde
        })

    # Nieuwe items bovenaan, daarna op volgorde
    new_items  = [x for x in items if x['volgorde'] == -1]
    old_items  = sorted([x for x in items if x['volgorde'] >= 0], key=lambda x: x['volgorde'])
    all_items  = new_items + old_items

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
