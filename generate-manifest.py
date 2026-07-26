#!/usr/bin/env python3
"""
Scant images/voetbal/ en images/nosports/ voor submappen (wedstrijden/albums)
en genereert manifest.json. Nieuwe mappen verschijnen bovenaan.
Bestaande volgorde van sliders én foto's blijft bewaard.
"""
import os, json, re
from pathlib import Path

SITE = Path(__file__).parent

# Camera-masters (>2200px) staan sinds v0.48 in R2 en NIET meer op schijf. Zonder
# deze lijst zou dit script ze als "verdwenen foto" beschouwen en uit manifest.json
# schrappen — dan vallen ze van de site af terwijl de bestanden gewoon in R2 staan.
# De lijst wordt bijgehouden door verhuis-masters-naar-r2.py.
def laad_masters_in_r2():
    bestand = SITE / 'masters-in-r2.json'
    if not bestand.exists():
        return {}
    per_map = {}
    for pad in json.loads(bestand.read_text(encoding='utf-8')):
        cat, map_naam, naam = pad.split('/', 2)
        per_map.setdefault((cat, map_naam), set()).add(naam)
    return per_map

MASTERS_IN_R2 = laad_masters_in_r2()


def scan(category):
    cat_dir = SITE / 'images' / category
    if not cat_dir.exists():
        return []

    # Laad bestaande manifest voor volgorde-bewaring
    existing_sliders = {}
    existing_foto_order = {}
    existing_fotograaf    = {}
    existing_beschrijving = {}
    existing_datum        = {}
    manifest_file = SITE / 'manifest.json'
    if manifest_file.exists():
        with open(manifest_file, encoding='utf-8') as f:
            data = json.load(f)
            for item in data.get(category, []):
                existing_sliders[item['map']] = item.get('volgorde', 9999)
                existing_foto_order[item['map']] = item.get('fotos', [])
                existing_fotograaf[item['map']]    = item.get('fotograaf', 'Andreas Luckfiel')
                existing_beschrijving[item['map']] = item.get('beschrijving', '')
                if item.get('datum'):
                    existing_datum[item['map']] = item['datum']

    items = []
    for d in cat_dir.iterdir():
        if not d.is_dir():
            continue

        # Alle webp bestanden in deze map. Afgeleide formaten moeten hier buiten
        # blijven: -thumb (400px, maak-thumbs.py) én -groot (2200px, maak-groot.py).
        # Ontbrak voor -groot, waardoor sync.sh op 25-07-2026 alle 323 nieuwe
        # -groot.webp's als losse foto's aan het manifest toevoegde → elke grote
        # foto stond dubbel in de galerij en het raster laadde de 2200px-versie.
        all_fotos = set(
            f.name for f in d.iterdir()
            if f.suffix.lower() == '.webp'
            and not f.stem.endswith('-thumb')
            and not f.stem.endswith('-groot')
        )
        # Masters die naar R2 verhuisd zijn staan niet op schijf, maar horen er wél
        # bij. Hun exacte bestandsnaam komt uit masters-in-r2.json — die kan niet uit
        # het -groot-bestand herleid worden, want 117 foto's hebben een hoofdletter-
        # extensie (.WEBP) terwijl hun -groot altijd .webp is.
        all_fotos |= MASTERS_IN_R2.get((category, d.name), set())
        if not all_fotos:
            continue

        # Bewaar bestaande fotovolgorde, voeg nieuwe foto's toe aan het einde
        existing_order = existing_foto_order.get(d.name, [])
        ordered = [f for f in existing_order if f in all_fotos]  # bestaande volgorde
        new_fotos = sorted(all_fotos - set(ordered))             # nieuwe foto's achteraan
        fotos = ordered + new_fotos

        item_id = re.sub(r'[^a-z0-9]+', '-', d.name.lower()).strip('-')
        volgorde     = existing_sliders.get(d.name, -1)  # -1 = nieuw → bovenaan
        fotograaf    = existing_fotograaf.get(d.name, 'Andreas Luckfiel')
        beschrijving = existing_beschrijving.get(d.name, '')
        datum        = existing_datum.get(d.name, '')
        entry = {
            'id': item_id,
            'naam': d.name,
            'map': d.name,
            'fotos': fotos,
            'volgorde': volgorde,
            'fotograaf': fotograaf,
            'beschrijving': beschrijving,
        }
        if datum:
            entry['datum'] = datum
        items.append(entry)

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
