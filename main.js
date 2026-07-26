// ===== HERO SLIDER (wordt geïnitialiseerd na het laden van foto's) =====

// Haal gastfotograafnamen op en update hero-teksten dynamisch
async function laadHeroFotograafNamen() {
  try {
    const res  = await fetch('https://zaanslicht-updates.ntxzjzzg8m.workers.dev/fotograaf/manifest');
    const data = await res.json();
    const namen = (data.fotografen || [])
      .filter(fg => fg.mappen && fg.mappen.length > 0)
      .map(fg => fg.naam);
    if (!namen.length) return;

    const alleFotografen = ['Andreas Luckfiel', ...namen];
    const tekst = 'Fotografie door ' + alleFotografen.join(', ');

    // Werk alle hero-teksten bij
    ['voetbal', 'nosports'].forEach(cat => {
      HERO_TEKSTEN[cat].forEach(slide => { slide.p = tekst; });
    });

    // Update lopende hero-slide als die al draait
    const pEl = document.querySelector('.hero-slide.actief p');
    if (pEl && !window._fotograafActief) pEl.textContent = tekst;
  } catch (e) {
    // stil falen — statische tekst blijft staan
  }
}

const HERO_TEKSTEN = {
  voetbal: [
    { h1: 'Het Zaanse <span>licht</span>',       p: 'Fotografie door Andreas Luckfiel' },
    { h1: 'Elk moment <span>telt</span>',         p: 'Fotografie door Andreas Luckfiel' },
    { h1: 'De Zaanstreek <span>in beeld</span>',  p: 'Fotografie door Andreas Luckfiel' },
    { h1: 'Actie en <span>emotie</span>',         p: 'Fotografie door Andreas Luckfiel' },
    { h1: 'Zaans <span>voetbal</span>',           p: 'Fotografie door Andreas Luckfiel' },
  ],
  nosports: [
    { h1: 'Voorbij <span>de sport</span>',        p: 'Fotografie door Andreas Luckfiel' },
    { h1: 'Licht en <span>landschap</span>',      p: 'Fotografie door Andreas Luckfiel' },
    { h1: 'Mensen en <span>momenten</span>',      p: 'Fotografie door Andreas Luckfiel' },
    { h1: 'De Zaanstreek <span>in beeld</span>',  p: 'Fotografie door Andreas Luckfiel' },
    { h1: 'Architectuur en <span>natuur</span>',  p: 'Fotografie door Andreas Luckfiel' },
  ],
};

// Start ophalen zodra pagina geladen is
laadHeroFotograafNamen();

const THEMA_KLEUR = { voetbal: '#FF6B00', nosports: '#F5C000' };

// Globaal beschikbaar voor fotograaf-tegels
window._fotograafActief = false;

window.vulHeroVoorFotograaf = function(fotos, naam) {
  window._fotograafActief = true;
  if (typeof vulHeroEnStart === 'function') {
    HERO_TEKSTEN._fotograaf = fotos.slice(0, 5).map(() => ({
      h1: `Fotografie door <span>${naam}</span>`,
      p:  'Zaans Licht',
    }));
    vulHeroEnStart(fotos, '_fotograaf');
  }
};

let heroSwiper    = null;
let huidigThema   = 'voetbal';
let wisselBusy    = false;
let themaTimer    = null;

function vulHeroEnStart(fotos, thema) {
  const wrapper = document.getElementById('hero-wrapper');
  if (!wrapper) return;
  const teksten = HERO_TEKSTEN[thema] || HERO_TEKSTEN.voetbal;
  // Kies elke load 5 willekeurige uit de top-pool (top 20 meest geliked) → afwisseling, blijft 'beste werk'
  const selectie = shuffle(fotos).slice(0, 5);
  wrapper.innerHTML = selectie.map((f, i) => {
    const t = teksten[i % teksten.length];
    // Elke hero-foto is nu willekeurig → standaard gecentreerde crop (CSS: background-position center)
    // Achtergrond wordt hieronder gezet door zetGroteAchtergrond (groot → src).
    return `<div class="swiper-slide">
      <div class="slide-overlay"><h1>${t.h1}</h1><p>${t.p}</p></div>
    </div>`;
  }).join('');

  // De hero laadde tot v0.48 het camera-origineel (tot 15 MB per foto); nu de
  // 2200px-versie, met terugval naar het origineel voor foto's zonder -groot.
  wrapper.querySelectorAll('.swiper-slide').forEach((slide, i) => {
    zetGroteAchtergrond(slide, selectie[i]);
  });

  if (heroSwiper) { heroSwiper.destroy(true, true); heroSwiper = null; }
  heroSwiper = new Swiper('.hero-swiper', {
    loop: true,
    effect: 'fade',
    fadeEffect: { crossFade: true },
    speed: 1000,
    autoplay: { delay: 5000, disableOnInteraction: false },
    pagination: { el: '.hero-swiper .swiper-pagination', clickable: true },
    navigation: {
      nextEl: '.hero-swiper .swiper-button-next',
      prevEl: '.hero-swiper .swiper-button-prev',
    },
  });
}

// ── Thema wisselen (kleur + hero) ──────────────────────────────────────────
function wisselThema(thema, fotosVoetbal, fotosNosports, direct = false) {
  clearTimeout(themaTimer);
  // Bij klik: direct. Hover naar nosports: snel (150ms). Terug naar voetbal: traag (1500ms).
  const vertraging = direct ? 0 : thema === 'nosports' ? 150 : 1500;
  themaTimer = setTimeout(() => {
    if (huidigThema === thema || wisselBusy) return;
    huidigThema = thema;
    wisselBusy  = true;

    // Fotograaf-modus uitzetten
    window._fotograafActief = false;

    // Ruim inline fotograaf-kleur op (CSS mask pikt --oranje automatisch op)
    document.body.style.removeProperty('--oranje');

    // Body-klasse wisselen — CSS doet de rest via body.thema-nosports variabelen
    document.body.classList.toggle('thema-nosports', thema === 'nosports');

    // Hero fade-out → swap → fade-in
    const heroEl = document.getElementById('hero');
    heroEl.style.transition = 'opacity 0.35s ease';
    heroEl.style.opacity    = '0';

    setTimeout(() => {
      // Annuleer als fotograaf-modus tussendoor geactiveerd is
      if (window._fotograafActief) { heroEl.style.opacity = '1'; wisselBusy = false; return; }
      const fotos = thema === 'nosports' ? fotosNosports : fotosVoetbal;
      vulHeroEnStart(fotos, thema);
      heroEl.style.opacity = '1';
      setTimeout(() => { wisselBusy = false; }, 400);
    }, 350);
  }, 120); // klein debounce tegen flikkeren bij snel bewegen
}

// ── Afbeeldingen stil preloaden ────────────────────────────────────────────
function preloadFotos(fotos) {
  // Preload het formaat dat de hero straks ook echt toont (2200px), niet het origineel.
  fotos.slice(0, 5).forEach(f => { const img = new Image(); img.src = f.groot || f.src; });
}

// Foto-arrays beschikbaar buiten loadTegels voor nav-hover
let _topVoetbal = [], _topNosports = [];

// ===== HELPERS =====
function photoKeyMain(path) {
  return path.replace(/\//g, '__').replace(/\./g, '--');
}

function getAllFotos(manifest, category) {
  const fotos = [];
  (manifest[category] || []).forEach(item => {
    item.fotos.forEach(f => {
      const basis = `images/${category}/${encodeURIComponent(item.map)}/`;
      fotos.push({
        src:   basis + encodeURIComponent(f),
        thumb: basis + encodeURIComponent(f.replace(/\.webp$/i, '-thumb.webp')),
        groot: basis + encodeURIComponent(f.replace(/\.webp$/i, '-groot.webp')),
        path: `${category}/${item.map}/${f}`
      });
    });
  });
  return fotos;
}

// Grote weergave (hero, slideshow) van een eigen foto. -groot (2200px) bestaat
// alleen voor foto's die breder waren; de rest houdt zijn origineel op Pages.
// Samen dekken die twee alles: sinds v0.48 staan de masters in R2 en is het
// origineel van juist die foto's niet meer via Pages op te halen.
function zetGroteAchtergrond(el, foto) {
  if (!el || !foto) return;
  const test = new Image();
  test.onload  = () => { el.style.backgroundImage = `url('${foto.groot}')`; };
  test.onerror = () => { el.style.backgroundImage = `url('${foto.src}')`; };
  test.src = foto.groot;
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function setTilebg(elId, fotos) {
  if (!fotos.length) return;
  const pick = fotos[Math.floor(Math.random() * fotos.length)];
  const el   = document.getElementById(elId);
  // Tegelachtergrond op de 400px-thumb: die bestaat voor élke eigen foto en is
  // ruim genoeg voor een tegel. Een CSS-achtergrond kent geen onerror-terugval,
  // dus hier is een gegarandeerd bestaand formaat nodig.
  if (el) el.style.backgroundImage = `url('${pick.thumb || pick.src}')`;
}

// Haal top-gelikte foto's op uit Firebase (max N stuks)
async function getTopLiked(fotos, maxN) {
  try {
    const counts = (await fbGet('likes')) || {};
    const sorted = [...fotos]
      .map(f => ({ ...f, likes: counts[photoKeyMain(f.path)] || 0 }))
      .sort((a, b) => b.likes - a.likes);
    // Als er gelikte foto's zijn, neem top N; anders willekeurig
    const hasLikes = sorted[0]?.likes > 0;
    return hasLikes ? sorted.slice(0, maxN) : shuffle(fotos).slice(0, maxN);
  } catch {
    return shuffle(fotos).slice(0, maxN);
  }
}

// ===== TEGELS LADEN =====
async function loadTegels() {
  try {
    const res      = await fetch('manifest.json?v=' + Date.now());
    const manifest = await res.json();

    const allVoetbal  = getAllFotos(manifest, 'voetbal');
    const allNosports = getAllFotos(manifest, 'nosports');

    // ── Achtergronden ──────────────────────────────────────────────────────
    setTilebg('bg-voetbal',  allVoetbal);
    setTilebg('bg-nosports', allNosports);

    // Top-liked ophalen voor beide categorieën
    const [topVoetbal, topNosports] = await Promise.all([
      getTopLiked(allVoetbal,  20),
      getTopLiked(allNosports, 20),
    ]);
    _topVoetbal  = topVoetbal;
    _topNosports = topNosports;

    // ── Hero vullen met top-5 meest gelikte voetbalfoto's ──────────────────
    vulHeroEnStart(topVoetbal, 'voetbal');

    // Nosports foto's stil preloaden zodat ze direct klaarstaan bij hover
    preloadFotos(topNosports);

    setTilebg('bg-random',         shuffle(allVoetbal));
    setTilebg('bg-random-nosports', shuffle(allNosports));
    setTilebg('bg-liked-voetbal',  topVoetbal);
    setTilebg('bg-liked-nosports', topNosports);

    // ── Klikgedrag ─────────────────────────────────────────────────────────
    bindTegel('tegel-random',          () => { wisselThema('voetbal',  topVoetbal, topNosports, true); startSlideshow(shuffle(allVoetbal).slice(0, 10)); });
    bindTegel('tegel-liked-voetbal',   () => { wisselThema('voetbal',  topVoetbal, topNosports, true); startSlideshow(topVoetbal); });
    bindTegel('tegel-random-nosports', () => { wisselThema('nosports', topVoetbal, topNosports, true); startSlideshow(shuffle(allNosports).slice(0, 10)); });
    bindTegel('tegel-liked-nosports',  () => { wisselThema('nosports', topVoetbal, topNosports, true); startSlideshow(topNosports); });

    // ── Thema-hover: nosports tegels → geel, voetbal tegels → oranje ───────
    const nosportsTegels = ['tegel-nosports', 'tegel-random-nosports', 'tegel-liked-nosports'];
    const voetbalTegels  = ['tegel-voetbal',  'tegel-random',          'tegel-liked-voetbal'];

    nosportsTegels.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('mouseenter', () => {
        document.body.style.removeProperty('--oranje');
        wisselThema('nosports', topVoetbal, topNosports);
      });
    });
    voetbalTegels.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('mouseenter', () => {
        document.body.style.removeProperty('--oranje');
        wisselThema('voetbal', topVoetbal, topNosports);
      });
    });

    // Geen mouseleave op grid: thema blijft staan tot de andere zone actief wordt

    // ── Nav-links ook koppelen aan thema ──────────────────────────────────
    document.querySelectorAll('nav a').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.includes('nosports')) {
        a.addEventListener('mouseenter', () => wisselThema('nosports', topVoetbal, topNosports));
      } else if (href.includes('voetbal') || href === '#hero' || href === 'index.html') {
        a.addEventListener('mouseenter', () => wisselThema('voetbal', topVoetbal, topNosports));
      }
    });

  } catch (e) {
    console.error('Tegels laden mislukt:', e);
  }
}

function bindTegel(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click',   fn);
  el.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); });
}

// Globaal beschikbaar voor gastfotograaf-tegels in index.html
window.setFotograafKleur = function(kleur, fotos, naam) {
  clearTimeout(themaTimer);
  document.body.style.setProperty('--oranje', kleur);
  // Logo-kleur via CSS mask + --oranje variabele (exact match, geen filter nodig)
  if (fotos?.length) window.vulHeroVoorFotograaf(fotos, naam || '');
};

window.resetFotograafKleur = function() {
  document.body.style.removeProperty('--oranje');
};

function hexNaarHueMain(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? (g-b)/d + (g<b?6:0)
        : max === g ? (b-r)/d + 2
        :             (r-g)/d + 4;
  return Math.round(h * 60);
}

// ── GASTFOTOGRAAF TEGELS ──────────────────────────────────────────────────
const WORKER_URL_MAIN = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

const _tegelsP       = loadTegels();
const _commentsP     = loadRecentComments();
// Manifest één keer ophalen, delen tussen tegels en nieuwste-serie
const _manifestPromise = fetch(WORKER_URL_MAIN + '/fotograaf/manifest').then(r => r.json()).catch(() => ({}));
const _gastP         = laadGastTegels();
const _serieP        = laadNieuwsteSerie();

// Na alle async content: herscrol naar #over als we er vanuit een andere pagina naartoe navigeerden
if (window.location.hash === '#over') {
  Promise.all([_tegelsP, _commentsP, _gastP, _serieP, _manifestPromise])
    .finally(() => document.getElementById('over')?.scrollIntoView({ behavior: 'instant' }));
}

async function laadGastTegels() {
  try {
    const data = await _manifestPromise;
    const fotografen = (data.fotografen || []).filter(fg => fg.mappen && fg.mappen.length > 0);

    const container = document.querySelector('.tegel-grid');
    if (!container) return;

    // Andreas Luckfiel — eigen tegels uit manifest.json
    try {
      const manifest = await fetch('manifest.json?v=' + Date.now()).then(r => r.json());
      const eigenFotos = [
        ...(manifest.voetbal || []),
        ...(manifest.nosports || []),
      ].flatMap(item => (item.fotos || []).map(f => ({
        src: `images/${item.map ? ('voetbal/' + encodeURIComponent(item.map) + '/' + encodeURIComponent(f)) : f}`,
      })));

      // Bouw achtergrond-urls uit manifest. Objecten met src + groot, zodat de
      // slideshow de 2200px-versie kan tonen en op het origineel kan terugvallen.
      const bgUrls = [];
      for (const cat of ['voetbal', 'nosports']) {
        for (const item of (manifest[cat] || [])) {
          for (const f of (item.fotos || [])) {
            const basis = `images/${cat}/${encodeURIComponent(item.map)}/`;
            bgUrls.push({
              src:   basis + encodeURIComponent(f),
              thumb: basis + encodeURIComponent(f.replace(/\.webp$/i, '-thumb.webp')),
              groot: basis + encodeURIComponent(f.replace(/\.webp$/i, '-groot.webp')),
              // path is nodig voor getTopLiked (sorteert op likes via photoKeyMain).
              // Ontbrak hier, waardoor de tegel 'Favoriet' stil terugviel op willekeurig.
              path:  `${cat}/${item.map}/${f}`,
            });
          }
        }
      }

      if (bgUrls.length) {
        // Kleur ophalen uit worker (valt terug op oranje)
        let kleur = '#FF6B00';
        try {
          const pr = await fetch(WORKER_URL_MAIN + '/profiel/andreas');
          const pd = await pr.json();
          if (pd.kleur) kleur = pd.kleur;
        } catch {}

        const shuffled = shuffle([...bgUrls]);
        const t1 = maakGastTegel('andreas-main', kleur, `
          <div class="tegel-icon">📸</div>
          <h2>Andreas Luckfiel</h2>
          <p>Bekijk portfolio</p>`);
        t1.addEventListener('click', () => { window.location.href = 'fotograaf-pagina.html?id=andreas'; });

        const t2 = maakGastTegel('andreas-random', kleur, `
          <div class="tegel-icon">&#127922;</div>
          <h2>Verrassing</h2>
          <p>10 willekeurige foto's van Andreas</p>`);
        t2.addEventListener('click', () => {
          startSlideshow(shuffled.slice(0, 10));
        });

        const t3 = maakGastTegel('andreas-likes', kleur, `
          <div class="tegel-icon">&#10084;</div>
          <h2>Favoriet</h2>
          <p>Meest gelikete foto's van Andreas</p>`);
        t3.addEventListener('click', async () => {
          const fotos = bgUrls.map(src => ({ src }));
          const top = fotos.length ? await getTopLiked(fotos, fotos.length) : [];
          if (top.length) startSlideshow(top);
          else window.location.href = 'fotograaf-pagina.html?id=andreas';
        });

        [t1, t2, t3].forEach((t, i) => {
          const bg = t.querySelector('.tegel-bg');
          if (bg && shuffled[i]) bg.style.backgroundImage = `url('${shuffled[i]}')`;
        });

        const rij = document.createElement('div');
        rij.style.cssText = 'display:contents';
        rij.appendChild(t1); rij.appendChild(t2); rij.appendChild(t3);
        const heroFotos = shuffled.slice(0, 5).map(src => ({ src }));
        [t1, t2, t3].forEach(t => {
          t.addEventListener('mouseenter', () => {
            if (window.setFotograafKleur) window.setFotograafKleur(kleur, heroFotos, 'Andreas Luckfiel');
          });
        });
        container.appendChild(rij);
      }
    } catch(e) { console.warn('Andreas tegels:', e); }

    for (const fg of fotografen) {
      const fotosRes  = await fetch(`${WORKER_URL_MAIN}/fotograaf/fotos?id=${fg.id}`);
      const fotosData = await fotosRes.json();
      const alleFotos = fotosData.fotos || [];

      // Galerij-foto's: alleen echte mappen, nooit profielfoto
      const mappenMetFotos = new Set();
      for (const m of (fg.mappen || [])) {
        const heeftFotos = alleFotos.some(f => {
          try { return decodeURIComponent(f.key).includes(`/${m.map}/`); } catch { return false; }
        });
        if (heeftFotos) mappenMetFotos.add(m.map);
      }

      const galerij = alleFotos
        .filter(f => {
          if (f.key.includes('/profiel.')) return false;
          const delen = f.key.split('/');
          if (delen.length < 5) return false;
          try {
            const decoded = decodeURIComponent(f.key);
            return [...mappenMetFotos].some(m => decoded.includes(`/${m}/`));
          } catch { return false; }
        })
        .map(f => ({ src: `${WORKER_URL_MAIN}/foto/${f.key}`, path: f.key }));

      // Achtergrond: galerij-foto's bij voorkeur, anders profielfoto
      const profielfoto = alleFotos.find(f => f.key.includes('/profiel.'));
      const bgFotos = galerij.length > 0 ? galerij : (profielfoto ? [{ src: `${WORKER_URL_MAIN}/foto/${profielfoto.key}`, path: profielfoto.key }] : []);
      if (!bgFotos.length) continue;

      const kleur  = fg.kleur || '#3b82f6';
      const prefix = `gast-${fg.id}`;


      // Tegel 1: naar pagina van fotograaf
      const t1 = maakGastTegel(`${prefix}-main`, kleur, `
        <div class="tegel-icon">📸</div>
        <h2>${fg.naam}</h2>
        <p>Bekijk portfolio</p>`);
      t1.addEventListener('click', () => { window.location.href = `fotograaf-pagina.html?id=${fg.id}`; });

      // Tegel 2: verrassing — alleen als er galerij-foto's zijn
      const t2 = maakGastTegel(`${prefix}-random`, kleur, `
        <div class="tegel-icon">&#127922;</div>
        <h2>Verrassing</h2>
        <p>10 willekeurige foto's van ${fg.naam}</p>`);
      t2.addEventListener('click', () => {
        if (galerij.length) startSlideshow(shuffle([...galerij]).slice(0, 10));
        else window.location.href = `fotograaf-pagina.html?id=${fg.id}`;
      });

      // Tegel 3: favoriet (meest gelikt)
      const t3 = maakGastTegel(`${prefix}-likes`, kleur, `
        <div class="tegel-icon">&#10084;</div>
        <h2>Favoriet</h2>
        <p>Meest gelikete foto's van ${fg.naam}</p>`);
      t3.addEventListener('click', async () => {
        const top = galerij.length ? await getTopLiked(galerij, galerij.length) : [];
        if (top.length) startSlideshow(top);
        else window.location.href = `fotograaf-pagina.html?id=${fg.id}`;
      });

      // Achtergronden: willekeurig uit beschikbare fotos
      const geshuffled = shuffle([...bgFotos]);
      [t1, t2, t3].forEach((t, i) => {
        const bg  = t.querySelector('.tegel-bg');
        const src = geshuffled[i % geshuffled.length]?.src;
        if (bg && src) bg.style.backgroundImage = `url('${src}')`;
      });

      // Wrapper om de 3 tegels (display:contents = grid-transparant)
      const rij = document.createElement('div');
      rij.style.cssText = 'display:contents';
      rij.appendChild(t1);
      rij.appendChild(t2);
      rij.appendChild(t3);

      const heroFotos = bgFotos.slice(0, 5);

      // Kleur blijft zitten na contact — geen reset op mouseleave
      [t1, t2, t3].forEach(t => {
        t.addEventListener('mouseenter', () => {
          if (window.setFotograafKleur) window.setFotograafKleur(kleur, heroFotos, fg.naam);
        });
      });

      container.appendChild(rij);
    }
  } catch(e) {
    console.warn('Gast-tegels niet geladen:', e);
  }
}

function maakGastTegel(id, kleur, inhoud) {
  const div = document.createElement('div');
  div.className = 'tegel';
  div.id = id;
  div.role = 'button';
  div.tabIndex = 0;
  div.style.setProperty('--gast-kleur', kleur);
  div.innerHTML = `
    <div class="tegel-bg" style="background-size:cover;background-position:center"></div>
    <div class="tegel-content">${inhoud}</div>`;
  div.addEventListener('keydown', e => { if (e.key === 'Enter') div.click(); });
  return div;
}

// ===== LAATSTE REACTIES WIDGET =====
function escHtmlM(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function loadRecentComments() {
  const widget = document.getElementById('recent-comments-widget');
  if (!widget) return;
  try {
    const data  = await fbGet('recent_comments', '?orderBy=%22ts%22&limitToLast=3');
    const items = Object.entries(data || {}).map(([id, c]) => ({ id, ...c }));
    items.reverse(); // nieuwste eerst
    if (items.length === 0) return;

    widget.innerHTML = `
      <p class="rcw-title">&#128172; Laatste reacties</p>
      <div class="rcw-list">
        ${items.map(c => `
          <div class="rcw-card" onclick="window.location='${c.pagina}.html#foto=${encodeURIComponent(c.photoKey)}'" role="button" tabindex="0">
            <div class="rcw-naam">${escHtmlM(c.naam||'Anoniem')}</div>
            <div class="rcw-tekst">${escHtmlM(c.tekst)}</div>
            <div class="rcw-meta">&#128247; ${c.pagina === 'voetbal' ? 'Voetbal' : 'No Sports'}</div>
          </div>`).join('')}
      </div>`;
    widget.style.display = 'block';
    widget.style.maxWidth = '420px';
    widget.style.margin = '5rem auto';
  } catch(e) {
    console.warn('Reacties widget mislukt:', e);
  }
}

// ===== RANDOM SLIDESHOW =====
const slideshow = document.getElementById('slideshow');
const ssImg     = document.getElementById('ss-img');
const ssCurrent = document.getElementById('ss-current');
const ssTotal   = document.getElementById('ss-total');
const ssBar     = document.getElementById('ss-bar');
let ssPhotos = [], ssIdx = 0, ssTimer = null;
const SS_DELAY = 4000;

function startSlideshow(fotos) {
  if (!fotos.length) return;
  ssPhotos = fotos.slice(0, Math.min(20, fotos.length));
  ssIdx    = 0;
  ssTotal.textContent = ssPhotos.length;
  showSlide(0);
  slideshow.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  startAutoAdvance();
}

function showSlide(idx) {
  ssIdx = idx;
  const f = ssPhotos[idx];
  // 2200px-versie tonen, met terugval naar het origineel op Pages voor foto's
  // die nooit breder waren (en dus geen -groot hebben).
  const terugval = [f.groot, f.src].filter(Boolean);
  let stap = 0;
  ssImg.onerror = () => {
    stap += 1;
    if (stap < terugval.length) ssImg.src = terugval[stap];
  };
  ssImg.src = terugval[0];
  ssCurrent.textContent = idx + 1;
  ssBar.style.transition = 'none';
  ssBar.style.width = '0%';
  requestAnimationFrame(() => {
    ssBar.style.transition = `width ${SS_DELAY}ms linear`;
    ssBar.style.width = '100%';
  });
}

function startAutoAdvance() {
  clearInterval(ssTimer);
  ssTimer = setInterval(() => showSlide((ssIdx + 1) % ssPhotos.length), SS_DELAY);
}

function closeSlideshow() {
  clearInterval(ssTimer);
  slideshow.classList.add('hidden');
  document.body.style.overflow = '';
  ssImg.src = '';
}

if (slideshow) {
  document.getElementById('ss-close').addEventListener('click', closeSlideshow);
  document.getElementById('ss-prev').addEventListener('click', e => {
    e.stopPropagation();
    clearInterval(ssTimer);
    showSlide((ssIdx - 1 + ssPhotos.length) % ssPhotos.length);
    startAutoAdvance();
  });
  document.getElementById('ss-next').addEventListener('click', e => {
    e.stopPropagation();
    clearInterval(ssTimer);
    showSlide((ssIdx + 1) % ssPhotos.length);
    startAutoAdvance();
  });
  slideshow.addEventListener('click', e => { if (e.target === slideshow) closeSlideshow(); });
}

document.addEventListener('keydown', e => {
  if (!slideshow || slideshow.classList.contains('hidden')) return;
  if (e.key === 'Escape')     closeSlideshow();
  if (e.key === 'ArrowLeft')  { clearInterval(ssTimer); showSlide((ssIdx - 1 + ssPhotos.length) % ssPhotos.length); startAutoAdvance(); }
  if (e.key === 'ArrowRight') { clearInterval(ssTimer); showSlide((ssIdx + 1) % ssPhotos.length); startAutoAdvance(); }
});

// ===== HEADER SCROLL =====
window.addEventListener('scroll', () => {
  document.querySelector('header').style.background = window.scrollY > 80
    ? 'rgba(13,13,13,0.97)'
    : 'rgba(13,13,13,0.85)';
});

// ===== CONTACTFORMULIER =====
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const feedback = document.getElementById('form-feedback');
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await fetch('https://formspree.io/f/xqenvjyo', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(this)
      });
      feedback.textContent = res.ok ? 'Bedankt, je bericht is verzonden!' : 'Er ging iets mis. Probeer het later opnieuw.';
      if (res.ok) this.reset();
    } catch {
      feedback.textContent = 'Geen verbinding. Controleer je internet.';
    }
    feedback.classList.remove('hidden');
    setTimeout(() => feedback.classList.add('hidden'), 5000);
    btn.disabled = false;
  });
}

// ── NIEUWSTE SERIE ────────────────────────────────────────────────────────
async function laadNieuwsteSerie() {
  const el = document.getElementById('nieuwste-serie');
  if (!el) return;
  try {
    const [data, lokaal] = await Promise.all([
      _manifestPromise,
      fetch('/manifest.json?t=' + Date.now()).then(r => r.json()).catch(() => ({})),
    ]);

    // Gast-fotografen met ts
    let kandidaten = [];
    for (const fg of (data.fotografen || [])) {
      for (const m of (fg.mappen || [])) {
        if (m.ts) {
          kandidaten.push({
            naam: m.naam || m.map,
            fotograaf: fg.naam,
            categorie: m.categorie || 'voetbal',
            ts: m.ts,
          });
        }
      }
    }
    // Eigen series van Andreas met datum → ts
    for (const serie of (lokaal.voetbal || [])) {
      if (serie.datum) kandidaten.push({
        naam: serie.naam || serie.map,
        fotograaf: serie.fotograaf || 'Andreas Luckfiel',
        categorie: 'voetbal',
        ts: new Date(serie.datum + 'T12:00:00Z').getTime(),
      });
    }
    for (const serie of (lokaal.nosports || [])) {
      if (serie.datum) kandidaten.push({
        naam: serie.naam || serie.map,
        fotograaf: serie.fotograaf || 'Andreas Luckfiel',
        categorie: 'nosports',
        ts: new Date(serie.datum + 'T12:00:00Z').getTime(),
      });
    }

    if (!kandidaten.length) return;

    // Sorteer op meest recent
    kandidaten.sort((a, b) => b.ts - a.ts);
    const nieuwste = kandidaten[0];

    const pagina = nieuwste.categorie === 'nosports' ? 'nosports.html' : 'voetbal.html';
    const datum  = new Date(nieuwste.ts).toLocaleDateString('nl-NL', { day:'numeric', month:'long' });

    el.innerHTML = `
      <a class="nieuwste-balk" href="${pagina}">
        <span class="nieuwste-dot"></span>
        <span class="nieuwste-label">Nieuw</span>
        <span class="nieuwste-naam">${nieuwste.naam}</span>
        <span class="nieuwste-sub">${nieuwste.fotograaf} · ${datum}</span>
        <span class="nieuwste-pijl">→</span>
      </a>`;
    el.style.display = 'block';
  } catch {}
}

// Scroll naar hash na page load (bij navigatie vanuit andere pagina's naar index.html#over etc.)
(function () {
  if (!location.hash) return;
  var hash = location.hash;
  window.addEventListener('load', function () {
    setTimeout(function () {
      var el = document.querySelector(hash);
      if (!el) return;
      var header = document.querySelector('header');
      var offset = header ? header.getBoundingClientRect().height : 0;
      var top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 350);
  });
})();
