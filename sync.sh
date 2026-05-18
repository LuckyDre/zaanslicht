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
      echo "→ Wijzigingen gevonden, uploaden naar GitHub..."
      git add -A
      git commit -m "Auto-sync: $(date '+%d-%m-%Y %H:%M')"
      git push
      echo "✓ Site is bijgewerkt op https://luckydre.github.io/zaanslicht/"
    fi
done
