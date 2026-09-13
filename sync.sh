#!/bin/bash
# Auto-sync: converteert JPG→WebP en pusht naar GitHub

SITE="/Users/andreas/fotografie-site"
SIPS="/usr/bin/sips"
CWEBP="/opt/homebrew/bin/cwebp"
TMP="/tmp/zl_conv.jpg"

eval "$(/opt/homebrew/bin/brew shellenv zsh)"

echo "✓ Zaans Licht auto-sync gestart — JPG's worden automatisch omgezet en online gezet"

# othersports ontbrak in deze lijst, waardoor een JPG in die categorie nooit
# werd omgezet en dus nooit op de site kwam.
FOTO_MAPPEN=("$SITE/images/voetbal" "$SITE/images/nosports" "$SITE/images/othersports")

# Zet om wat er OP DIT MOMENT ligt. Vult OMGEZET en MISLUKT.
converteer_ronde() {
  OMGEZET=0
  MISLUKT=0
  while IFS= read -r -d '' f; do
    # Sla _originelen over
    [[ "$f" == *"_originelen"* ]] && continue
    webp="${f%.*}.webp"
    echo "  → Converteren: $(basename "$f")"
    if "$SIPS" -Z 2200 "$f" --out "$TMP" >/dev/null 2>&1 && \
       "$CWEBP" -q 82 "$TMP" -o "$webp" >/dev/null 2>&1 && \
       rm "$f"; then
      echo "    ✓ $(basename "$webp")"
      OMGEZET=$((OMGEZET + 1))
    else
      echo "    ✗ Conversie mislukt: $(basename "$f")"
      MISLUKT=$((MISLUKT + 1))
    fi
  done < <(find "${FOTO_MAPPEN[@]}" \( -iname "*.jpg" -o -iname "*.jpeg" \) -print0 2>/dev/null)
}

# Eén ronde is niet genoeg. Een grote serie omzetten duurt minuten, en foto's die
# in die tijd binnenkomen ziet de `find` van die ronde niet meer. Kwam er daarna
# geen bestandswijziging meer, dan draaide dit script niet opnieuw en bleven ze
# als JPG liggen — onzichtbaar op de site, zonder foutmelding (13-09-2026: 19 van
# de 111 foto's van ZCFC - ZVC). Dus: doorgaan tot er niets meer om te zetten is.
# Een foto die nog aan het kopiëren was mislukt; die krijgt twee herkansingen.
converteer_jpgs() {
  local totaal=0 herkansingen=0

  while true; do
    converteer_ronde
    totaal=$((totaal + OMGEZET))

    if [ "$OMGEZET" -gt 0 ]; then
      herkansingen=0          # er kwam werk bij: gewoon nog een ronde
      sleep 3                 # even wachten, kopieën kunnen nog bezig zijn
      continue
    fi

    # Niets omgezet. Liggen er nog JPG's (mislukt of half gekopieerd)?
    if [ "$MISLUKT" -gt 0 ] && [ "$herkansingen" -lt 2 ]; then
      herkansingen=$((herkansingen + 1))
      echo "  … $MISLUKT foto('s) mislukt — herkansing $herkansingen van 2 over 10s"
      sleep 10
      continue
    fi

    break
  done

  if [ "$MISLUKT" -gt 0 ]; then
    echo "‼️  $MISLUKT foto('s) konden niet worden omgezet en staan NIET op de site."
    echo "‼️  Ze liggen nog als JPG in de map — controleer of het bestand heel is."
  fi

  [ "$totaal" -gt 0 ] && return 1
  return 0
}

fswatch -o "$SITE" \
  --exclude "\.git" \
  --exclude "sync\.sh" \
  --latency 5 | while read; do
    cd "$SITE"
    if [ -n "$(git status --porcelain)" ]; then
      echo "→ Wijzigingen gevonden..."

      # Stap 1: converteer alle JPG's naar WebP vóór de commit
      converteer_jpgs
      GECONVERTEERD=$?

      # Stap 2: zijn er nieuwe WebP's? Dan thumbnails maken én het manifest
      # bijwerken. (Moet vóór de commit: kijkt naar nog niet-vastgelegde
      # wijzigingen.) De thumbnail-stap stond tot 13-09-2026 los — je moest
      # zelf `python3 maak-thumbs.py` draaien en dat werd vergeten. Zonder
      # -thumb.webp laadt elk raster de 2200px-versie: ~25x te veel data.
      # maak-thumbs.py slaat foto's met een bestaande thumb over, dus dit is
      # goedkoop als er niets nieuws is.
      NIEUWE_WEBPS=$(git status --porcelain | grep -iE "images/(voetbal|nosports|othersports)/.*\.webp" | wc -l | tr -d ' ')
      if [ "$GECONVERTEERD" -eq 1 ] || [ "$NIEUWE_WEBPS" -gt "0" ]; then
        echo "→ Thumbnails maken..."
        python3 "$SITE/maak-thumbs.py"
        echo "→ Manifest bijwerken..."
        python3 "$SITE/generate-manifest.py"
        echo "✓ Thumbnails en manifest bijgewerkt"
      fi

      git add -A
      git commit -m "Auto-sync: $(date '+%d-%m-%Y %H:%M')"

      # Stap 3: PAS NA de commit ophalen van GitHub. Vóór de commit is de werkmap
      # altijd vuil (dat is juist waarom dit script draait) en weigert een rebase;
      # die fout werd voorheen weggeslikt, waarna de push stil faalde en er lokaal
      # commits bleven liggen. De beheer-tool commit óók rechtstreeks naar GitHub,
      # dus divergentie is normaal en dit moet hier goed gaan.
      echo "→ Laatste versie ophalen van GitHub..."
      if ! git pull --rebase origin main; then
        git rebase --abort 2>/dev/null
        echo "‼️  CONFLICT bij het samenvoegen met GitHub — NIET gepusht."
        echo "‼️  Je werk staat veilig in een lokale commit. Los het handmatig op:"
        echo "‼️     cd $SITE && git pull --rebase origin main"
        continue
      fi

      if git push; then
        echo "✓ Site bijgewerkt op https://zaanslicht.com"
      else
        echo "‼️  PUSH MISLUKT — je wijziging staat NIET online."
        echo "‼️  Je werk staat veilig in een lokale commit. Probeer: cd $SITE && git push"
      fi
    fi
done
