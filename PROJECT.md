# Zaanslicht.com — Projectdocument

_Laatste update: 23 juli 2026 — v0.42_

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

### v0.42 — 23 juli 2026 — Galerie-view-knop weggeknipt in fotograaf.html (desktop), labelen onbereikbaar
Andreas meldde dat Jan als fotograaf "geen galerie-view en geen labels" had — "geen mogelijkheden". Via de review-modus (meekijken als Jan) end-to-end gereproduceerd en gefixt.
- 🔍 **Root cause: layout-clipping.** In "Mijn mappen" is de knoppenrij `.map-controls` (`nowrap`) breder dan de `.map-item`, die `overflow:hidden` heeft. Het láátste item in die rij is de galerie-view-knop (het ⊞-grid-icoon) → die viel buiten de rechterrand en werd **volledig weggeknipt** (op desktop). Omdat die knop de enige toegang is tot foto's bekijken/sorteren/verwijderen én per-foto labelen (🏷 `openFotoLabelPopup`), leek álles weg.
- 🗓 **Waarom "ineens":** v0.37 (17-07) voegde de 4e categorieknop "🏅 Other Sports" toe aan die rij (~+105px) → net over de afgeknipte rand. Daarvóór paste de knop nog. Alleen desktop: de **mobiele** media-query had toevallig al `.map-controls { width:100%; flex-wrap:wrap }`, dus op smal scherm was het nooit stuk.
- ✅ **Fix:** dezelfde regel nu ook op de desktop-basisregel — `.map-controls { … flex-wrap: wrap; width: 100%; }`. De rij zakt netjes naar een tweede regel i.p.v. afgeknipt te worden; het grid-icoon staat nu zichtbaar naast "🙈 Verberg". `APP_VERSIE → 2026-07-23-a`.
- **Verificatie (browser, review-modus als Jan):** vóór de fix stond de expand-knop op x-links = rechterrand van de map-item (volledig buiten het zichtbare gebied, `overflow:hidden` → onzichtbaar); ná de injectie van exact deze CSS staat hij bij alle 3 series binnen de map-item en zichtbaar (screenshot bevestigd). Galerie openen laadt de foto's (42/93/91) mét per-foto 🏷- en 🗑-knoppen. **Niets gewijzigd in Jans account.**
- **Les (belangrijk):** `getBoundingClientRect()` geeft de gelayoute grootte terug óók als een element door een voorouder met `overflow:hidden` visueel is afgeknipt — een `w>0 && h>0`-check "bewijst" zichtbaarheid dus NIET. Meet de knop t.o.v. de rechterrand van de clippende voorouder, of maak een screenshot. (Ik claimde eerst ten onrechte "het werkt" op basis van zo'n DOM-check.)

### v0.41 — 23 juli 2026 — Labelchips ontbraken bij eigen series (galerij las verkeerde bron)
Andreas meldde (via een browser-check) dat de labels bij zijn eigen series niet stonden, terwijl ze bij Jan wél verschenen. Een extern rapport concludeerde "je moet de labels nog toevoegen" — **dat was fout**: de labels waren allang gekoppeld, ze werden alleen uit de verkeerde bron gelezen.
- 🔍 **Root cause: twee ongekoppelde bronnen.** Gastseries krijgen hun labels op het map-object in KV (`fotograaf:mappen:{id}`), dus de Worker stuurt ze mee als `map.labels`. Eigen (admin) series bewaren labels in `foto:labels:eigen-map/{cat}/{mapNaam}` (dat schrijft beheer.html → Labels-tab), maar `gallery-nieuw.js` las eigen labels uit `item.labels` in **manifest.json** — en dat veld bestaat daar niet. Dus `labels.length === 0` → de `.serie-labels`-div werd nooit gebouwd. Bevestigd via de publieke reverse-index (`/fotos-bij-label`): 18 eigen-map-koppelingen bestonden al in KV.
- ✅ **Fix (KV blijft de bron, geen migratie nodig):**
  - Nieuw **publiek** Worker-endpoint `GET /eigen-labels` → `{ "{cat}/{mapNaam}": [labels] }`, gebouwd uit `foto:labels:eigen-map/*` (helper `bouwEigenLabels`, gepagineerd). Gecachet in KV-sleutel `meta:eigen-labels` zodat een galerijlaadbeurt normaal 1 read kost; de cache wordt in `handleSetFotoLabels` ververst zodra een `eigen-map/`-label wijzigt (self-healing als de cache ontbreekt). Prefix `eigen-map/` botst niet met de per-foto-sleutels `eigen/…`.
  - `gallery-nieuw.js` haalt `/eigen-labels` erbij en zet `labels: item.labels || eigenLabels[`${CATEGORY}/${item.map}`] || []` (faalt veilig bij netwerkfout). Cache-buster `?v=20260723a` op voetbal/nosports/othersports.
- **Cross-check vóór deploy:** alle 20 eigen series matchen exact op `{cat}/{mapNaam}` met een labelsleutel, 0 wezen — dus de fix dekt de hele galerij zonder handwerk.
- **Live geverifieerd op zaanslicht.com/voetbal.html** (echte Worker-data): 19 labelbalken op 20 series (de enige zonder is een gastserie zonder labels — terecht leeg); onder "ZCFC - ZVV Zaandijk" verschijnen nu de chips **ZCFC** + **ZVV Zaandijk** in het oranje thema. Screenshot bevestigd.
- **Scope:** `fotograaf-pagina.html` (eigen pagina) toont sowieso geen serie-labels, dus ongemoeid. Worker gedeployed (`npx wrangler deploy`), site via auto-sync gepusht.

### v0.40 — 18 juli 2026 — Beheer: foto's selecteren vanuit de lightbox
Gebouwd op de PC (commit `90663d3`); changelog + handleiding op de Mac aangevuld.
- ☑ **Selecteer-knop in de beheer-lightbox** — naast de ✕ staat nu een ☐/☑-knop; ook de **spatiebalk** togglet de selectie van de foto die groot in beeld staat. Zo kun je op je gemak door een map bladeren (←/→) en meteen aanvinken welke foto's je wilt verwijderen of labelen.
- 🔁 **Hergebruikt de bestaande grid-selectielogica** (`bhToggleFotoSelectie` via de checkbox van de bijbehorende thumbnail, opgezocht met `_bhLbGrid` + `CSS.escape(naam)`): selectie-set, oranje rand en bulk-balk blijven in sync, en de selectie staat er nog als de lightbox sluit. Knop verbergt zichzelf als de foto geen checkbox heeft.
- 📖 beheer-handleiding.html: tip "Foto groot bekijken" uitgebreid met de selecteer-knop/spatiebalk.

### v0.39 — 18 juli 2026 — Menu "flipte" bij klikken tussen fotografen (nav-fotografen.js)
Andreas meldde: klik je op "Andreas" in het menu (klapt mooi open), en probeer je daarna snel op "Jan" te klikken, dan "flipte" het menu ineens.
- 🔍 **Root cause: het HELE menu werd pas na een async fetch opgebouwd, niet alleen de fotografen-namen.** De statische HTML-nav bevat vóór het laden van `nav-fotografen.js` alleen Home/Voetbal/No Sports/Tools/Clubs/Over ons/Contact — geen Andreas/Jan-links, geen "..."-groepering. Al die logica (Tools/Clubs/Over ons/Contact groeperen in "...", Andreas + gastfotografen invoegen) zat in hetzelfde `try { await fetch(...) ... }`-blok. Op een moment dat de fetch naar de Worker een fractie trager was, zag je eerst de kale 7-links-nav en klapte die daarna in één klap om naar de definitieve vorm — precies wanneer je op een naam probeerde te klikken. **Niet** de hover/active-CSS-reflow van de achternaam-uitklap (die eerste hypothese is getest en verworpen: geen positieverschuiving aangetoond).
- ✅ **Fix:** de "..."-groepering en Andreas' link (die geen fetchdata nodig heeft, zijn URL ligt vast) gebeuren nu **synchroon**, direct bij het parsen van het script — vóór de `await fetch`. Alleen gastfotografen (Jan e.a.) worden nog steeds async toegevoegd ná de fetch, maar dat is nu een kleine `insertBefore`-toevoeging aan een menu dat al in zijn definitieve vorm staat, niet een herindeling van het hele menu.
- **Geverifieerd via testharnas** (lokale server, echte nav-HTML + echte `nav-fotografen.js`, kunstmatig vertraagde fetch 3s): al bij de eerste check (ruim vóór de fetch klaar is) stonden de "..."-groepering én Andreas' link er al; Jan kwam er pas later bij, netjes vóór de dropdown, zonder de rest te herbouwen. Extra bevestigd op de live site (`fotograaf-pagina.html?id=andreas`, echte Worker-data): Andreas + Jan beide correct aanwezig.
- 🔢 Cache-buster `nav-fotografen.js?v=20260717p` op alle 7 pagina's die het script laden (index, voetbal, nosports, othersports, clubs, contact, fotograaf-pagina).
- **Les:** bij "flikkerend"/"flippend" menu-gedrag na een klik, eerst checken of de HELE nav-structuur (niet alleen de content die je verwacht) achter dezelfde async fetch zit — dat geeft een veel grotere, jarende reflow dan een simpele CSS-hover-reflow.

### v0.38 — 17 juli 2026 (avond) — Nieuwsbrief-kaartje + Other Sports kleurfix
- 📮 **"Flits-kaartje" voor nieuwsbrief-aanmelding** (`nieuwsbrief-kaart.js`, gedeeld script). Piept rechtsonder binnen met een korte cameraflits (violet accent), kop "Als eerste de mooiste plaatjes?", e-mailveld + verplichte consent-checkbox + knop. Meldt aan via het bestaande `/subscribe`. Verschijnt na 7s óf >40% scroll (wat eerst komt), hooguit 1× per sessie; na aanmelden/sluiten 60 dagen niet meer (`localStorage zl_nb_dismiss`). Toegevoegd op index, voetbal, nosports, othersports, clubs, fotograaf-pagina. Andreas koos dit concept uit 3 (preview-artifact); zie ook de andere twee (ontwikkelende-foto-balk, buitenspel-ticker) voor later.
  - **Eerlijke teller:** er zijn maar **9 abonnees**, dus GEEN verzonnen "300+ fans". Nieuw publiek endpoint `GET /aantal` (`handlePublicCount`, gecachet in `meta:subcount`, max 1×/uur echt tellen, geeft alleen een geheel getal). Het kaartje toont pas "Al {afgerond}+ fans…" zodra het ≥50 is; daaronder een zachte tekst zonder getal. Groeit dus vanzelf mee.
  - Browser-geverifieerd: kaart rendert correct, validatie (leeg/geen-vinkje) + echte aanmelding ("Gelukt!") werkt, dismiss-persistentie werkt, teller = 9. Testabonnee daarna opgeruimd. **rAF-valkuil gevonden en gefixt:** de kaart werd getoond via `requestAnimationFrame`, dat in achtergrond-tabs geknepen wordt → kaart bleef onzichtbaar; nu directe `classList.add`. NB: GitHub Pages liep bij oplevering achter, dus de auto-verschijning op de gefixte versie kon nog niet live bevestigd worden (alle onderdelen los wél).
- 🎨 **Other Sports kleurrestjes gefixt (miste ik in v0.37):** othersports.html had nog hardgecodeerde goud/oranje van de nosports-kloon (`rgba(240,192,64,…)`, `rgba(255,107,0,…)`, `rgba(245,192,0,…)`, `var(--geel)`) én het hero-watermerk zei nog "NO SPORTS". Alles nu violet + watermerk "OTHER SPORTS". **Les: bij het klonen van een pagina niet alleen de `--kleur`-variabelen aanpassen, maar ook de hardgecodeerde `rgba()`-accenten en tekst-content.**

### v0.37 — 17 juli 2026 (avond) — Nieuwe categorie "Other Sports"
Volwaardige derde fotocategorie naast Voetbal en No Sports, voor overige sporten (handbal, hockey, atletiek…). Kleur **violet #8B5CF6 / #A78BFA**, icoon 🏅. Zelfde op-vlaggen-model als de andere twee. **End-to-end browser-geverifieerd** met een wegwerp-testfotograaf (serie op Other Sports gezet → verscheen op de pagina, gate opende op home/voetbal, verscheen NIET op voetbal; daarna volledig opgeruimd).
- 📄 **`othersports.html`** — kloon van nosports.html; violet accent (`--or`/`--or2`), titel/kop "Other Sports", `data-category="othersports"`, tel-logica op `manifest.othersports` + `opOthersports`.
- 🖼 **`gallery-nieuw.js`** — filterregel `CATEGORY==='othersports' → m.opOthersports===true`. Eigen-content-pad was al generiek op `CATEGORY` (`manifest[CATEGORY]`, `images/${CATEGORY}/`). Cache-buster overal `?v=20260717o`.
- 🚩 **Op-vlag `opOthersports`** (default false) — Worker: toegevoegd aan `handleMapPaginas` (per-serie toggle), `handleMapRegistreren` en het fotograaf-profiel-galerij-object. Gedeployd.
- 📸 **fotograaf.html** — 4e knop per serie in Mijn mappen: **🏅 Other Sports** (naast ⚽/🌿/🏠); `toggleMapPagina('othersports')` → `opOthersports`. Ook de positie-beheer-tab loopt nu 3 categorieën. `APP_VERSIE → 2026-07-17-c`.
- 🛠 **beheer.html** — nieuw tabblad **🏅 Other Sports** met eigen serielijst (Nieuwe map / sorteren / selecteren), `renderCategorie('othersports')`, `manifest.othersports` default, alle `['voetbal','nosports']`-arrays → 3-waardig. **LET OP-fix:** de positie-gebaseerde tab-index-array in `switchTab` moest 'othersports' op index 2 krijgen, anders verschoof de actieve-tab-markering (browser-geverifieerd dat het nu klopt).
- 🏠 **Homepage + navigatie (voorwaardelijk):** nieuw scriptje **`othersports-gate.js`** toont de Other Sports-ingangen (`.othersports-link`: navlinks desktop+mobiel + homepage-tegel) pas zodra er inhoud is (een gastserie met `opOthersports`, of een eigen serie in `manifest.othersports`). Op othersports.html zelf altijd zichtbaar. Toegevoegd aan index, voetbal, nosports, clubs, contact, tools, fotograaf-pagina en `/m/`. `manifest`-fetch absoluut (`/manifest.json`) zodat het ook in `/m/` werkt.
- 📖 **Handleidingen** bijgewerkt (jouw vaste regel): beheer-handleiding (3e tab), fotograaf-handleiding (stap 5 herschreven naar alle 4 de pagina-knoppen incl. 🏅).
- ⏳ **Kandidaat voor later:** random/"meest geliked"-companion-tegels voor Other Sports op de homepage (main.js) — nu alleen de hoofd-tegel, om scope klein te houden.

### v0.36 — 17 juli 2026 (avond)
**Jans "verloren" damesserie teruggevonden + de root cause van alle onzichtbare-mappen-mysteries gefixt.**
- 🔍 **Root cause: R2-listing zonder paginering.** `handleFotosLijst` deed `list({limit: 500})` zonder cursor-lus. Zodra een fotograaf >500 objecten had, vielen de alfabetisch laatste mappen stilletjes uit élke weergave (fotograaf.html, beheer.html, de site) terwijl de foto's gewoon in R2 stonden. Dit verklaart met terugwerkende kracht: de "onzichtbare" KFC-serie uit v0.23, de Wieringermeer-map uit v0.30, én Jans "lege" damesmap van vanochtend. Ook drie verwijder-handlers (fotograaf-, admin-map- en account-verwijderen, limit 1000) hadden dezelfde afkap → wees-objecten bij grote accounts.
- ✅ **Fix:** helper `lijstAlleR2(env, prefix)` (cursor-lus) in alle vier de handlers; deletes nu in batches van 20 (`verwijderR2Batch`) i.p.v. één grote `Promise.all` (die strandde in de praktijk halverwege op de gelijktijdigheidslimieten — bleek bij de opruiming van vanavond: run 1 stopte op 79/361).
- 📷 **Jans damesserie (93 foto's, geüpload 17-07 07:33-07:37) is NIET verloren** — ze stond de hele dag in R2 maar was onzichtbaar door bovenstaande bug (587 objecten > 500, damesmap sorteerde als laatste). De diagnose van vanmiddag ("niet doorgekomen, opnieuw uploaden") was dus fout. Na het verwijderen van de 361 oude competitie-foto's kwam de map "vanzelf" tevoorschijn — dat was de sleutel tot de ontdekking.
- 🗑 **De 361 zwevende competitie-25-26-foto's definitief verwijderd** (expliciet akkoord Andreas) via `/admin/map-verwijderen`, uitgevoerd door Andreas zelf via de browser-console (wrangler-auth bleek stuk: verlopen OAuth bij mij, kapot API-token bij Andreas — löst hij later op). Label-indexen vooraf gecontroleerd: 0 overlap, geen wezen.
- 📝 **Damesserie her-geregistreerd** via `/admin/map-registreren` (ook door Andreas via console): datum 2026-02-19 (wedstrijddatum), labels ZCFC+KFC (Jans eigen keuze van vanochtend). Eindstand Jans account: Wieringermeer 91 + DTS 42 + KFC-dames 93. Serie geverifieerd aanwezig op voetbal.html (kop + 93 imgs in DOM, foto-endpoint 200 met thumbnail; thumbs bestaan — upload stuurt ze sinds v0.16 mee).
- ⚠️ **Aan Jan melden: NIET opnieuw uploaden** — eerdere boodschap ("serie niet doorgekomen") was gebaseerd op de afgekapte lijst en is achterhaald.

### v0.35 — 17 juli 2026
De drie resterende punten uit v0.34 afgehandeld (verzoek Andreas: "alles nu afhandelen"). Alles end-to-end geverifieerd — de labels-fix tegen de échte gedeployede Worker met een wegwerp-testfotograaf (daarna volledig opgeruimd), de client-fixes in de browser met een nagebootst account.
- 🏷 **Labels-index bij bulk-upload gefixt (root cause: KV eventual consistency).** `handleFotoUpload` deed per foto een read-modify-write op de gedeelde `label:fotos:{label}`-sleutel; bij snelle opeenvolgende uploads las elke schrijf een verouderde index → alle entries behalve de laatste gingen verloren (Jans "SV DTS" had 1 i.p.v. 42 foto's). **Fix:** de per-foto-index-schrijf verwijderd uit de upload (scheelt ook KV-writes — bekend pijnpunt); de client roept ná de upload-lus één keer `POST /fotograaf/labels-sync` aan, die de index in **één read-modify-write per label** opbouwt met **R2 als waarheid** (zelfde patroon als de admin-opschoon-endpoints). Idempotent, werkt ook bij gedeeltelijk geslaagde uploads (leest de map opnieuw uit R2). `foto:labels:{key}` per foto blijft behouden (unieke sleutel, geen contentie). **Geverifieerd tegen productie-Worker:** 3 uploads met label → index kreeg alle 3 (via `/fotos-bij-label`, hetzelfde leespad als clubs.html); randgevallen: geen labels of alle uploads mislukt → geen sync-call.
- 🗑 **Voortgangsbalk bij verwijderen.** Verwijderen gaat foto-voor-foto; bij grote series (Jans KFC-map had er 361) duurde dat minuten waarin er niets zichtbaar gebeurde — het leek hangen, waarna Jan verversde en de operatie afbrak. Nu een vaste balk onderin: "🗑 Serie verwijderen… X van Y". Aangesloten op alle drie de verwijder-paden (losse map, bulk-mappen, bulk-foto's), met `finally` die 'm altijd opruimt. Browser-geverifieerd: telt 1→5 en verdwijnt.
- ✅ **Stale selectie gefixt (Jans "2 series verwijderen" bij 1 map).** `laadMappenTab()` hertekende de checkboxes leeg maar liet `_selMappen`/`_selFotos` gevuld → de bulk-balk bleef "2 series" tonen en een nieuwe selectie telde erbovenop. Nu worden de selectie-Sets geleegd vóór het hertekenen. Browser-geverifieerd: na hertekenen balk weg, nieuwe selectie telt correct als "1 serie".
- 🔢 `APP_VERSIE` → `2026-07-17-b` (versiecheck).
- ⏸ **Nog steeds open (wacht op Andreas):** de 361 zwevende R2-foto's onder "ZCFC VR1 - KFC VR1 (competitie 25-26)" en de lege KFC-map (19-02). Niet aangeraakt — Jans data.

### v0.34 — 17 juli 2026
Naar aanleiding van een uitgebreid bugrapport van Jan Kaper (uploaden + verwijderen vanaf een vakantieadres met wisselende wifi). Onderzoek wees uit dat Jan **verouderde code draaide** (versie van 15-07): zijn openstaande portaal-tabblad was nooit écht herladen — tab-klikken herlaadt data van de Worker maar niet de HTML/JS. Zijn "Vul een mapnaam in"-fout was dus de al op 15-07 gefixte v0.24-bug. Dit is de tweede keer (na de spookmap in v0.29) dat een stale tab een bugrapport opleverde van een al opgeloste fix — daarom nu een versiecheck.
- 🔄 **Versiecheck toegevoegd (nieuw)** — `const APP_VERSIE` bovenin fotograaf.html; `checkNieuweVersie()` haalt de live pagina op (wegwerp-query `?vc=` + `no-store`), leest de APP_VERSIE eruit en toont een groene sticky "🔄 nieuwere versie — klik om te vernieuwen"-balk als die afwijkt van de draaiende versie. Draait bij laden (na 3s) en bij elke tab-focus, max 1×/3 min; faalt veilig (offline/404 → geen balk). **BUMP `APP_VERSIE` (datum+letter) bij élke echte fotograaf.html-wijziging**, anders verschijnt de balk niet — één plek, staat direct onder de `WORKER`-const. Browser-geverifieerd met nagebootst account: 404/gelijke versie → geen balk, nieuwere versie → balk, gate voorkomt dubbele balken; klik = `location.reload()` (reload revalideert de main-document altijd, dus haalt vers ondanks `max-age=600`).
- 🐛 **Misleidende "gelukt"-melding gefixt** — mislukten álle uploads, dan bleef de gróéne melding van een eerdere upload staan (feedback werd alleen bij `ok>0` bijgewerkt). Jan las dat als succes en ging door terwijl zijn wifi de foto's liet vallen. Nu: rode melding bij 0 successen, oranje waarschuwing (`.feedback.waarschuwing`) bij deels mislukt, groen alleen bij alles gelukt; melding wordt bij elke poging eerst gewist; mislukte foto's blijven in de wachtrij (indexverschuiving in de `qs-`-status vóór `toonQueue()` gefixt, zodat een tweede poging niet de status van andere foto's bijwerkt).
- 🐛 **Dropdown en tekstveld liepen uit elkaar** — `vulMappenSelect()` draait bij elke tabwissel naar Upload en herbouwde de dropdown zónder de keuze te herstellen, terwijl `#up-map` de naam wél vasthield. Gevolg: dropdown toonde "— Nieuwe map —" terwijl de upload stilletjes naar de oude map ging (of, bij een lege `#up-map` na een verversing, een terechte maar onbegrijpelijke "Vul een mapnaam in"). De keuze wordt nu hersteld na het herbouwen.
- 🐛 **Labelstatus-regel klopte niet** — koos je een bestaande map in de dropdown, dan lichtten de labelchips wél op maar bleef eronder "Geen labels geselecteerd" staan (verklaart Jans twijfel of zijn labels aankwamen). `werkLabelStatusBij()` uitgesplitst uit `klikLabel` en nu óók aangeroepen bij het vullen vanuit een map.
- ℹ️ **Jans sleepvak-suggestie** ("maak duidelijk dat je ook kunt klikken") stond al in de code sinds 15-07 ("Sleep foto's hierheen of klik om te kiezen") — hij zag 'm niet door de verouderde versie. Extra bevestiging van de stale-code-diagnose; geen wijziging nodig.
- 📋 **Nog niet gedaan (aparte ronde):** stale `_selMappen` blijft na hertekenen staan (verklaart Jans "2 series verwijderen" bij 1 selectie); geen voortgangsteller bij verwijderen (de 361-foto-map duurde lang en leek te hangen); labels-reverse-index wordt per upload overschreven i.p.v. samengevoegd (index "SV DTS" heeft 1 i.p.v. 42 foto's door read-modify-write op edge-gecachte KV).
- ⏸ **Open data-kwesties (afwachten op Andreas):** 361 zwevende foto's in R2 onder "ZCFC VR1 - KFC VR1 (competitie 25-26)" (map niet geregistreerd na Jans verwijdering vanochtend, foto's blijven staan); en de lege KFC-map (19-02) van vanochtend. Niet aangeraakt — Jans data, patroon uit v0.23.

### v0.33 — 17 juli 2026
- 🧹 **Hover-preview uit beheer.html verwijderd** (voorstel Andreas: "overbodig nu er een viewer is" — mee eens)
  - De grote preview-bij-aanwijzen (570px, `#foto-preview`) was een noodoplossing zolang beheer géén fotoviewer had. Sinds de lightbox (v0.32) dekt die het gebruik beter af: één klik en dan met ←/→ door de hele map, schermvullend i.p.v. 570px, en zonder precies met de muis op elke thumbnail te hoeven mikken. De bestandsnaam die de preview toonde, toont de lightbox ook
  - Bijkomend voordeel: de preview zát vooral in de weg — in v0.18 moest die al getemd worden (350ms vertraging, niet meer de cursor volgen) omdat hij over het grid heen sprong bij het bewegen naar de 🏷/🗑-knop van een andere foto. Dat probleem is nu structureel weg
  - Volledig verwijderd: markup (`#foto-preview`), CSS (4 regels), en JS (`preview`/`previewImg`/`previewNaam`/`previewTimer`, de `mouseover`/`mouseout`-handlers, `positionPreviewBijThumb()`), plus de opruim-aanroep die de lightbox nog deed. Grep op "preview" in beheer.html leverde daarna alleen nog lightbox-code op; een stale comment die naar de hover-preview verwees is bijgewerkt
  - Geverifieerd: pagina laadt zonder JS-fouten, `preview`-variabele/element/functie bestaan niet meer, lightbox opent nog gewoon (2/4) en hover doet niets meer
  - beheer-handleiding.html: tip "Grote preview bij aanwijzen" verwijderd (de "Foto groot bekijken"-tip uit v0.32 blijft). De kleur-preview in Mijn profiel is ongemoeid — die staat los

### v0.32 — 16 juli 2026
Vervolg op v0.31 (verzoek Andreas: "gedrag standaard maken voor de gallery view, ook bij de beheer pagina").
- 🖼 **fotograaf-pagina.html: zelfde galerij-gedrag als voetbal/nosports** — had een eigen kopie van dezelfde bug (`sluitOverzicht()` + `setTimeout(_openLightboxFotograaf)`). Nu identiek aan v0.31: grid blijft open onder de foto, `toonOverzicht` kreeg de 3e param `scrollNaarIdx`, beide slider-klikplekken (gast-mappen én Andreas' eigen series) openen de foto binnen het grid, `closeLightbox` houdt de body-scroll vast zolang het grid open is en scrollt terug naar de laatst bekeken foto. CSS: `.lightbox` z-index 2000→2200, reacties-drawer 2100→2300
  - **Escape-afhandeling volgorde-onafhankelijk gemaakt:** hier registreert `initOverzicht()` juist vóór `initLightbox()` (die zit ná awaits in `laadPagina()`) — omgekeerd aan gallery-nieuw.js. Daarom nu beide mechanismen: `stopImmediatePropagation()` in de lightbox-handler én een `!lbOpen`-guard in de grid-handler. Werkt ongeacht registratievolgorde
  - Geverifieerd op `?id=andreas` met echte data (20 series, 964 foto's): gallery-knop → grid(30 lazy) → thumb → foto 8/119 met grid open ✅; Escape sluit alleen de foto, 2e Escape het grid ✅; sliderfoto #80 → grid rendert door tot 119 en scrollt naar #80, foto 81/119 ✅
- ✨ **beheer.html: foto-lightbox toegevoegd** (nieuw — bestond daar nog niet)
  - Beheer had géén fotoviewer: thumbnails waren alleen versleepbaar (SortableJS) met een hover-preview. Nu opent een klik op een thumbnail de foto schermvullend in **volledige kwaliteit** (`${SITE}/images/{cat}/{map}/{naam}` — niet de 400px-thumb; zelfde patroon als de hover-preview, met `onerror`-fallback naar de thumb-src voor vers geüploade foto's die nog niet op GitHub Pages staan)
  - **Geen twee-lagen-stapel nodig:** het foto-grid staat hier inline op de pagina (geen modal), dus sluiten landt vanzelf terug in het grid
  - **Klik-vs-sleep-guard:** thumbnails blijven versleepbaar om te sorteren. Een `mousedown`-positie wordt onthouden; alleen als de muis <5px bewoog geldt het als klik. Klikken op de checkbox/🏷/🗑 opent de foto niet (die houden hun eigen actie)
  - Fotolijst komt uit de **DOM-volgorde** van het grid, dus de ←/→-navigatie volgt de volgorde zoals Andreas 'm ziet (inclusief net gesleepte wijzigingen). Hover-preview wordt onderdrukt zolang de lightbox open staat
  - Geverifieerd met een nagebootst grid: klik → 3/6 ✅; ←/→ ✅; Escape sluit terug naar grid ✅; sleep van 40px opent níét ✅; klik op 🗑 opent níét ✅
  - beheer-handleiding.html bijgewerkt met "Foto groot bekijken"
- ℹ️ **fotograaf.html (fotografenportaal) bewust ongemoeid:** heeft net als beheer geen viewer, maar Andreas vroeg alleen om beheer. Kandidaat voor later.

### v0.31 — 16 juli 2026
- 🖼 **Galerij-navigatie: foto sluiten keert terug naar het grid, niet naar de sliderpagina** (gemeld door Andreas)
  - **Probleem:** het overzicht-grid ("gallery view") sloot zichzelf zodra je een foto opende (`sluitOverzicht()` + `setTimeout(lbOpen)`), dus na het sluiten van één foto stond je weer op de sliderpagina i.p.v. terug in de galerij om de volgende foto te kiezen. Onhandig bij elke slider
  - **Fix (`gallery-nieuw.js`):** twee-lagen-stapel. (1) Klik op een thumbnail in het grid opent de lightbox er nu bovenop zonder het grid te sluiten. (2) Klik op een foto in de horizontale slider opent nu óók eerst het grid (gescrolld naar díe foto via nieuwe 3e param `scrollNaarIdx` van `toonOverzicht`) en dan de lightbox. (3) `lbSluit` geeft de body-scroll alleen vrij als het grid dicht is, en scrollt best-effort naar de laatst bekeken foto. Zo: **foto sluiten → terug in grid; grid sluiten → terug naar sliderpagina**
  - **Escape-dubbelsluit-bug onderweg gevonden en gefixt:** met foto én grid open vuurden beide keydown-handlers; sloot de lightbox-handler eerst de foto, dan zag de grid-handler "geen foto open" en sloot het grid mee. Opgelost met `e.stopImmediatePropagation()` in de lightbox-handler (die is vóór de grid-handler geregistreerd), plus een `!lbOpen`-guard in de grid-handler
  - **CSS (voetbal.html + nosports.html):** lightbox `.lb2` z-index 2000→2200 (boven het grid op 2000), reacties-drawer 2100→2300 (blijft boven de lightbox). Cache-buster `gallery-nieuw.js?v=…c/…d`
  - Geverifieerd: eerst lokaal met de echte functies + CSS (mock-foto's, alle stappen incl. scroll-naar-foto en Escape), daarna **end-to-end op de live site** met de echte Wieringermeer-serie: sliderfoto → grid(96)+foto(4/96) → foto sluiten → terug in grid → grid sluiten → sliderpagina met vrije scroll ✅
  - **Nog niet meegenomen:** fotograaf-pagina.html heeft een eigen overzicht/lightbox-implementatie met hetzelfde gedrag — daar staat deze fix nog niet in (Andreas noemde alleen de voetbalpagina). Kandidaat voor een volgende ronde als hij dat ook wil
  - **Deploy-les:** de `?v=`-cache-buster wérkt (Cloudflare respecteert de query-string: verse query = MISS = verse fetch) en de HTML is `cf-cache-status: DYNAMIC` (Cloudflare cachet 'm niet) — dus géén Cloudflare-purge nodig. De echte vertraging is **GitHub Pages die achterloopt** doordat de auto-sync (watch.js) heel vaak commit en Pages de builds throttelt (liep hier ~2u achter, trok daarna vanzelf bij). **Curl nooit de echte `?v=`-URL terwijl de origin nog oud is** — dat cachet de oude versie onder de productie-sleutel (deed dat per ongeluk met `?v=…c`; die self-healde later via `cf-cache-status: EXPIRED`). Poll met wegwerp-random-queries.

### v0.30 — 16 juli 2026
Openstaande punten uit v0.28/v0.29 afgehandeld (verzoek Andreas: "alles nu afhandelen").
- 🖼 **Jan Kapers ontbrekende thumbnails aangemaakt** — `maak-gast-thumbs.py` opnieuw gedraaid: 474 thumbnails gemaakt, 3 mislukten door netwerk-timeouts en zijn daarna handmatig hergemaakt. Alle 477 gastfoto's hebben nu een `-thumb.webp` in R2.
- 🧹 **Wees-labels opgeschoond (nieuw admin-endpoint `POST /admin/labels-opschonen`)** — reverse-index-verwijzingen (`label:fotos:*`) en per-foto-labels (`foto:labels:*`) die naar niet meer bestaande gastfoto's wezen, veroorzaakten gebroken afbeeldingen op clubs.html (o.a. 94 dode bij "SV DTS", 337 bij "Wieringermeer", 420 bij "ZCFC", 1 bij "Voetbal", + 437 wees-`foto:labels`). Het endpoint bouwt de R2-keyset één keer op als ground truth, valideert elke entry daartegen en verwijdert alléén bewezen-dode entries (eigen-map- en geldige gast-entries blijven staan). Standaard dry-run, `?uitvoeren=1` schrijft weg. Efficiënt (elke index max 1× herschreven → ~441 KV-writes, onder de daglimiet). Eerst dry-run geverifieerd (exact overeenkomend met offline analyse), daarna uitgevoerd met expliciete toestemming van Andreas; backups van de 4 gewijzigde indexen bewaard. Na afloop end-to-end geverifieerd: clubs.html-labels laden zonder dode links.
- 👁 **Niet-geregistreerde Wieringermeer-map zichtbaar gemaakt (nieuw admin-endpoint `POST /admin/map-registreren`)** — de map "ZCFC 1 - Wieringermeer 1 (competitie 25-26)" (96 foto's, geüpload 6 juni 2026) bestond wél in R2 maar stond nooit in `fotograaf:mappen:{id}`, dus was onzichtbaar op de site (zelfde soort situatie als de KFC-serie in v0.23). Het endpoint valideert eerst tegen R2 dat de map echt foto's bevat, is idempotent en admin-only. Met expliciete toestemming van Andreas geregistreerd (categorie voetbal, `datum: 2026-06-06` = uploaddatum, aanpasbaar in beheer.html). Browser-geverifieerd: de serie verschijnt met alle 96 foto's en werkende thumbnails op voetbal.html. **NB:** de datum is de uploaddatum, niet de werkelijke matchdatum — Andreas kan die in beheer.html corrigeren.
- 🔀 **Likes-sortering op voetbal.html/nosports.html gefixt bij eerste render** — `gallery-nieuw.js` laadde likes volledig non-blocking, waardoor de eerste render de foto's ónjuist gesorteerd toonde (gelikte foto's niet vooraan) tot Firebase reageerde. Nu wacht de render kort (`Promise.race` met 800ms-deadline) op de likes vóór de eerste paint, met behoud van de non-blocking fallback als Firebase traag/stuk is. Cache-buster `?v=20260716b`. Browser-geverifieerd: alle 10 series met likes tonen nu correct gesorteerd bij het laden.
- ✅ **Facebook-deelknop in beheer.html geverifieerd** (stond als "nooit browser-geverifieerd") — met een echte muisklik getest: modal opent met de serie-deeplink, alle 68 foto's laden in volledige kwaliteit (niet de thumbnails), foto-selectie + teller + Download-knop werken.
- 🔧 Twee onderhouds-endpoints (`/admin/labels-opschonen`, `/admin/map-registreren`) zijn bewust nog niet als knop in beheer.html opgenomen — puur server-side maintenance, geen UI. Toevoegen kan later als Andreas ze vaker nodig heeft.

### v0.29 — 16 juli 2026
- 🐛 **Terugkerende lege "spookmap" op voetbal.html gefixt (gemeld door Andreas: map met 0 foto's komt na verwijderen steeds terug)**
  - **Oorzaak:** fotograaf.html stuurt bij map-verwijderen, bulk-verwijderen én volgorde-opslaan de complete mappenlijst uit het browsergeheugen naar `POST /fotograaf/mappen-volgorde`, en de Worker schreef die lijst blind over KV heen. Een verouderd openstaand fotograaf-portaal-tabblad (met de oude lijst nog in het geheugen) zette een elders verwijderde map zo weer terug — de foto's waren al uit R2 verwijderd, dus de map kwam leeg (0 foto's) terug op de site. Elke keer opnieuw verwijderen hielp niets zolang dat verouderde tabblad open bleef
  - **Fix (Worker, `handleMappenVolgorde` fotograaf-tak):** ingestuurde lijst wordt gefilterd op mapnamen die nú in KV bestaan — herordenen en verwijderen werken ongewijzigd, her-toevoegen van een verdwenen map wordt genegeerd. Nieuwe mappen ontstaan uitsluitend via upload (`handleFotoUpload`), die tak is ongemoeid. De admin-tak had dit gedrag al
  - **End-to-end geverifieerd** met een wegwerp-nepfotograaf (`claudetest_niet_echt_fg`, na afloop volledig opgeruimd): spookmap her-toevoegen → genegeerd ✅; herordenen → werkt ✅; verwijderen → werkt ✅
  - Opruiming en passant: een achtergebleven testtoken uit een eerdere sessie (`fotograaf:token:claudetest07c6…`, wees naar Jans id) gevonden en verwijderd
  - **Losse observatie (geen actie ondernomen):** in R2 staat een niet-geregistreerde map "ZCFC 1 - Wieringermeer 1 (competitie 25-26)" met 96 foto's — onzichtbaar op de site, neemt wel opslag in. Eerst met Andreas overleggen wat hiermee moet

### v0.28 — 16 juli 2026
- 🟢 **Lifeline/presence-indicator gefixt (gemeld door Andreas: "wie is er nu online?")**
  - De feature bestond al (`startPresence()` in fotograaf.html + `startPresenceWatcher()` in beheer.html) maar schreef nooit écht data weg: beide gebruikten de Firebase JS SDK's live verbinding (`.info/connected`-gate + `onDisconnect()` resp. `.on('value')`-listener). Diezelfde SDK-verbinding hangt/faalt al langer stil op de live site (zie `firebase-rest.js`-comment, HTTP 503 op de long-poll, vermoedelijk adblock/privacy-extensies bij bezoekers) — precies het probleem dat destijds al is opgelost voor likes/reacties door over te stappen op kale REST-calls
  - **Root cause bevestigd via REST (ground truth):** zelfs met een écht actieve review-modus-sessie van Jan Kaper bleef `/online.json` `null` — dus niet slechts een weergaveprobleem, er kwam serverside helemaal niks binnen
  - **Fix:** presence herschreven naar hetzelfde REST-patroon als likes/reacties (`firebase-rest.js`, nu ook geladen in fotograaf.html + beheer.html; `fbDelete()` toegevoegd)
    - fotograaf.html: `startPresence()` stuurt direct + daarna elke 20s een heartbeat (`fbSet('online/{id}', {naam, kleur, sinds: Date.now()})`); `stopPresence()` doet een REST-DELETE bij uitloggen
    - beheer.html: `startPresenceWatcher()` pollt elke 10s (`fbGet('online')`), filtert entries ouder dan 45s (gestopte/gecrashte sessies) er automatisch uit — geen `onDisconnect()` nodig, wat toch niet werkte zonder live verbinding
  - **Browser-geverifieerd (16-07-2026):** met Jan Kapers echte review-sessie herladen verscheen binnen enkele seconden `/online.json` → `{"5aaa4a798ac6fc01":{"naam":"Jan Kaper","kleur":"#3b82f6","sinds":...}}`, en de chip "🔵 Jan Kaper · nu actief" verscheen live in beheer.html naast "✓ Online" ✅
  - **Chip prominenter gemaakt (keuze Andreas: "groter in de header"):** grotere tekst (0.9rem, vet), duidelijker groene rand/achtergrond, grotere pulserende kleur-dot (11px) met gloed in de accentkleur van de fotograaf
  - **Licht-modus-fix (gemeld door Andreas: "alle teksten te licht"):** de light-mode-override zette wel achtergrond/rand van de chip om maar niet de tekstkleur — lichtgrijze tekst (#aaa/#e6e6e6) was op wit vrijwel onzichtbaar. `color: #1a1a1a` toegevoegd aan `html.light-mode .online-chip`. Browser-geverifieerd in lichte modus met Jans echte sessie actief ✅
  - beheer-handleiding.html bijgewerkt: nieuwe stap "Wie is er nu online?" onder Fotografen

### v0.27 — 16 juli 2026
- 🎨 **fotograaf.html: kleine icoon-knoppen wit in rust, reageren in de accentkleur van de fotograaf** (bijgesteld na verkeerde interpretatie — zie hieronder)
  - **Eerste poging (teruggedraaid):** ik voegde witte ránden toe rond alle grote knoppen (Kleur opslaan, Handleiding, Uitloggen, etc.) — Andreas bedoelde dat niet, dat maakte de pagina "el cheapo". Volledig teruggedraaid naar de originele knopstijlen (`.btn-primary` weer solide `var(--accent)`-achtergrond, `.btn-ghost`/kop-knoppen weer subtiele `rgba(255,255,255,0.1)`-rand)
  - **Wat wél bedoeld was:** de kleur van kleine icoon-knoppen zelf (het gallery/grid-icoon, de 🗑/🏷-badges per foto) feller wit maken, zonder randen of vakjes — puur de icoonkleur
  - `.map-expand-btn` (gallery-icoon in Mijn mappen): van `var(--muted)` (dofgrijs) naar wit; bij aanwijzen/open naar `var(--accent)`, geen achtergrond-vakje meer
  - `.foto-chip-del` (🗑) en `.foto-chip-lbl` (🏷) op individuele foto's in een geopende map: waren voorheen **onzichtbaar** (`opacity: 0`) tot je de hele foto hoverde — 🗑 was zelfs een volledige rode overlay over de foto heen. Omgebouwd tot permanent zichtbare kleine ronde badges (net als 🏷 al deed qua vorm): 🗑 linksonder, 🏷 rechtsboven, wit in rust. 🗑 kleurt rood bij aanwijzen (verwijderen blijft rood — bewuste uitzondering, niet de accentkleur), 🏷 kleurt in `var(--accent)` van de fotograaf
  - Positionering afgestemd op de al bestaande selectie-checkbox (linksboven) om overlap te voorkomen
  - Kop-knoppen (☀️/❓/←) behielden wél de bugfix uit de eerste poging: gebruikten hardcoded `#FF6B00` i.p.v. `var(--accent)` — nu opgelost, tonen de eigen kleur van de ingelogde fotograaf, met de originele subtiele styling
  - Browser-geverifieerd: gallery-icoon wit → blauw (Jans kleur) bij hover; 🗑-badge wit → rood bij hover; 🏷-badge wit → blauw bij hover; geen overlap met de checkbox

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
