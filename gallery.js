// gallery.js — dynamische slider pagina voor voetbal.html en nosports.html
// Gebruik: <script src="gallery.js" data-category="voetbal"></script>

const CATEGORY = document.currentScript.getAttribute('data-category');

// Zet een foto-pad om naar een Firebase-safe sleutel
function photoKey(path) {
  return path.replace(/\//g, '__').replace(/\./g, '--');
}

// Heeft deze browser al geliked?
function isLikedLocally(key) {
  try { return !!JSON.parse(localStorage.getItem('zl_liked') || '{}')[key]; } catch { return false; }
}
function setLikedLocally(key, val) {
  try {
    const s = JSON.parse(localStorage.getItem('zl_liked') || '{}');
    if (val) s[key] = true; else delete s[key];
    localStorage.setItem('zl_liked', JSON.stringify(s));
  } catch {}
}

async function loadGallery() {
  const container = document.getElementById('gallery-container');

  try {
    const res      = await fetch('manifest.json?v=' + Date.now());
    const manifest = await res.json();
    const items    = manifest[CATEGORY] || [];

    if (items.length === 0) {
      container.innerHTML = '<p class="no-content">Nog geen foto\'s toegevoegd — kom snel terug!</p>';
      return;
    }

    container.innerHTML = '';

    // Laad alle like-aantallen in één keer uit Firebase
    let likeCounts = {};
    try {
      if (typeof db !== 'undefined') {
        const snap = await db.ref('likes').once('value');
        likeCounts = snap.val() || {};
      }
    } catch (e) {
      console.warn('Firebase niet beschikbaar:', e);
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'portfolio-category';
      div.id = 'cat-' + item.id;

      const slides = item.fotos.map(f => {
        const path    = `${CATEGORY}/${item.map}/${f}`;
        const key     = photoKey(path);
        const src     = `images/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f)}`;
        const liked   = isLikedLocally(key);
        const count   = likeCounts[key] || 0;

        return `
          <div class="swiper-slide">
            <img src="${src}" alt="${item.naam}" loading="lazy" />
            <div class="slide-actions">
              <button class="btn-like ${liked ? 'liked' : ''}" data-key="${key}" data-path="${path}" title="Like deze foto">
                <span class="heart">♥</span>
                <span class="like-count">${count > 0 ? count : ''}</span>
              </button>
              <a class="btn-download" href="${src}" download="${f}" title="Download foto">
                <span>&#8681;</span>
              </a>
            </div>
          </div>`;
      }).join('');

      div.innerHTML = `
        <h3>${item.naam}</h3>
        <div class="swiper portfolio-swiper">
          <div class="swiper-wrapper">${slides}</div>
          <div class="swiper-button-prev"></div>
          <div class="swiper-button-next"></div>
        </div>`;

      container.appendChild(div);
    });

    // Initialiseer alle Swipers
    document.querySelectorAll('.portfolio-swiper').forEach(el => {
      new Swiper(el, {
        loop: false,
        slidesPerView: 'auto',
        spaceBetween: 16,
        grabCursor: true,
        navigation: {
          nextEl: el.querySelector('.swiper-button-next'),
          prevEl: el.querySelector('.swiper-button-prev'),
        },
      });
    });

    initLightbox();
    initLikes();

  } catch (e) {
    container.innerHTML = '<p class="no-content">Kon foto\'s niet laden.</p>';
    console.error(e);
  }
}

// ── LIKES ─────────────────────────────────────────────────────────────────
function initLikes() {
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.btn-like');
    if (!btn) return;
    e.stopPropagation();

    const key   = btn.dataset.key;
    const liked = isLikedLocally(key);
    const ref   = db.ref(`likes/${key}`);

    try {
      if (liked) {
        // Unlike: verlaag met 1 (minimaal 0)
        await ref.transaction(cur => Math.max(0, (cur || 1) - 1));
        setLikedLocally(key, false);
        btn.classList.remove('liked');
      } else {
        // Like: verhoog met 1
        await ref.transaction(cur => (cur || 0) + 1);
        setLikedLocally(key, true);
        btn.classList.add('liked');
      }

      // Update teller in UI
      const snap  = await ref.once('value');
      const count = snap.val() || 0;
      btn.querySelector('.like-count').textContent = count > 0 ? count : '';

    } catch (err) {
      console.warn('Like mislukt:', err);
    }
  });
}

// ── LIGHTBOX ──────────────────────────────────────────────────────────────
function initLightbox() {
  const lightbox    = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  let allImages = [], currentIdx = 0;

  document.addEventListener('click', e => {
    const img = e.target.closest('.portfolio-swiper img');
    if (!img) return;
    const slider = img.closest('.portfolio-swiper');
    allImages  = Array.from(slider.querySelectorAll('img'));
    currentIdx = allImages.indexOf(img);
    lightboxImg.src = img.src;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  lightbox.addEventListener('click', e => { if (e.target !== lightboxImg) closeLightbox(); });
  document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

  document.getElementById('lb-prev').addEventListener('click', e => {
    e.stopPropagation();
    if (currentIdx > 0) { currentIdx--; lightboxImg.src = allImages[currentIdx].src; }
  });
  document.getElementById('lb-next').addEventListener('click', e => {
    e.stopPropagation();
    if (currentIdx < allImages.length - 1) { currentIdx++; lightboxImg.src = allImages[currentIdx].src; }
  });

  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft'  && currentIdx > 0)                    { currentIdx--; lightboxImg.src = allImages[currentIdx].src; }
    if (e.key === 'ArrowRight' && currentIdx < allImages.length - 1) { currentIdx++; lightboxImg.src = allImages[currentIdx].src; }
  });

  function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

loadGallery();
