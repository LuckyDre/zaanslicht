# Zaanslicht.com — Projectdocument

_Laatste update: 13 juni 2026 — v0.11_

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

- [x] Google Postmaster Tools verificatie + DMARC-record (13-06-2026)
- [x] ZCFC-website: link naar zaanslicht.com (13-06-2026)

---

## Changelog

### v0.15 — 13 juli 2026
- 💾 **Expliciet opslaan bij labels** (gemeld door Andreas: labels wijzigden direct bij het aanklikken, zonder enige bevestiging — niet duidelijk dat er iets gebeurde)
  - Label-popup togglet chips nu alleen visueel; pas op **💾 Opslaan** worden de wijzigingen weggeschreven. **✕ Annuleren** (of buiten de popup klikken) sluit zonder iets op te slaan
  - Alleen daadwerkelijk aangeraakte labels worden toegepast (toegevoegd/weggehaald t.o.v. de startstand) — overige labels per foto blijven ongemoeid, ook al verschillen ze tussen de geselecteerde foto's
  - **Nieuwe 🏷 Labels-knop** in de bulk-selectiebalk naast 🗑 Verwijder: opent de labelpopup voor de hele actieve foto-selectie (`fgBulkLabels`), niet alleen voor foto's die je via één 🏷-badge selecteert
  - Popup toont tijdens opslaan voortgang ("Opslaan… n/X") en sluit vanzelf na "✓ Opgeslagen"
  - End-to-end geverifieerd: aanvinken+annuleren liet KV ongewijzigd; aanvinken+opslaan zette het label op alle 3 geselecteerde foto's; opnieuw uitzetten+opslaan herstelde de oorspronkelijke (lege) staat

### v0.14 — 13 juli 2026
- 🏷 **Bulk-labelen**: is een foto onderdeel van een selectie (≥2 aangevinkt) en open je daar de label-popup, dan gelden label-wijzigingen voor álle geselecteerde foto's
  - Popup-titel toont "Labels voor X geselecteerde foto's"; tijdens opslaan een voortgang "Opslaan… (n/X)"
  - Label actief in de popup = alle geselecteerde foto's hebben het; aanklikken voegt toe aan allemaal / haalt bij allemaal weg (overige labels per foto blijven behouden; cache-misses worden eerst opgehaald zodat niets overschreven wordt)
  - Zonder selectie (of popup op een niet-geselecteerde foto) werkt het zoals voorheen: alleen die ene foto
  - Let op: 1 KV-write per foto per label-wijziging (telt mee in de 1000/dag)
- ✕ **"Deselecteer alles"-knop** in fotograaf.html foto-paneel: verschijnt zodra ≥1 foto is aangevinkt, wist de hele selectie van die map in één klik (gemeld door Andreas: "Selecteer alles" toggle'de alleen als álles al aan stond)
  - Nieuwe helper `fgUpdatePaneelSelectie(paneel)` (teller + knop-zichtbaarheid), gebruikt door `fgToggleFotoSelectie`, `fgSelecteerAlleFotos`, `fgDeselecteerAlleFotos` en `fgBulkAnnuleer`
- 🏷 **Fix onleesbare label-popup**: `.foto-label-popup` gebruikte `var(--surface)` — die variabele bestaat niet in fotograaf.html (vars heten `--s1`/`--s2`) → transparante achtergrond, tekst zweefde onleesbaar over de foto's. Nu `var(--s2)` + labeltekst `#ccc` + light-mode overrides (witte popup, donkere tekst)

### v0.13 — 12 juli 2026
- 🔀 **Handmatige foto-volgorde per map** (gastfotografen)
  - fotograaf.html Mijn mappen: foto-chips in een geopende map zijn versleepbaar (SortableJS, handle = de afbeelding); na een sleep verschijnt "💾 Foto-volgorde opslaan"
  - Worker: `POST /fotograaf/foto-volgorde` (token-auth) `{ map, volgorde: [keys] }` → KV `fotograaf:foto-volgorde:{id}` = `{ mapNaam: [keys] }`; lege volgorde verwijdert de entry; keys van een andere fotograaf worden geweigerd (400)
  - `GET /fotograaf/fotos` geeft nu ook `fotoVolgorde` terug
  - fotograaf.html én fotograaf-pagina.html passen de handmatige volgorde toe; foto's zonder positie (nieuwe uploads) komen achteraan in bestandsnaam-volgorde
  - **Bewust NIET aangepast:** galerij-sliders (voetbal/nosports, likes-sortering), hero (top-20 shuffle), index-tegels — de publieke automaat blijft leidend; eigen pagina = eigen keuze
  - Eigen (Andreas) series op fotograaf-pagina.html gebruiken de manifest-volgorde zoals voorheen
  - End-to-end geverifieerd in browser: slepen → opslaan → herladen → publieke pagina respecteert volgorde; testdata daarna gereset
  - fotograaf-handleiding.html: stap "Foto-volgorde aanpassen" gecorrigeerd (beschreef eerder auto-opslaan dat niet bestond) + uitleg waar de volgorde geldt
- 🚨 **Incident: KV-schrijflimiet bereikt (zelfde dag, opgelost)**
  - De eerste versie van de schuivende vervaldatum schreef het token bij élk geauthenticeerd verzoek opnieuw naar KV → dagquota van het gratis plan (1000 writes/dag) op → nieuwe logins en review-sessies faalden ("kan niet inloggen via beheer") én bestaande sessies kregen 500 (put-exception in `getFotograafByToken`)
  - Fix: verlenging max 1× per 24 uur per token (tijdstip in KV-metadata `verlengd`, gelezen via `getWithMetadata`) en altijd in try/catch — een mislukte verlenging breekt een geldige sessie nooit meer
  - KV-quota reset om middernacht UTC (02:00 NL in de zomer); tot die tijd falen alle KV-writes (nieuwe logins, review-sessies, labels opslaan, volgorde opslaan)
  - **Les:** KV-writes zijn schaars op het gratis plan — nooit schrijven op het request-pad zonder throttle + try/catch
- 🔀 **Sorteer-modus (mobiel-vriendelijk, zelfde dag toegevoegd)**
  - Knop "🔀 Volgorde wijzigen" per map → tik-tik verplaatsen: tik de foto (oranje rand + scale), tik daarna de doelplek; werkt op telefoon én desktop. "✔ Klaar met sorteren" sluit de modus
  - In sorteer-modus zijn de 🗑/🏷/checkbox-overlays verborgen (CSS `.map-item.sorteer-modus`) — nodig omdat de 🗑-overlay (`inset:0`) anders alle clicks/drags op de chip afvangt; direct slepen buiten de modus werkte daardoor feitelijk niet
  - SortableJS: `delay: 250, delayOnTouchOnly: true` zodat slepen op touch niet botst met scrollen
  - Hintteksten aangepast: sorteren loopt via de 🔀-modus

### v0.12 — 12 juli 2026
- 🔑 **Fix stille sessie-verloop fotograaf.html** (gemeld door Jan Kaper: kon mappen en foto's niet verwijderen terwijl beheer.html wel werkte)
  - Oorzaak: sessietokens hebben in KV een TTL van 30 dagen, maar fotograaf.html herstelde de sessie uit localStorage zonder validatie. Lees-endpoints (`/fotograaf/fotos`, `/fotograaf/manifest`) vereisen geen token, dus het dashboard laadde gewoon — alleen mutaties (verwijderen etc.) gaven 401. In `verwijderMap()` en de bulk-functies werden fetch-responses bovendien niet gecontroleerd, waardoor de 401 stil verdween.
  - Worker: schuivende vervaldatum in `getFotograafByToken` — elk geldig gebruik verlengt het token met 30 dagen (actieve fotografen worden nooit uitgelogd; per apparaat een eigen token, dus meerdere PC's tegelijk blijft werken)
  - fotograaf.html: sessie-check bij het laden via `/fotograaf/verborgen-eigen`; bij 401 → sessie gewist + loginscherm met melding "Je sessie is verlopen. Log opnieuw in om verder te gaan." (alleen expliciete 401 logt uit, netwerkfouten niet)
  - fotograaf.html: `res.ok`/401-checks in `verwijderFoto`, `verwijderMap`, `fgBulkVerwijder` en `_verwijderMapStil` — fouten geven nu een alert of de sessie-verlopen-melding
  - fotograaf-handleiding.html: sectie "Ingelogd blijven" uitgebreid (meerdere apparaten, 30-dagen-verloop bij inactiviteit)
  - Review-tokens uitgezonderd van de schuivende vervaldatum: KV-waarde krijgt `review:`-prefix (`fotograaf:token:{token}` → `review:{id}`), `getFotograafByToken` verlengt die niet — review-sessies verlopen na 2 uur zoals bedoeld

### v0.11 — 13 juni 2026
- ✨ **NIEUW-badge op sliders**: pulserende badge op galerij-sliders waarvan de datum < 14 dagen oud is. Automatisch zichtbaar in `gallery-nieuw.js` via `isNieuw(datum)` + `ensureNieuwStyles()`. Verdwijnt vanzelf na 2 weken.
- 🔀 **Hero-shuffle**: hero toonde altijd dezelfde top-5; nu wordt uit de top-20 meest gelikte foto's willekeurig 5 gekozen bij elke laad. Fix in `main.js` (`vulHeroEnStart`). Cache-buster naar `main.js?v=20260613b`.
- 🛠 **Tools-pagina** (`tools.html`): nieuwe publieke pagina met alle site-tools (tactiekbord, ZCFC-tracker, toernooien). Zwevende "Tools"-knop (FAB) rechtsonder de hamburger op alle 5 hoofdpagina's (`index.html`, `voetbal.html`, `nosports.html`, `clubs.html`, `contact.html`).
- 📊 **ZCFC Competitietracker** hernoemd van "Nieuwsfeed"; uitleg-pagina `zcfc-tracker-handleiding.html` toegevoegd met beschrijving van alle 8 tabs.
- 🏆 **Toernooien op Tools-pagina**: kaart met "Openen ↗" knop naar zaanslicht-toernooi.vercel.app + "ⓘ Handleiding"-knop.
- 📖 **Toernooi handleiding** (`toernooi-handleiding.html`): 8-stappen handleiding met screenshots, ingedeeld in 3 groepen (bezoekers / organisatie / beamer). Screenshots opgeslagen in `images/tools/`.
- 🖼 **`images/tools/`**: 8 PNG-screenshots van de toernooitool (geconverteerd via `sips`): stand, uitslagen, schema, team-detail, admin-dashboard, scheidsrechters, admin-live, scorebord.

### v0.10 — 12 juni 2026
- 🐛 **Fix "Mijn mappen" laadde niet** (fotograaf.html): de hele LABELS-sectie (renderLabelChips, laadLabels, laadFotoLabelBadge, openFotoLabelPopup, slaFotoLabelsOp, …) stond per ongeluk bínnen de functie-body van `toonDashboard`, waardoor het top-level `laadMappenTab` ze niet kon aanroepen (`laadFotoLabelBadge is not defined` → tab bleef op "Laden…"). Blok van 181 regels naar top-level verplaatst; `startUpload` bleef bewust binnen toonDashboard (gebruikt closure-variabelen `bestanden`/`converteerNaarWebp`).
- 👁 **Review-modus**: admin kan meekijken als gastfotograaf (echte dashboard-replicatie)
  - beheer.html → Fotografen-tab → kaart "Meekijken als fotograaf": kies fotograaf + apart review-wachtwoord → opent fotograaf.html in nieuw tabblad met een echte (korte) sessie
  - Review-wachtwoord instellen/wijzigen kan in dezelfde kaart (opgeslagen als PBKDF2-hash in KV `review:wachtwoord`)
  - Worker: `POST /admin/review-wachtwoord` (secret) en `POST /admin/review-sessie` (secret + review-wachtwoord) → token via bestaand `fotograaf:token:`-mechanisme, TTL 2 uur
  - fotograaf.html toont een oranje sticky banner "Review-modus — je kijkt mee als {naam}" met Stop review-knop (wist sessie + vlag, terug naar beheer); ook gewone Uitloggen wist de review-vlag
  - ⚠️ Wijzigingen in review-modus zijn écht (zelfde API's als de fotograaf zelf)

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
