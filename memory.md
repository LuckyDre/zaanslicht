# Memory - zaanslicht op deze Windows-pc

_Aangemaakt: 18 juli 2026_

Dit bestand legt vast wat er op deze Windows-machine (C:\Users\lucky) met de zaanslicht-repo is gebeurd en waar je rekening mee moet houden. Zie PROJECT.md voor de algemene projectdocumentatie.

## Situatie

- De site draait live op https://zaanslicht.com via GitHub Pages.
- De Mac (`/Users/andreas/fotografie-site`) commit en pusht automatisch via watch.sh ("Auto-sync" commits).
- Deze Windows-map is op 18 juli 2026 opnieuw gecloned. Er wordt vanaf beide machines gewerkt en gepusht, de Mac is in sync. Doe voor de zekerheid altijd eerst `git pull --rebase` voordat je vanaf Windows pusht.
- Git-identiteit op deze pc is ingesteld (Andreas Luckfiel, luckfiel@gmail.com).

## Windows-specifieke aanpassingen (18 juli 2026)

De repo bevat 86 fotobestanden in mappen waarvan de naam eindigt op een spatie, bijvoorbeeld `images/voetbal/ZCFC - Sporting Krommenie 0-2 (25-26) /`. Windows kan zulke mapnamen niet aanmaken. Daarom is lokaal in deze clone ingesteld:

- `git config core.protectNTFS false` (alleen in deze repo, nodig om de paden in de git-index te kunnen zetten)
- De 86 bestanden zijn gemarkeerd met `git update-index --skip-worktree`, git negeert ze lokaal

Gevolg: die 86 foto's staan wel op GitHub maar niet op deze schijf. `git status` is gewoon schoon. Controleer de lijst met `git ls-files -v | grep '^S'`.

Definitieve oplossing: hernoem die mappen op de Mac zodat de naam niet op een spatie eindigt, dan kan deze workaround weg.

## zaanslicht-oud

De vorige Windows-clone staat als `C:\Users\lucky\zaanslicht-oud`. Die liep 2272 commits achter en had 12 eigen commits (16-19 mei 2026). Analyse van 18 juli 2026:

- watch.js, .nojekyll en CNAME uit die commits staan al identiek op GitHub
- De oude wijzigingen in index.html, main.js en style.css zijn achterhaald door nieuwere versies
- De 21 Ijburg - ZCFC 1-1 foto's staan al op GitHub onder `images/voetbal/Ijburg - ZCFC 1-1 (25-26)/` (alle 21 bestandsnamen gecontroleerd, plus thumbnails)

Conclusie: zaanslicht-oud bevat niets unieks meer en kan weg.

## Overige aandachtspunten

- De mappen `Searches/` en bestanden als `x` en `m` in de repo-root zijn ooit per ongeluk mee-gecommit door de auto-sync, ze horen niet bij de site.
- GitHub CLI (gh) is op deze pc geinstalleerd en ingelogd als LuckyDre (HTTPS).
