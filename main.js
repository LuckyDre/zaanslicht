// ===== HERO SLIDER =====
new Swiper('.hero-swiper', {
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

// ===== TEGELS: laad achtergrondfotos + gebruik top-liked voor Verrassing =====
async function loadTegels() {
  try {
    const res = await fetch('manifest.json?v=' + Date.now());
    const manifest = await res.json();

    const allVoetbal  = getAllFotos(manifest, 'voetbal');
    const allNosports = getAllFotos(manifest, 'nosports');

    setTilebg('bg-voetbal',  allVoetbal);
    setTilebg('bg-nosports', allNosports);

    // Haal like-aantallen op uit Firebase → sorteer voetbalfoto's op likes
    let topFotos = allVoetbal;
    try {
      const snap   = await db.ref('likes').once('value');
      const counts = snap.val() || {};
      const sorted = [...allVoetbal].sort((a, b) => {
        const ka = photoKeyMain(a.path);
        const kb = photoKeyMain(b.path);
        return (counts[kb] || 0) - (counts[ka] || 0);
      });
      // Gebruik top-gelikte foto's als er likes zijn, anders gewoon random
      const hasLikes = sorted.some(f => (counts[photoKeyMain(f.path)] || 0) > 0);
      topFotos = hasLikes ? sorted : allVoetbal;
    } catch {}

    setTilebg('bg-random', topFotos);

    const tegelRandom = document.getElementById('tegel-random');
    if (tegelRandom) {
      tegelRandom.addEventListener('click', () => startSlideshow(topFotos));
      tegelRandom.addEventListener('keydown', e => { if (e.key === 'Enter') startSlideshow(topFotos); });
    }

  } catch (e) {
    console.error('manifest laden mislukt:', e);
  }
}

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

function setTilebg(elId, fotos) {
  if (!fotos.length) return;
  const pick = fotos[Math.floor(Math.random() * fotos.length)];
  const el = document.getElementById(elId);
  if (el) el.style.backgroundImage = `url('${pick.src}')`;
}

loadTegels();

// ===== RANDOM SLIDESHOW =====
const slideshow = document.getElementById('slideshow');
const ssImg     = document.getElementById('ss-img');
const ssCurrent = document.getElementById('ss-current');
const ssTotal   = document.getElementById('ss-total');
const ssBar     = document.getElementById('ss-bar');
let ssPhotos = [], ssIdx = 0, ssTimer = null;
const SS_DELAY = 4000;

function startSlideshow(allFotos) {
  if (!allFotos.length) return;
  const shuffled = [...allFotos].sort(() => Math.random() - 0.5);
  ssPhotos = shuffled.slice(0, Math.min(10, shuffled.length));
  ssIdx = 0;
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
  if (e.key === 'Escape') closeSlideshow();
  if (e.key === 'ArrowLeft')  { clearInterval(ssTimer); showSlide((ssIdx - 1 + ssPhotos.length) % ssPhotos.length); startAutoAdvance(); }
  if (e.key === 'ArrowRight') { clearInterval(ssTimer); showSlide((ssIdx + 1) % ssPhotos.length); startAutoAdvance(); }
});

// ===== HEADER scroll effect =====
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
