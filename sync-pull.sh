#!/bin/bash
# Haal de laatste versie op van GitHub

SITE="/Users/andreas/fotografie-site"
eval "$(/opt/homebrew/bin/brew shellenv zsh)"

cd "$SITE"

echo "→ Laatste versie ophalen van GitHub..."
git pull origin main

echo "✓ Klaar! De site is nu up-to-date."
read -p "Druk op Enter om te sluiten..."
