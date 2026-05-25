// ===== HERO SLIDER (wordt geïnitialiseerd na het laden van foto's) =====
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

const THEMA_KLEUR = { voetbal: '#FF6B00', nosports: '#F5C000' };

let heroSwiper    = null;
let huidigThema   = 'voetbal';
let wisselBusy    = false;
let themaTimer    = null;

function vulHeroEnStart(fotos, thema) {
  const wrapper = document.getElementById('hero-wrapper');
  if (!wrapper) return;
  const teksten = HERO_TEKSTEN[thema] || HERO_TEKSTEN.voetbal;
  wrapper.innerHTML = fotos.slice(0, 5).map((f, i) => {
    const t = teksten[i % teksten.length];
    return `<div class="swiper-slide" style="background-image: url('${f.src}')">
      <div class="slide-overlay"><h1>${t.h1}</h1><p>${t.p}</p></div>
    </div>`;
  }).join('');

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
function wisselThema(thema, fotosVoetbal, fotosNosports) {
  clearTimeout(themaTimer);
  // Naar nosports: snel (150ms). Terug naar voetbal: traag (1500ms).
  const vertraging = thema === 'nosports' ? 150 : 1500;
  themaTimer = setTimeout(() => {
    if (huidigThema === thema || wisselBusy) return;
    huidigThema = thema;
    wisselBusy  = true;

    // Body-klasse wisselen — CSS doet de rest via body.thema-nosports variabelen
    document.body.classList.toggle('thema-nosports', thema === 'nosports');

    // Hero fade-out → swap → fade-in
    const heroEl = document.getElementById('hero');
    heroEl.style.transition = 'opacity 0.35s ease';
    heroEl.style.opacity    = '0';

    setTimeout(() => {
      const fotos = thema === 'nosports' ? fotosNosports : fotosVoetbal;
      vulHeroEnStart(fotos, thema);
      heroEl.style.opacity = '1';
      setTimeout(() => { wisselBusy = false; }, 400);
    }, 350);
  }, 120); // klein debounce tegen flikkeren bij snel bewegen
}

// ── Afbeeldingen stil preloaden ────────────────────────────────────────────
function preloadFotos(fotos) {
  fotos.slice(0, 5).forEach(f => { const img = new Image(); img.src = f.src; });
}

// ===== HELPERS =====
function photoKeyMain(path) {
  return path.replace(/\//g, '__').replace(/\./g, '--');
}

function getAllFotos(manifest, category) {
  const fotos = [];
  (manifest[category] || []).forEach(item => {
    item.fotos.forEach(f => {
      fotos.push({
        src:  `images/${category}/${encodeURIComponent(item.map)}/${encodeURIComponent(f)}`,
        path: `${category}/${item.map}/${f}`
      });
    });
  });
  return fotos;
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function setTilebg(elId, fotos) {
  if (!fotos.length) return;
  const pick = fotos[Math.floor(Math.random() * fotos.length)];
  const el   = document.getElementById(elId);
  if (el) el.style.backgroundImage = `url('${pick.src}')`;
}

// Haal top-gelikte foto's op uit Firebase (max N stuks)
async function getTopLiked(fotos, maxN) {
  try {
    if (typeof db === 'undefined') return shuffle(fotos).slice(0, maxN);
    const snap   = await db.ref('likes').once('value');
    const counts = snap.val() || {};
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

    // ── Hero vullen met top-5 meest gelikte voetbalfoto's ──────────────────
    vulHeroEnStart(topVoetbal, 'voetbal');

    // Nosports foto's stil preloaden zodat ze direct klaarstaan bij hover
    preloadFotos(topNosports);

    setTilebg('bg-random',         shuffle(allVoetbal));
    setTilebg('bg-random-nosports', shuffle(allNosports));
    setTilebg('bg-liked-voetbal',  topVoetbal);
    setTilebg('bg-liked-nosports', topNosports);

    // ── Klikgedrag ─────────────────────────────────────────────────────────
    bindTegel('tegel-random',          () => startSlideshow(shuffle(allVoetbal).slice(0, 10)));
    bindTegel('tegel-liked-voetbal',   () => startSlideshow(topVoetbal));
    bindTegel('tegel-random-nosports', () => startSlideshow(shuffle(allNosports).slice(0, 10)));
    bindTegel('tegel-liked-nosports',  () => startSlideshow(topNosports));

    // ── Thema-hover: nosports tegels → geel, voetbal tegels → oranje ───────
    const nosportsTegels = ['tegel-nosports', 'tegel-random-nosports', 'tegel-liked-nosports'];
    const voetbalTegels  = ['tegel-voetbal',  'tegel-random',          'tegel-liked-voetbal'];

    nosportsTegels.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('mouseenter', () => wisselThema('nosports', topVoetbal, topNosports));
    });
    voetbalTegels.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('mouseenter', () => wisselThema('voetbal', topVoetbal, topNosports));
    });

    // Geen mouseleave op grid: thema blijft staan tot de andere zone actief wordt

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

loadTegels();
loadRecentComments();

// ===== LAATSTE REACTIES WIDGET =====
function escHtmlM(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function loadRecentComments() {
  const widget = document.getElementById('recent-comments-widget');
  if (!widget || typeof db === 'undefined') return;
  try {
    const snap = await db.ref('recent_comments').orderByChild('ts').limitToLast(3).once('value');
    const items = [];
    snap.forEach(c => items.push({id: c.key, ...c.val()}));
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
  ssImg.src = ssPhotos[idx].src;
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
