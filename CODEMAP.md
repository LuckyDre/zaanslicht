# CODEMAP — Zaanslicht.com

**Doel:** snel naslaan wáár alles zit, zodat er niet elke sessie opnieuw verkend hoeft te worden.
Regelnummers zijn **benaderend** (bestanden schuiven) — gebruik ze als startpunt en `grep` de functienaam/CSS-selector om te bevestigen. Bij een taak: lees dít bestand eerst, spring dan direct naar de regel. `PROJECT.md` alleen openen voor de changelog/geschiedenis van een specifiek onderdeel — niet in z'n geheel inlezen (het is groot).

## Werkwijze per sessie (efficiënt)
1. Bij **resume/start**: vraag Andreas of hij `sync-pull.sh` draaide (Mac↔PC sync), dan pas werken.
2. Lees **CODEMAP.md** (dit bestand) + evt. de relevante changelog-sectie van PROJECT.md — niet heel PROJECT.md.
3. Werk gericht: grep de functienaam uit de tabellen hieronder i.p.v. blind te verkennen.
4. **Verifiëren in de browser** blijft de norm (Andreas' vaste eis) — maar verifieer gericht, niet alles opnieuw.
5. Deploy + push aan het eind; changelog + handleidingen bijwerken.

## Deploy & verify
- **Statische site (HTML/JS/CSS):** een `fswatch`-watcher commit+pusht automatisch naar GitHub → GitHub Pages. Niets handmatig nodig; `git status` is meestal al clean.
- **GitHub Pages loopt vaak achter** (Pages throttelt door de frequente auto-commits) — poll live met een wegwerp-query `?nc=$RANDOM`; cache-buster `?v=` op JS bumpen bij JS-wijzigingen. Zie [reference_zaanslicht_deploy_cache].
- **Worker wijzigen:** `npx wrangler deploy cloudflare-worker.js` (apart, alleen als de worker wijzigt).
- **`APP_VERSIE` in fotograaf.html bumpen bij ELKE fotograaf.html-wijziging** (regel ~810) — anders krijgen fotografen de "nieuwere versie"-balk niet.
- **Verifiëren als fotograaf (bv. Jan):** Andreas opent in **beheer.html → review-modus** ("Meekijken als fotograaf") → zet een geldige review-sessie in `localStorage` (origin zaanslicht.com) en opent fotograaf.html. Ik navigeer mijn browser-tab naar fotograaf.html → dashboard rendert met echte data. Wrangler-toegang tot een fotograaf-token wordt door de classifier geblokkeerd; review-modus is de weg. Test schrijf-acties op echte data **omkeerbaar** (bv. bestaand label toevoegen→weer weghalen).

## Bestanden (grofweg)
| Bestand | Regels | Wat |
|--|--|--|
| `cloudflare-worker.js` | ~2200 | Alle API/opslag: fotografen, labels, R2-foto's, comments, competitie-cache |
| `fotograaf.html` | ~3000 | Gastfotograaf-portaal (login, upload, mappen, labels, positie, profiel) |
| `beheer.html` | ~3600 | Admin: sliders, fotografen, labels, abonnees, review-modus, lightbox |
| `gallery-nieuw.js` | ~500 | Galerij op voetbal/nosports/othersports.html (sliders + lightbox + grid) |
| `clubs.html` | ~870 | Foto's per club (leest reverse index) + competitie-standen |
| `manifest.json` | — | Eigen (Andreas') series per categorie; **géén labels-veld** (die staan in KV) |

## Worker — endpoints (router ~r2067–2180)
Auth: **Secret** = admin (`X-Worker-Secret`), **Token** = fotograaf (`X-Fotograaf-Token`), **Publiek** = geen.
| Pad | Handler | ~regel | Auth |
|--|--|--|--|
| `/fotograaf/upload` | handleFotoUpload | 714 | Token |
| `/fotograaf/labels-sync` | handleLabelsSync | 804 | Token |
| `/fotograaf/serie-labels` | handleSerieLabels | 853 | Token |
| `/fotograaf/fotos` | handleFotosLijst | 947 | Publiek (leest) |
| `/fotograaf/manifest` | handleFotograafManifest | 1001 | Publiek |
| `/fotograaf/verborgen-eigen` | handleEigenVerborgenLijst | 1129 | Token (sessie-check!) |
| `/fotograaf/map-datum` `/map-beschrijving` `/map-naam` | handleMapDatum/… | 1313+ | Token |
| `/fotograaf/map-paginas` | handleMapPaginas (op-vlaggen) | 1402 | Token |
| `/fotograaf/mappen-volgorde` | handleMappenVolgorde | 1271 | Token |
| `/foto-labels` GET/POST | handleGetFotoLabels / handleSetFotoLabels | 1614/1630 | Token of Secret |
| `/fotos-bij-label` | handleFotosBijLabel | 1668 | Publiek (clubs.html) |
| `/eigen-labels` | handleEigenLabels (cache `meta:eigen-labels`) | 1701 | Publiek |
| `/labels` GET/POST/DELETE | handleGetLabels/handleAddLabel/(inline) | 1551/1564 | GET publiek; POST token/secret |
| `/admin/map-verwijderen` `/foto-verwijderen` | handleAdminMapVerwijderen/… | 1070/1090 | Secret |
| `/admin/map-registreren` | handleMapRegistreren | 1781 | Secret |
| `/admin/labels-opschonen` | handleLabelsOpschonen (wees-opruiming) | 1715 | Secret |
| `/admin/review-sessie` | handleReviewSessie | 693 | Secret |
| `/admin/login` | handleAdminLogin (2-staps) | 594 | wachtwoord+pin |
| `/subscribe` `/aantal` | handleSubscribe / handlePublicCount | 40/95 | Publiek |
| `/foto/{key}` (`?thumb=1`) | handleFotoServe | 1946 | Publiek |

## Worker — helpers (hergebruiken!)
| Functie | ~regel | Wat |
|--|--|--|
| getFotograafByToken | 342 | Token→fotograaf; schuivende TTL; `review:`-prefix = review-sessie |
| lijstAlleR2(env, prefix) | ~852 (na labels-sync) | R2 `.list()` **met cursor-lus** — altijd gebruiken (anders afkap!) |
| verwijderR2Batch | ~866 | Bulk-delete in batches van 20 (niet 1 grote Promise.all) |
| updateReverseIndex(key, oud, nieuw, entry) | 1583 | Voegt key toe/verwijdert per label uit `label:fotos:{label}` |
| verwijderFotoLabels(key) | 1606 | Leest `foto:labels:{key}` → ruimt reverse index + de key op (bij delete) |
| bouwEigenLabels | 1681 | Bouwt `meta:eigen-labels` uit `foto:labels:eigen-map/*` |

## Datamodel
**KV (SUBSCRIBERS):**
- `fotograaf:account:{id}` = `{id, naam, email, kleur, wachtwoord, salt}` (NIET `fotograaf:{id}`)
- `fotograaf:token:{token}` = `{id}` of `review:{id}` (30d schuivende TTL; review 2u)
- `fotograaf:mappen:{id}` = `[{map, categorie, ts, labels[], opVoetbal, opNosports, opOthersports, opEigenPagina, datum, verborgen}]` — **bron van de serie-chips (`map.labels`) + op-vlaggen**
- `fotograaf:verborgen-mappen:{id}` / `:verborgen-fotos:` / `:foto-volgorde:` / `:positiebeheer:` / `:profielfoto:` / `:bio:` / `:loginlog:`
- `label:fotos:{label}` = `[{key, url, mapNaam, type, cat, fotograafId, naam, kleur, ts}]` — **reverse index** (clubs.html). Gast = per-foto entries; eigen = 1 entry type='map'.
- `foto:labels:{key}` = `[labels]` — per foto/map. Eigen-map-key = `eigen-map/{cat}/{mapNaam}`; per-foto eigen = `eigen/...`; gast = de R2-key.
- `meta:eigen-labels` (cache), `meta:subcount` (abonnee-teller), `labels:lijst`, `labels:verwijderd`

**R2 (FOTOS):** `fotografen/{id}/{cat}/{encodeURIComponent(map)}/{naam}` (+ thumbs onder `thumbs/…-thumb.webp`).
Eigen foto's van Andreas: `images/{cat}/{map}/{naam}` op GitHub Pages (niet R2).

**Twee label-lagen (belangrijk, niet verwarren):**
- **Serie-labels** = `map.labels` (→ chips in galerij) + reverse index (→ clubs.html). Gezet bij upload of via `/fotograaf/serie-labels`.
- **Per-foto labels** = `foto:labels:{fotokey}` (→ 🏷-badge per foto). Gezet via de per-foto popup binnen de geopende galerie.

## fotograaf.html — sleutelplekken
| Plek | ~regel |
|--|--|
| `const APP_VERSIE` (bumpen!) | 810 |
| controleerSessie (faalt alleen bij 401) | 838 |
| toonDashboard | 1081 |
| switchTab | 2091 |
| laadMappenTab (rendert series + knoppenrij) | 2173 |
| toggleMapFotos (galerie openen) | 2421 |
| toggleMapPagina (op-vlaggen) | 2428 |
| laadLabels / voegLabelToe | 1599 / 1613 |
| openFotoLabelPopup / openLabelPopupVoor (per-foto) | 1674 / 1702 |
| openSerieLabelPopup (serie-labels, 🏷-knop) | 1844 |
| **CSS** `.map-item` (`overflow:hidden`!) / `.map-controls` (+mobiel ~692) / `.map-expand-btn` / `.map-verberg-btn` / `.map-label-btn` / `.foto-label-popup` | 379 / 392 / 418 / 522 / ~530 / 476 |

De knoppenrij per serie (⚽/🌿/🏅/🏠 + datum + 🙈 Verberg + 🏷 Labels + ⊞ galerie) staat in `laadMappenTab` → `maakMapItem` (~r2130–2160).

## gallery-nieuw.js — sleutelplekken
| Plek | ~regel |
|--|--|
| CATEGORY / WORKER_URL | 4 / 5 |
| renderSerie (bouwt `.serie-labels` chips) | 106 |
| hoofd-render + fetch (manifest + gast + `/eigen-labels`) | ~333–449 |
| `labels: item.labels \|\| eigenLabels[`${CATEGORY}/${item.map}`]` (eigen labels) | ~415 |
| toonOverzicht (grid) / lbOpen (lightbox) | 182 / 13 |

**fotograaf-pagina.html heeft een eigen kopie** van galerij-gedrag — bij galerij-wijzigingen beide nalopen. Toont géén serie-labels.

## beheer.html — sleutelplekken
| Plek | ~regel |
|--|--|
| WORKER_URL | 839 |
| startReview (review-modus) | 1678 |
| bhRenderMapLabelLijst / bhSlaMapLabelsOp (eigen-map labels) | 3339 / 3410 |
| bhLb* (eigen lightbox) | ~3234 |

## Terugkerende valkuilen (kosten anders opnieuw debug-tijd)
- **`.list()` in Workers altijd pagineren** (cursor-lus) — anders vallen items stil weg ("onzichtbare mappen"). Gebruik `lijstAlleR2`.
- **KV-schrijflimiet 1000/dag (gratis).** Nooit KV-writes op het request-pad zonder throttle. Reverse index: **per label 1 read-modify-write met alle keys**, nooit per foto (contentie, v0.35).
- **Firebase: altijd `firebase-rest.js`** (fbGet/fbSet/fbDelete), nooit de live SDK-listener (hangt stil op prod).
- **`getBoundingClientRect()` toont afgeknipte elementen nog als "groot"** — bij zichtbaarheid meten t.o.v. de clippende voorouder of screenshotten (v0.42).
- **Dynamisch (innerHTML) ingevoegde elementen:** geen top-level `getElementById().addEventListener` — event-delegation of ná aanmaken.
- **Wrangler-auth is soms stuk**; classifier blokkeert toegang tot fotograaf-productie-auth. Schrijf-acties op andermans data: via review-modus (Andreas klikt) of omkeerbaar.
- **manifest.json heeft geen labels** — eigen-serie-labels komen via `/eigen-labels` (v0.41).

## Model/kosten
Voor dit werk is **Sonnet** ruim voldoende en veel lichter op de gebruikslimiet dan Opus. `/model claude-sonnet-5` als de limiet knelt.
