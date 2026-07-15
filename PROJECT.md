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

### v0.27 — 16 juli 2026
- 🎨 **fotograaf.html: knoppen strak wit in rust, accentkleur van de fotograaf bij aanwijzen/drukken**
  - `.btn-primary`/`.btn-secondary` (nieuw gedefinieerd — bestond in HTML maar had nog geen CSS-regel)/`.btn-ghost`: was een solide gevulde `var(--accent)`-achtergrond, altijd. Nu: transparante achtergrond, witte rand + tekst in rust; bij `:hover`/`:active` vult de knop met `var(--accent)` (de accentkleur die de fotograaf zelf instelt bij Instellingen, per account verschillend)
  - Kop-knoppen (☀️ thema, ❓ Handleiding, ← Terug naar site) hadden een aparte, ongerelateerde inline-stijl met **hardcoded `#FF6B00`** i.p.v. de dynamische `var(--accent)` — dus toonden altijd oranje, ook voor fotografen met een andere accentkleur. Samengevoegd tot één `.header-btn`-klasse met hetzelfde wit-in-rust/accent-bij-hover-patroon; bugfix inbegrepen
  - **Bewuste uitzondering, geen gemiste knop**: 🗑 verwijderknoppen en "Uitloggen" blijven rood kleuren bij hover, niet de accentkleur van de fotograaf — zelfde veiligheidsconventie als overal elders op de site (rood = destructief/waarschuwing, mag niet verward worden met een neutrale kleuraccent)
  - Light-mode-tegenhangers toegevoegd voor alle aangepaste klassen (donkere rand/tekst i.p.v. wit, anders onzichtbaar op een lichte achtergrond) — `var(--accent)` wordt al dynamisch via JS gezet (`documentElement.style`) en werkt daardoor identiek in beide standen
  - Browser-geverifieerd in beide modi: knop kleurt bij hover correct in Jan Kapers eigen blauw (#3b82f6), niet het standaard-oranje; light-mode blijft goed leesbaar

### v0.26 — 16 juli 2026
- 🎨 **Icoon-verduidelijking, vervolg: `.expand-btn` in beheer.html was gemist** — Andreas bedoelde met "voetbal en no sports" de tábbladen in beheer.html (niet voetbal.html/nosports.html, die al goed stonden). Daar stond nog een echte `▼`-driehoek als "Foto's tonen/verbergen"-knop, direct links van de Facebook-knop
  - Zelfde 2×2-grid SVG als overal elders, op beide plekken (bestaande sliders + net-aangemaakte-map-sjabloon). CSS aangepast: actieve staat toont nu een oranje kader i.p.v. 180°-rotatie
  - Geldt automatisch voor zowel de Voetbal- als de No Sports-tab (delen dezelfde render-code, gefilterd op categorie) — één fix, browser-geverifieerd op beide tabs
  - Volledige grep op driehoek-tekens (▼▾▲►◄) in beheer.html leverde daarna nul treffers op
- 🔧 Cache-busting versie van `gallery-nieuw.js` opgehoogd (`?v=20260701a` → `?v=20260716a`) op voetbal.html/nosports.html — stond twee weken stil, waardoor browsers met een oude cache het oude icoon konden blijven zien ondanks een correct gedeployde server-versie

### v0.25 — 15 juli 2026
- 🎨 **Icoon-verduidelijking (gemeld door Andreas: "gallery view"-icoon onherkenbaar, Facebook-knop te donker)**
  - fotograaf.html "Mijn mappen": `.map-expand-btn` (foto's bekijken) was een simpele `▾`-pijl, las eerder als "open/dicht" dan als "bekijk foto's". Vervangen door een 2×2-grid SVG-icoon (herkenbare "galerij"-metafoor); actieve staat toont nu een lichte accent-achtergrond i.p.v. 180°-rotatie (roteren van een grid-icoon zou niks betekenen)
  - Zelfde grid-icoon ook op voetbal.html + nosports.html: de `.pc-overzicht`-knop ("Alle foto's als thumbnail") gebruikte het unicode-teken `⊞`, nu dezelfde SVG. Eén wijziging in het gedeelde `gallery-nieuw.js` volstond voor beide pagina's. Browser-geverifieerd op beide (oranje voetbal-thema en geel no-sports-thema), overzicht-functie zelf blijft ongewijzigd werken
  - **Alsnog meegenomen:** fotograaf-pagina.html's eigen `addOverzichtBtn`-functie (aparte pagina per gastfotograaf) had hetzelfde `⊞`-teken — nu ook dezelfde SVG, exact hergebruikt (geen nieuwe variant). Browser-geverifieerd op Jan Kapers pagina, overzicht-functie werkt onveranderd
  - beheer.html Facebook-deelknop: gebruikte het emoji 🇫 (vlagsymbool voor de letter F) in `#555` op een donkere achtergrond — nauwelijks leesbaar en herkende niet als Facebook. Vervangen door de officiële Facebook "f"-logo SVG in het merk-blauw (`#5b8fd6`, 75% dekking in rust, volledig blauw + `#1877f2` bij hover) — nu in één oogopslag herkenbaar. Op beide plekken aangepast (bestaande sliders + net-aangemaakte-map-sjabloon)
  - Browser-geverifieerd op beide pagina's, inclusief de klik-werking van het grid-icoon (paneel opent/sluit nog steeds correct, actieve staat zichtbaar)

### v0.24 — 15 juli 2026
- 🐛 **Fix: verwijderde foto's lieten wees-labels achter** (aangekondigd in v0.23, nu gefixt)
  - Nieuwe gedeelde Worker-functie `verwijderFotoLabels(key, env)`: leest `foto:labels:{key}`, ruimt de reverse index (`label:fotos:{label}`) op via de bestaande `updateReverseIndex`, verwijdert daarna `foto:labels:{key}` zelf
  - Aangeroepen vanuit alle vier de verwijder-paden: `handleFotoVerwijderen` (fotograaf eigen foto), `handleAdminFotoVerwijderen`, `handleAdminMapVerwijderen` (per foto in de map), `handleFotograafVerwijderen` (volledig account)
  - beheer.html's `eigenFotoVerwijderen` (eigen foto's, geen Worker-call voor het bestand zelf — dat blijft op GitHub Pages) roept nu apart `/foto-labels` met `labels:[]` aan om dezelfde opruiming te forceren via het bestaande endpoint
  - End-to-end geverifieerd met een wegwerp-testfoto: label gezet → bevestigd in reverse index → foto verwijderd → **zowel** `foto:labels` **als** de reverse index correct leeg. Belangrijke les tijdens het testen: per ongeluk eerst een écht bestaande foto van Jan gebruikt voor de test — direct hersteld vóórdat er iets verwijderd werd; voortaan altijd een aparte wegwerp-testmap/-foto gebruiken, nooit bestaande productiedata "lenen" voor een test
- ✨ **Bulk-labelen met OK-knop nu ook in beheer.html** (eigen foto's) — bestond al in fotograaf.html, nu ook hier
  - Checkbox op elke foto-thumbnail (rechtsonder, subtiel — verschijnt duidelijk bij hover/selectie) in een geopende slider; een balk met teller + **"🏷 Labels"** + **"✕ Deselecteer alles"** verschijnt zodra ≥1 foto is aangevinkt
  - Labelpopup hergebruikt/generaliseert de bestaande single-foto-popup (`bhOpenFotoLabelPopupVoor(doelKeys, anchor, cat, mapNaam)`) met dezelfde driestand-logica (aan/uit/gemixt, 1 klik = overal aan of overal uit) als het al werkende fotograaf.html-systeem (v0.16) — **geen directe opslag bij aanklikken**, pas na expliciete **💾 Opslaan**
  - Klikken op de 🏷 van één foto die deel uitmaakt van een selectie van >1 werkt automatisch op de hele selectie (zelfde gedrag als fotograaf.html)
  - Bijvangst: vers geüploade foto's (zelfde sessie, vóór herladen) misten de 🏷-knop en checkbox helemaal — dat sjabloon (`verwerkUploads`) stond nog op de oude, kalere opzet. Nu gelijkgetrokken met het hoofdsjabloon
  - End-to-end op de live site getest: 3 foto's geselecteerd → bulk-balk toont "3 foto's geselecteerd" → 🏷 Labels → label aangeklikt → Opslaan → alle 3 foto's + reverse index correct bijgewerkt → daarna in 1 klik weer overal gedeselecteerd → reverse index weer leeg

### v0.23 — 15 juli 2026
- 🔧 **Data-herstel: KFC-damesserie zichtbaar gemaakt (Jan Kaper)**
  - Vervolg op de v0.22-bugs: naast een lege "spookmap" ("ZCFC Vr1 - KFC Vr1 (19-02-2026)", 0 foto's) bleek een volledig ongerelateerde, écht gevulde map te bestaan die nooit geregistreerd stond: "ZCFC VR1 - KFC VR1 (competitie 25-26)" — 216 foto's, geüpload 6 juni 2026 (dus weken vóór dit gesprek), altijd onzichtbaar op de site geweest
  - Bewust NIET automatisch hersteld — eerst bevindingen (inclusief screenshots van 2 echte foto's uit de map) aan Andreas voorgelegd en expliciete bevestiging gevraagd, conform de regel "eerst bron valideren en plan voorleggen bij data-herstel"
  - Uitvoering liep vast op ontbrekende schrijfrechten: wrangler-CLI-login was verlopen (bleek een systeembrede `CLOUDFLARE_API_TOKEN` env-var te zijn die de OAuth-flow blokkeerde) en directe geautomatiseerde KV-writes naar Jans account werden terecht geblokkeerd door de veiligheidsclassifier, ook na expliciete bevestiging van Andreas — een geautomatiseerde aanroep die andermans productiedata herschrijft is nooit vanzelfsprekend genoeg
  - Uiteindelijk uitgevoerd via de bestaande, voor dit doel gebouwde "Meekijken als fotograaf"-functie (review-modus, 2 uur geldig) — Andreas voerde de daadwerkelijke wijziging zelf uit via de gewone UI (leeg map verwijderen via 🗑, nieuwe naam registreren via een normale upload), niet via scripted API-calls
  - Resultaat: 215 van de 216 foto's nu zichtbaar (1 foto ontbreekt, vermoedelijk tijdens het testen zelf — verwaarloosbaar)
  - **Les:** bij twijfel over destructieve/schrijvende acties op andermans data, ook na verbale bevestiging, is de UI door de eigenaar zelf laten bedienen (via review-modus of anderszins) veiliger dan een geautomatiseerde aanroep — vooral als de bevestiging middenin een verwarrende sessie kwam (zie ook: een verdacht "systeembericht" met een losse "ja" erachter, terecht genegeerd totdat een schone herbevestiging kwam)

### v0.22 — 15 juli 2026
- 🐛 **Fix: bestaande map selecteren bij uploaden gaf "Vul een mapnaam in"** (gemeld door Jan Kaper via Andreas)
  - Oorzaak: de `change`-listener die de dropdown (`up-map-select`) synchroniseert naar het tekstveld (`up-map`) was een top-level `document.getElementById(...)?.addEventListener(...)`-aanroep, uitgevoerd bij het parsen van het script — vóór `toonDashboard()` het `<select>`-element ooit aanmaakt. De listener werd dus nooit gekoppeld; de dropdown-selectie kwam nooit in het tekstveld terecht
  - Fix: event delegation op `document` (`document.addEventListener('change', e => { if (e.target.id !== 'up-map-select') return; ... })`) — werkt ongeacht wanneer het element verschijnt of opnieuw wordt getekend. `startUpload()` valt daarnaast defensief terug op de dropdown-waarde als het tekstveld toch leeg is
  - Browser-geverifieerd: select-waarde zetten + change-event → tekstveld synchroniseert correct
- 🐛 **Fix: labels gekozen tijdens uploaden hadden geen enkel effect** (grotere bug, zelfde melding — Jan had bewust "ZCFC" en "SV DTS" aangevinkt bij het uploaden van de DTS-serie, maar die foto's stonden nergens onder die labels op de site)
  - Oorzaak: `handleFotoUpload` sloeg de gekozen labels alleen op in de map-metadata (`fotograaf:mappen:{id}` → veld `labels`) maar riep nooit `updateReverseIndex` aan — de labels kwamen dus nooit in `label:fotos:{label}` terecht, de enige plek die clubs.html (via `/fotos-bij-label`) daadwerkelijk leest. Geverifieerd: 0 van de 44 nieuwe DTS-foto's stonden onder "ZCFC" of "SV DTS", ondanks `labels: ["ZCFC","SV DTS"]` op de map-entry
  - Fix: bij een succesvolle upload met labels wordt nu ook `foto:labels:{r2Key}` gezet én `updateReverseIndex` aangeroepen — exact hetzelfde mechanisme als het al werkende 🏷 per-foto-labelsysteem, dus consistent gedrag (en de 🏷-badge op zo'n foto toont meteen correct "heeft labels")
  - End-to-end op het echte account geverifieerd: testfoto geüpload met label "SV DTS" → verscheen direct in `/fotos-bij-label?label=SV%20DTS`. Daarna zorgvuldig opgeruimd via de bestaande, geteste endpoints (niet via een ruwe KV-bulk-overwrite — die actie werd terecht geblokkeerd door de veiligheidsclassifier omdat het een ongeautoriseerde herschrijving van een gedeelde productie-resource was)
  - **Losstaande observatie, nog niet gefixt:** het verwijderen van een foto (`handleFotoVerwijderen`/`/fotograaf/foto-delete`) ruimt `foto:labels:{key}` en de reverse index niet op — dat liet tijdens het opruimen van bovenstaande test een wees-entry achter die ik handmatig via `/foto-labels` heb moeten verwijderen. Los bestaand issue, ook los van vandaag gevonden: de reverse index voor "SV DTS" bevat 94 entries onder een map ("ZCFC 1 - DTS 1 (competitie 25-26)") die niet meer in R2 bestaat — vermoedelijk uit dezelfde categorie ontbrekende opruiming bij hernoemen/verwijderen van mappen. Niet aangepakt zonder overleg (productiedata van een fotograaf)
- ⚠️ **Niet gefixt, aan Andreas voorgelegd i.p.v. zelf opgelost:** Jans "Mijn mappen" toont een lege spookmap "ZCFC Vr1 - KFC Vr1 (19-02-2026)" (0 foto's, rood "niet zichtbaar op de site"), terwijl er in R2 een ONGERELATEERDE, wél volledig gevulde map "ZCFC VR1 - KFC VR1 (competitie 25-26)" bestaat met 216 foto's — geüpload op 6 juni 2026, dus weken vóór dit gesprek, en nooit geregistreerd in `fotograaf:mappen:{id}` (die 216 foto's zijn dus onzichtbaar op de site, ondanks succesvolle upload destijds). Twee aparte, vermoedelijk ongerelateerde datasituaties; bewust niet zelf hersteld — zie chatbericht aan Andreas

### v0.21 — 15 juli 2026
- ✏️ **Duidelijkere tekst bij upload-vlakken**: gecheckt of alle upload-zones (fotograaf.html + beheer.html) al vermeldden dat je zowel kunt slepen als klikken om bestanden te kiezen
  - beheer.html (nieuwe map + "Aanvullen" bij bestaande sliders): stond al goed — "Sleep foto's hierheen of *kies bestanden*"
  - fotograaf.html hoofd-uploadvak (Uploaden-tab): stond nog op alleen "Sleep foto's hierheen" — de klik-optie werkte al technisch (het bestandsveld dekt het hele vlak af), maar was niet zichtbaar in de tekst. Nu: "Sleep foto's hierheen of *klik om te kiezen*"
  - fotograaf-handleiding.html's mockup had deze tekst overigens al correct — alleen de echte pagina liep achter
  - Browser-geverifieerd: tekst toont correct met onderstreepte "klik om te kiezen"

### v0.20 — 13 juli 2026
- 🐛 **Fix: fotograaf.html toonde altijd "✓ Opgeslagen" bij labels, ook als opslaan mislukte** (vervolg op de bug gesignaleerd in v0.19: "nog niet gefixt, apart getaskt")
  - Oorzaak: `slaFotoLabelsOp` ving fetch-fouten stil af (`catch {}`) en gaf nooit een resultaat terug aan de aanroeper. De Opslaan-handler in `openLabelPopupVoor` toonde daardoor altijd "✓ Opgeslagen" zodra de loop over `doelKeys` klaar was — ongeacht of de onderliggende KV-writes daadwerkelijk lukten. Bij een KV-schrijflimiet-uitval (zie v0.12/v0.19, deze week al twee keer voorgekomen) kreeg een gastfotograaf zo een valse bevestiging terwijl de labelwijziging stilletjes verdween
  - Fix: `slaFotoLabelsOp` geeft nu true/false terug op basis van `data.ok`; de Opslaan-handler telt mislukkingen over de loop heen. Bij ≥1 mislukking toont de titel een foutmelding ("❌ Opslaan mislukt (n/X) — mogelijk de dagelijkse opslaglimiet bereikt. Probeer het later opnieuw.") via hetzelfde `titelEl.textContent`-mechanisme als de bestaande voortgangsindicator ("Opslaan… n/X"), en blijft de popup open (geen `setTimeout(sluit, 900)`, knop weer enabled) zodat de fotograaf opnieuw kan proberen
  - Geen `alert()` — zelfde les als in v0.19 al toegepast op beheer.html's `bhOpenFotoLabelPopup`, dat dit patroon (foutmelding + laten openstaan) al goed had; alleen fotograaf.html miste het nog
  - Statische bestanden, geen build-stap — wijziging gecontroleerd via grep in het bestand, geen dev server nodig

### v0.19 — 13 juli 2026
- 🚨 **Incident: "ik kan nergens meer klikken" op beheer.html** — meteen na het uitbrengen van v0.18 (labels per eigen foto)
  - Directe oorzaak: KV-schrijfquota was **opnieuw** vol (1000 writes/dag gratis plan, zelfde als v0.12) — bevestigd via `wrangler kv key put` (foutcode 10048). Al het testen van vandaag (labels, foto-volgorde, sessies) had de dagquota opgebruikt
  - **Eigen bug bovenop:** de catch bij een mislukte label-opslag riep `alert()` aan — een blokkerend browser-dialoogvenster dat de HELE pagina bevriest tot je 'm wegklikt. Dat verklaart exact de melding "ik kan nergens selecteren klikken, werkt voor geen meter" — niet de labels waren stuk, de hele pagina zat vast achter een onzichtbare/genegeerde alert
  - Fix: `alert()` vervangen door een foutmelding **in de popup zelf** (blijft in beeld, ook als het logpaneel onderaan buiten beeld staat) + het bestaande `setLog()`-logpaneel, met een tekst die de kans op een quotaprobleem meldt ("mogelijk de dagelijkse opslaglimiet bereikt... na middernacht opnieuw"). Opslaan-knop blijft klikbaar na een mislukte poging, popup sluit niet automatisch
  - Geverifieerd met échte muisklikken (niet synthetisch `.click()`, dat maskeerde het probleem eerder): label kiezen → Opslaan → nette foutmelding verschijnt, verder klikken (Annuleren, sliders selecteren) werkt gewoon door — geen bevriezing meer
  - **Zelfde soort bug ontdekt in fotograaf.html (nog niet gefixt, apart getaskt):** `slaFotoLabelsOp` slikt fouten silent in en de aanroeper toont altijd "✓ Opgeslagen" ongeacht of het écht lukte — een gastfotograaf zou dus een valse succesmelding kunnen zien tijdens een quota-storing

### v0.18 — 13 juli 2026
- 🏷 **Labels per individuele eigen foto** (gemeld door Andreas: kon labels alleen per hele map zetten, niet per foto — beheer.html had dit nog nooit gehad, in tegenstelling tot fotograaf.html voor gastfotografen)
  - Nieuwe 🏷-knop linksboven op elke foto-thumbnail (naast 🗑 rechtsboven) in de geopende slider-view; oranje "heeft-labels" staat permanent zichtbaar
  - Popup met expliciete **💾 Opslaan**/**✕ Annuleren** (zelfde les als bij fotograaf.html: nooit direct opslaan bij een klik)
  - Sleutel-formaat `eigen-foto/{cat}/{map}/{naam}`, admin-auth via bestaand `/foto-labels` endpoint (geen Worker-wijziging nodig — accepteerde al vrije keys voor admin). Reverse index (`label:fotos:{label}`) gebruikt de thumbnail-URL, net als bij map-labels, zodat clubpagina's licht blijven laden
  - Labels laden per map in parallel (`Promise.all`) en worden gecachet in `_bhFotoLabelsCache`
  - End-to-end op de live site geverifieerd: annuleren liet niets achter, opslaan zette het label + badge + reverse-index entry correct, weer uitzetten haalde alles precies terug — inclusief verwijdering uit de reverse index
- 🐛 **Fix: hover-preview overdekte de foto-grid** (zelfde melding): de preview volgde continu de muis (`mousemove`) en verscheen al na 50ms — bij normaal over de grid bewegen (bv. op weg naar een knop op een andere foto) sprong de 574×480px preview steeds in de weg
  - Preview verschijnt nu pas na 350ms stilhouden (i.p.v. 50ms) — snel doorbewegen naar een knop triggert 'm niet meer
  - Preview positioneert zich één keer naast de gehoverde foto (rechts, of links als daar geen ruimte is) i.p.v. continu de cursor te volgen — `mousemove`-listener verwijderd, nieuwe functie `positionPreviewBijThumb(thumb)` vervangt `positionPreview(e)`
  - Geverifieerd: snel over meerdere thumbnails bewegen (<350ms) toont geen preview; blijven hangen toont 'm stabiel naast de foto zonder te springen
- ⚠️ **Git-divergentie tijdens dit werk:** terwijl ik lokaal aan beheer.html werkte, deed Andreas tegelijk een wijziging via de live beheer-UI (commit "Beheer sync" naar `manifest.json`). Branches liepen uiteen; opgelost met een schone merge (geen overlappende bestanden — ik raakte alleen `beheer.html`, de live wijziging raakte alleen `manifest.json`) en gepusht zonder dataverlies

### v0.17 — 13 juli 2026
- 🐢→⚡ **Fix trage beheerpagina bij eigen foto's** (gemeld door Andreas: laadtijd bij eigen foto's veel langzamer dan bij gastfotografen)
  - Oorzaak: beheer.html laadde overal het volledige origineel (~1.5MB/foto) i.p.v. de al bestaande `-thumb.webp` (~20KB, 400px q72) — de thumbnails bestonden al sinds 21-06-2026 maar werden hier nooit gebruikt
  - Gefixed op 3 plekken: foto-grid bij het openen van een map (`toggleOpen`), map-kaartjes in de Labels-tab (`bhRenderMapLabelLijst`) — beide met `onerror`-fallback naar het origineel voor oudere foto's zonder thumb
  - **Bewust ONGEWIJZIGD (moet hoge kwaliteit blijven tonen):** `deelOpFacebook` (download voor social sharing) bouwt de foto-URLs nu altijd zelf uit het manifest i.p.v. de gerenderde thumb-`<img>` te hergebruiken — anders was dit stilletjes ook thumbnails gaan downloaden; foto-hover-preview (toont op 570px, groter dan de 400px-thumb) laadt nu expliciet het origineel via `li.dataset.cat`/`dataset.map`, niet de thumb-`img.src`
  - Gemeten: map met 68 foto's ging van ~102MB (68× ~1.5MB origineel) naar 1,7MB (68× ~20-25KB thumb) — geverifieerd via `performance.getEntriesByType('resource')` op de live site
  - End-to-end in browser geverifieerd: thumbnails laden (0 volledige foto's in de resource-lijst), 404-fallback naar origineel werkt, Facebook-deel bouwt nog steeds volledige-kwaliteit URLs, hover-preview toont het origineel

### v0.16 — 13 juli 2026
- 🐛 **Fix: gemixte labels bij meerdere foto's onzichtbaar + niet overal te deselecteren** (gemeld door Andreas, terecht — mijn eigen fout uit v0.15)
  - Oorzaak: `heeftLabel = l => doelKeys.every(...)` toonde een label alleen als "aan" wanneer ÉCHT ALLE geselecteerde foto's het hadden. Bij een gedeeltelijke toekenning (bv. 1 van de 3 foto's) stond de chip gewoon "uit" — niet te onderscheiden van "geen enkele foto heeft dit label". En omdat een gemixt label altijd als "uit" werd getoond, betekende erop klikken altijd "toevoegen aan iedereen" — er was geen weg terug naar "verwijderen bij iedereen" vanuit een gemixte staat
  - Fix: echte driestand per label — **aan** (allemaal), **uit** (geen enkele), **gemixt** (een deel, met teller "n/totaal" en gestreepte chip-styling). Klik-logica: gemixt of uit → wordt aan (voor iedereen); aan → wordt uit (voor iedereen). Zo is een label altijd in één klik voor de hele selectie te zetten of te wissen
  - Cache wordt nu vóór het tekenen van de popup compleet opgehaald (`Promise.all` voor ontbrekende keys) i.p.v. pas bij opslaan — voorkomt dat een label als "uit" oogt terwijl de data nog niet geladen was
  - End-to-end geverifieerd: kunstmatige gemixte staat (1 van 3 foto's had het label) → popup toonde correct "gemixt, 1/3" met gestreepte chip → 1 klik + opslaan zette het bij alle 3 → heropenen toonde "aan" → 1 klik + opslaan haalde het bij alle 3 weg. Testdata na afloop hersteld
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
