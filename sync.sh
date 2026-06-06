#!/bin/bash
# Auto-sync: detecteert wijzigingen en pusht naar GitHub

SITE="/Users/andreas/fotografie-site"
eval "$(/opt/homebrew/bin/brew shellenv zsh)"

echo "✓ Zaans Licht auto-sync gestart - wijzigingen worden automatisch online gezet"

fswatch -o "$SITE" \
  --exclude "\.git" \
  --exclude "sync\.sh" \
  --latency 5 | while read; do
    cd "$SITE"
    if [ -n "$(git status --porcelain)" ]; then
      echo "→ Wijzigingen gevonden..."
      echo "→ Laatste versie ophalen van GitHub..."
      git pull --rebase origin main 2>/dev/null || true

      # Alleen manifest bijwerken als er nieuwe fotos zijn in images/
      NIEUWE_FOTOS=$(git status --porcelain | grep -E "^(\?\?| M|A ) *images/(voetbal|nosports)/" | wc -l | tr -d ' ')
      if [ "$NIEUWE_FOTOS" -gt "0" ]; then
        echo "→ $NIEUWE_FOTOS nieuwe foto('s) gevonden — manifest bijwerken..."
        python3 "$SITE/generate-manifest.py"
        echo "✓ Manifest bijgewerkt"
      fi

      git add -A
      git commit -m "Auto-sync: $(date '+%d-%m-%Y %H:%M')"
      git push
      echo "✓ Site bijgewerkt op https://zaanslicht.com"
    fi
done
