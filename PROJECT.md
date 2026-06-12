# Zaanslicht.com — Projectdocument

_Laatste update: 12 juni 2026 — v0.9_

---

## URLs & locaties

| | |
|--|--|
| Live site | https://zaanslicht.com |
| GitHub repo | https://github.com/LuckyDre/zaanslicht |
| Cloudflare Worker | https://zaanslicht-updates.ntxzjzzg8m.workers.dev |
| Lokale map | `/Users/andreas/fotografie-site` |
| Domein | TransIP (CNAME → GitHub Pages) |

---

## Deployment

**GitHub Pages (statische bestanden)**
```
# watch.sh draait op de achtergrond en commit+pusht automatisch bij elke bestandswijziging
```

**Cloudflare Worker (API)**
```bash
cd /Users/andreas/fotografie-site
npx wrangler deploy cloudflare-worker.js
```
→ Alleen nodig als `cloudflare-worker.js` gewijzigd is.

---

## Tech stack

| Laag | Technologie |
|--|--|
| Frontend | Statische HTML/CSS/JS (GitHub Pages) |
| API / opslag | Cloudflare Worker + KV (`SUBSCRIBERS`) + R2 (`FOTOS`) |
| Likes & reacties | Firebase Realtime Database |
| E-mail | Resend API (`updates@zaanslicht.com`) |
| Analytics | Cloudflare Web Analytics |
| Formulieren | Formspree (contact.html) |

---

## Authenticatie

| Type | HTTP-header | Waar opgeslagen |
|--|--|--|
| Admin | `X-Worker-Secret` | `localStorage.zl_worker_secret` (beheer.html) |
| Fotograaf | `X-Fotograaf-Token` | `localStorage.zl_token` (fotograaf.html) |

Constante in `beheer.html`:
```javascript
const WORKER_URL = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';
```

---

## Pagina's

| Pagina | Thema | Functie |
|--|--|--|
| `index.html` | Oranje | Homepage: hero-slider, fotograaftegels, abonneren |
| `voetbal.html` | Oranje | Voetbalgalerij (eigen + gast sliders) |
| `nosports.html` | Geel | Landschap/architectuur galerij |
| `fotograaf.html` | Eigen kleur | Gastfotograaf portaal: login, upload, labels |
| `fotograaf-pagina.html?id=` | Eigen kleur | Dynamische pagina per gastfotograaf |
| `beheer.html` | — | Admin: abonnees, fotografen, sliders, labels |
| `clubs.html` | — | Zaanse voetbalclubs + foto's per club |
| `contact.html` | — | Contactformulier (Formspree) |

---

## Worker API — key endpoints

| Method | Pad | Auth | Doel |
|--|--|--|--|
| GET | `/labels` | Publiek | Alle clubnamen ophalen |
| POST | `/labels` | Secret | Label toevoegen |
| DELETE | `/labels` | Secret | Label verwijderen (+ blocklist) |
| GET | `/foto-labels?key=` | Token of Secret | Labels per map/foto ophalen |
| POST | `/foto-labels` | Token of Secret | Labels per map/foto opslaan |
| GET | `/fotos-bij-label?label=` | Publiek | Foto's per label (voor clubs.html) |
| POST | `/admin/map-verwijderen` | Secret | Map + alle foto's uit R2 verwijderen |
| POST | `/admin/foto-verwijderen` | Secret | Losse foto uit R2 verwijderen |
| GET | `/gallery/voetbal` | Publiek | Slider-data voor voetbal.html |
| GET | `/gallery/nosports` | Publiek | Slider-data voor nosports.html |
| POST | `/gallery/volgorde` | Secret | Volgorde sliders opslaan |
| POST | `/fotograaf/upload` | Token | Foto uploaden naar R2 |
| GET | `/fotograaf/fotos?id=` | Secret | Alle foto's van een fotograaf |
| POST | `/fotograaf/verberg-map` | Secret | Map verbergen/tonen |
| POST | `/fotograaf/verberg-foto` | Secret | Foto verbergen/tonen |
| GET | `/fotograaf/verborgen?id=` | Secret | Status verborgen mappen/foto's |
| POST | `/fotograaf/verwijderen` | Secret | Fotograaf-account verwijderen |

---

## KV-datastructuur (SUBSCRIBERS)

| Sleutel | Inhoud |
|--|--|
| `labels:lijst` | `string[]` — aangepaste clubnamen |
| `labels:verwijderd` | `string[]` — blocklist verwijderde standaardlabels |
| `label:fotos:{label}` | `Entry[]` — reverse index: mappen/foto's per label |
| `foto:labels:{key}` | `string[]` — labels per map of foto |
| `fotograaf:{id}` | `{naam, email, kleur, wachtwoord, salt, ...}` |
| `fotograaf:mappen:{id}` | `{map, categorie, ts, verborgen}[]` |
| `sessie:{token}` | `fotograaf-id` (30 dagen TTL) |
| `gallery:volgorde:{cat}` | Gecombineerde volgorde eigen + gast sliders |

## R2-structuur (FOTOS)

```
fotografen/{id}/{cat}/{map}/{bestandsnaam}   ← gastfoto's
```
Eigen foto's van Andreas staan op GitHub Pages:
```
images/{cat}/{map}/{bestandsnaam}
```

---

## Labelsysteem (gebouwd juni 2026)

Fotografen en admin koppelen foto-mappen aan clubnamen zodat clubs.html die kan tonen.

- **beheer.html** → Labels-tab: eigen GitHub Pages-mappen koppelen
- **fotograaf.html** → Labels-tab: gastfotograaf koppelt eigen R2-mappen
- **clubs.html** → haalt `/fotos-bij-label?label=` op per club
- Key-formaat admin: `eigen-map/{cat}/{mapNaam}`
- Key-formaat gast: `fotografen/{id}/{cat}/{map}`
- Reverse index in KV: `label:fotos:{label}` → entries met `{key, url, fotograafId, naam, kleur, mapNaam, type, cat}`

---

## Gastfotograaf-systeem

1. Admin nodigt uit via beheer.html → Abonnees-tab (naam + e-mail)
2. Fotograaf ontvangt link (geldig 7 dagen), kiest wachtwoord + accentkleur
3. Login via fotograaf.html → upload per categorie + map
4. Verschijnt **automatisch** in: galerij, nav, hero, tegels op homepage
5. Wachtwoorden: PBKDF2 (100.000 iteraties) + auto-upgrade van oude SHA-256

---

## beheer.html — tabs en functies

| Tab | Wat kan je doen |
|--|--|
| Voetbal | Sliders sorteren (drag), fotograaf/verhaal bewerken, slider verwijderen (🗑 eigen én gast) |
| No Sports | Idem |
| Fotografen | Mappen/foto's verbergen (🚫) of permanent verwijderen (🗑) |
| Labels | Mappen koppelen aan clubnamen; labels toevoegen/verwijderen |
| Abonnees | E-maillijst, fotografen uitnodigen, worker instellen |

---

## Openstaande punten

- [ ] Google Postmaster Tools verificatie (TXT-record in TransIP)
- [ ] DMARC-record (`_dmarc` TXT `p=none`)
- [ ] fotograaf.html hero: gezichten trainers beter zichtbaar (nav overlapt)
- [ ] ZCFC-website: link naar zaanslicht.com vragen als officieel clubfotograaf

---

## Changelog

### v0.9 — 12 juni 2026
- 📅 **Datum per slider/map** (kalender-widget, `<input type="date">` met dark color-scheme)
  - beheer.html eigen sliders: datumveld naast Fotograaf → `datum` (JJJJ-MM-DD) in manifest.json, opslaan via bestaande GitHub-commit ("Opslaan")
  - beheer.html gast-sliders: datumveld in de slider-header → direct opgeslagen via nieuw worker-endpoint
  - fotograaf.html Mijn mappen: datumveld per map → direct opgeslagen (groene rand = gelukt)
  - Worker: `POST /fotograaf/map-datum` `{id?, map, datum}` — admin (secret+id) of fotograaf (token); zet/verwijdert `datum` op de map-entry in `fotograaf:mappen:{id}`
- 🐛 Fix: `slaMappenVolgordeOp` (fotograaf.html) gooide extra velden weg (labels, datum, verborgen) — behoudt nu alle bestaande velden via spread van `_mappenData`
- ℹ️ De datum wordt opgeslagen maar nog nergens publiek getoond (bewuste keuze; tonen in galerij is een kleine vervolgklus)

### v0.8 — 12 juni 2026
- 📲 **Auto-redirect telefoons**: index.html stuurt mobiele bezoekers (max-width 768px + pointer coarse) door naar /m/; `?desktop=1` (link "volledige website" op /m/) zet sessionStorage-vlag `zl_desktop` en houdt de redirect die sessie tegen
- 📱 **Mobiele landingspagina `/m/`** (`m/index.html`)
  - Nieuwste serie met foto-grid (gast via `/fotograaf/fotos`, eigen via manifest.json), eerdere series, grote navigatieknoppen, fotografen-chips, abonneren-formulier (`/subscribe`)
  - Deel-knop (navigator.share / klembord) + QR-code van zaanslicht.com/m/ (qrcodejs, client-side)
  - zoek.js werkt ook op /m/ (vergrootglas in header)
- 🔗 `zoek.js`: alle interne links/fetches root-relative gemaakt (`/manifest.json`, `/voetbal.html`, …) zodat het script ook vanuit submappen zoals /m/ werkt
- 📇 **QR-generator in beheer.html** (Abonnees-tab): QR maken voor mobiele pagina, vaste pagina's, series (deeplink `#serie=`), clubs/labels (`?club=`) en fotografen; download als PNG

### v0.7 — 12 juni 2026
- 🔍 **Site-brede zoekfunctie** (`zoek.js`, geladen op alle 6 publieke pagina's naast nav-fotografen.js)
  - Vergrootglas in de header opent een overlay met filterchips: Alles / Series / Fotografen / Labels
  - Zoekt in serienamen, fotograafnamen en labels (eigen manifest.json + `/fotograaf/manifest` + `/labels`)
  - Serie-resultaat → `voetbal.html#serie=<naam>` of `nosports.html#serie=<naam>`; gallery-nieuw.js scrollt + highlight (functie `scrollNaarSerieUitHash`)
  - Label-resultaat → `clubs.html?club=<naam>`; clubs.html scrollt naar de club-kaart en opent automatisch het foto-paneel
  - Fotograaf-resultaat → `fotograaf-pagina.html?id=`
- ➕ **Label toevoegen in beheer.html**: invoerveld + knop in de Labels-tab (ontbrak); worker-fix: `handleAddLabel` accepteert nu óók `X-Worker-Secret` (gaf altijd 401 voor admin)

### v0.6 — 11 juni 2026
- 🗑 Kapotte slider ZCFC VR1 verwijderd uit `gallery:volgorde:voetbal` en `fotograaf:mappen:5aaa4a798ac6fc01` (Jan Kaper)
- 🐛 `fotograaf-pagina.html`: foto-filter fix — `decodeURIComponent(f.key)` i.p.v. `encodeURIComponent` (haakjes-encodering mismatch)
- 🖼 `beheer.html` Dashboard-modal: toont nu echte foto-thumbnails per map i.p.v. kapotte galerij-teller

### v0.5 — 11 juni 2026
- 🗑 Delete-knoppen op alle sliders (eigen + gast) in Voetbal/No Sports-tab
- 🗑 Delete-knoppen per map en per foto in Fotografen-tab
- Fix: `event.currentTarget` opslaan vóór `confirm()` (daarna is het null)

### v0.4 — 10 juni 2026
- Labels-tab in beheer.html: mappen koppelen aan clubnamen
- Admin (Andreas) kan eigen GitHub Pages-mappen labelen via `eigen-map/{cat}/{mapNaam}`
- Alle labels verwijderbaar (standaardlabels via `labels:verwijderd` blocklist)
- clubs.html: foto-paneel per club op basis van reverse index

### v0.3 — 9–10 juni 2026
- Labelsysteem in fotograaf.html (per map, niet per foto)
- CORS: DELETE toegevoegd aan worker allowed methods
- Dual-auth op `/foto-labels` (token én secret)
- Reverse index `label:fotos:{label}` in KV

### v0.2 — juni 2026
- Beheer.html: gecombineerde slider-volgorde eigen + gast
- Worker: `/admin/map-verwijderen`, `/admin/foto-verwijderen`
- Wachtwoorden: PBKDF2 + automatische SHA-256 upgrade

### v0.1 — mei 2026
- Basis site: index, voetbal, nosports, clubs, contact
- Gastfotograaf-systeem volledig automatisch
- Firebase likes/reacties, Resend e-mail, Cloudflare Analytics
