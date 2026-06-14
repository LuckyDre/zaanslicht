#!/bin/bash
# Auto-sync: converteert JPG→WebP en pusht naar GitHub

SITE="/Users/andreas/fotografie-site"
SIPS="/usr/bin/sips"
CWEBP="/opt/homebrew/bin/cwebp"
TMP="/tmp/zl_conv.jpg"

eval "$(/opt/homebrew/bin/brew shellenv zsh)"

echo "✓ Zaans Licht auto-sync gestart — JPG's worden automatisch omgezet en online gezet"

converteer_jpgs() {
  local gevonden=0
  for ext in jpg JPG jpeg JPEG; do
    while IFS= read -r -d '' f; do
      # Sla _originelen over
      [[ "$f" == *"_originelen"* ]] && continue
      webp="${f%.*}.webp"
      echo "  → Converteren: $(basename "$f")"
      "$SIPS" -Z 2200 "$f" --out "$TMP" >/dev/null 2>&1 && \
      "$CWEBP" -q 82 "$TMP" -o "$webp" >/dev/null 2>&1 && \
      rm "$f" && \
      echo "    ✓ $(basename "$webp")" || \
      echo "    ✗ Conversie mislukt: $(basename "$f")"
      gevonden=1
    done < <(find "$SITE/images/voetbal" "$SITE/images/nosports" -name "*.$ext" -print0 2>/dev/null)
  done
  return $gevonden
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
      if [ $? -eq 1 ]; then
        echo "→ Manifest bijwerken na conversie..."
        python3 "$SITE/generate-manifest.py"
      fi

      echo "→ Laatste versie ophalen van GitHub..."
      git pull --rebase origin main 2>/dev/null || true

      # Stap 2: kijk of er nieuwe WebP's zijn → manifest bijwerken
      NIEUWE_WEBPS=$(git status --porcelain | grep -E "images/(voetbal|nosports)/.*\.webp" | wc -l | tr -d ' ')
      if [ "$NIEUWE_WEBPS" -gt "0" ]; then
        echo "→ $NIEUWE_WEBPS nieuwe WebP foto('s) — manifest bijwerken..."
        python3 "$SITE/generate-manifest.py"
        echo "✓ Manifest bijgewerkt"
      fi

      git add -A
      git commit -m "Auto-sync: $(date '+%d-%m-%Y %H:%M')"
      git push
      echo "✓ Site bijgewerkt op https://zaanslicht.com"
    fi
done
