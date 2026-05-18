// Zaans Licht - Auto watcher
// Maak een nieuwe map aan in images/ en deze script doet de rest.

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IMAGES_DIR = path.join(__dirname, 'images');
const INDEX_HTML = path.join(__dirname, 'index.html');
const POLL_MS    = 2000;   // check elke 2 seconden
const COPY_WAIT  = 5000;   // wacht 5s zodat foto's klaar zijn met kopiëren

// --- Hulpfuncties ---

function getImageDirs() {
  return fs.readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function getImagesInDir(dirName) {
  const dirPath = path.join(IMAGES_DIR, dirName);
  return fs.readdirSync(dirPath)
    .filter(f => /\.(webp|jpg|jpeg|png|gif)$/i.test(f))
    .sort();
}

function toId(name) {
  return 'cat-' + name.toLowerCase().replace(/\s+/g, '-');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- HTML bijwerken ---

function addNavItem(html, name) {
  // Voorkom dubbele toevoeging
  if (html.includes(`href="#${toId(name)}"`)) return html;
  const navItem = `<a href="#${toId(name)}">${capitalize(name)}</a>`;
  return html.replace(
    `<a href="#over">Over mij</a>`,
    `${navItem}\n      <a href="#over">Over mij</a>`
  );
}

function addPortfolioCategory(html, name, images) {
  const id = toId(name);
  // Voorkom dubbele toevoeging
  if (html.includes(`id="${id}"`)) return html;

  const slides = images.map(img =>
    `          <div class="swiper-slide"><img src="images/${name}/${img}" alt="${capitalize(name)}" /></div>`
  ).join('\n');

  const block = `
    <!-- ${capitalize(name)} -->
    <div class="portfolio-category" id="${id}">
      <h3>${capitalize(name)}</h3>
      <div class="swiper portfolio-swiper">
        <div class="swiper-wrapper">
${slides}
        </div>
        <div class="swiper-button-prev"></div>
        <div class="swiper-button-next"></div>
      </div>
    </div>
`;

  return html.replace('  </section>\n\n  <!-- LIGHTBOX -->', block + '  </section>\n\n  <!-- LIGHTBOX -->');
}

// --- Site updaten en pushen ---

function updateSite(dirName) {
  const images = getImagesInDir(dirName);
  if (images.length === 0) {
    console.log(`  Geen foto's gevonden in "${dirName}", overgeslagen.`);
    return;
  }

  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  html = addNavItem(html, dirName);
  html = addPortfolioCategory(html, dirName, images);
  fs.writeFileSync(INDEX_HTML, html, 'utf8');

  console.log(`  ✓ "${capitalize(dirName)}" toegevoegd aan site (${images.length} foto's)`);

  try {
    execSync(`git -C "${__dirname}" add -A`);
    execSync(`git -C "${__dirname}" commit -m "Auto: categorie '${dirName}' toegevoegd (${images.length} foto's)"`);
    execSync(`git -C "${__dirname}" push`);
    console.log(`  ✓ Gepusht naar GitHub — site wordt bijgewerkt\n`);
  } catch (err) {
    console.error('  Git fout:', err.message);
  }
}

// --- Polling loop ---

let knownDirs = new Set(getImageDirs());

console.log('');
console.log('┌─────────────────────────────────────────┐');
console.log('│  Zaans Licht - watcher actief           │');
console.log('│  Maak een map aan in images/            │');
console.log('│  Druk op Ctrl+C om te stoppen           │');
console.log('└─────────────────────────────────────────┘');
console.log(`\nBekende mappen: ${[...knownDirs].join(', ')}\n`);

setInterval(() => {
  const currentDirs = new Set(getImageDirs());

  for (const dir of currentDirs) {
    if (!knownDirs.has(dir)) {
      knownDirs.add(dir);
      console.log(`→ Nieuwe map gevonden: "${dir}" — even wachten tot foto's klaar zijn...`);
      setTimeout(() => updateSite(dir), COPY_WAIT);
    }
  }
}, POLL_MS);
