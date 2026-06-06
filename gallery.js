// gallery.js — dynamische slider pagina voor voetbal.html en nosports.html
// Gebruik: <script src="gallery.js" data-category="voetbal"></script>

const CATEGORY   = document.currentScript.getAttribute('data-category');
const WORKER_URL = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

// ── OVERZICHT MODAL ───────────────────────────────────────────────────────
function createOverzichtModal() {
  // Injecteer modal HTML en styles eenmalig
  if (document.getElementById('overzicht-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'overzicht-modal';
  modal.innerHTML = `
    <div class="overzicht-header">
      <button id="overzicht-back" class="overzicht-btn-rond" title="Terug">&#8592;</button>
      <h2 id="overzicht-titel"></h2>
      <button id="overzicht-close" class="overzicht-btn-rond" title="Sluiten">&#215;</button>
    </div>
    <div id="overzicht-grid"></div>
  `;
  document.body.appendChild(modal);

  const style = document.createElement('style');
  style.textContent = `
    #overzicht-modal {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(0,0,0,0.95);
      display: none;
      flex-direction: column;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease;
    }
    #overzicht-modal.open {
      display: flex;
      opacity: 1;
      pointer-events: auto;
    }
    .overzicht-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem 2rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
      gap: 1rem;
    }
    .overzicht-btn-rond {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      color: #ccc;
      font-size: 1.2rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .overzicht-btn-rond:hover {
      background: var(--oranje, #FF6B00);
      border-color: var(--oranje, #FF6B00);
      color: #fff;
    }
    .overzicht-header h2 {
      font-size: 1.2rem;
      font-weight: 700;
      margin: 0;
      color: #fff;
      flex: 1;
      text-align: center;
    }
    #overzicht-grid {
      flex: 1;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
      padding: 2rem;
      align-content: start;
    }
    .overzicht-thumb {
      aspect-ratio: 1 / 1;
      overflow: hidden;
      cursor: pointer;
      border-radius: 4px;
      border: 2px solid transparent;
      transition: all 0.2s;
      background: #111;
      position: relative;
    }
    .overzicht-thumb img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .overzicht-thumb:hover img {
      transform: scale(1.08);
      filter: brightness(1.1);
    }
    .overzicht-thumb.active {
      border-color: var(--oranje, #FF6B00);
      box-shadow: 0 0 12px rgba(255,107,0,0.3);
    }
    .btn-overzicht {
      margin-left: auto;
      background: none;
      border: 1px solid rgba(255,255,255,0.12);
      color: #666;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.18s;
      flex-shrink: 0;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn-overzicht:hover {
      border-color: var(--oranje, #FF6B00);
      color: var(--oranje, #FF6B00);
      background: rgba(255,107,0,0.08);
    }
    h3 .btn-overzicht {
      vertical-align: middle;
    }
  `;
  document.head.appendChild(style);

  document.getElementById('overzicht-back').addEventListener('click', () => {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    window._currentOverzicht = null;
  });

  document.getElementById('overzicht-close').addEventListener('click', () => {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}

function openOverzicht(titel, fotos, swiperEl) {
  const modal = document.getElementById('overzicht-modal') || createOverzichtModal();
  const grid = document.getElementById('overzicht-grid');
  const h2 = document.getElementById('overzicht-titel');

  h2.textContent = titel;
  grid.innerHTML = '';

  // Sla overzicht op globaal zodat lightbox kan terugkeren
  window._currentOverzicht = { titel, fotos, swiperEl, modal };

  fotos.forEach((f, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'overzicht-thumb';
    const img = document.createElement('img');
    img.src = f.src;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    thumb.appendChild(img);

    thumb.addEventListener('click', () => {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      // Open via bestaande lightbox handler
      setTimeout(() => {
        if (window._openLightboxVanImg) {
          window._openLightboxVanImg(fotos[i]._img);
        }
      }, 50);
    });

    grid.appendChild(thumb);
  });

  document.getElementById('overzicht-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}


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

async function loadGallery() { // returns Promise
  const container = document.getElementById('gallery-container');

  try {
    // Laad manifest en gastfotografen — volgorde is optioneel
    const [manifestRes, gastRes] = await Promise.all([
      fetch('manifest.json?v=' + Date.now()),
      fetch(WORKER_URL + '/fotograaf/manifest'),
    ]);

    const manifest   = await manifestRes.json();
    const gastData   = await gastRes.json();

    // Gecombineerde volgorde ophalen — stil falen als niet beschikbaar
    let gecombineerd = null;
    try {
      const volgordeRes  = await fetch(WORKER_URL + '/gallery/volgorde');
      const volgordeData = await volgordeRes.json();
      gecombineerd = volgordeData[CATEGORY] || null;
    } catch (e) { /* geen volgorde opgeslagen, dat is ok */ }

    const eigenItems = manifest[CATEGORY] || [];
    const fotografen = gastData.fotografen || [];

    if (eigenItems.length === 0 && fotografen.length === 0) {
      container.innerHTML = '<p class="no-content">Nog geen foto\'s toegevoegd — kom snel terug!</p>';
      return;
    }

    container.innerHTML = '';

    // Laad alle like-aantallen uit Firebase
    let likeCounts = {};
    try {
      if (typeof db !== 'undefined') {
        const snap = await db.ref('likes').once('value');
        likeCounts = snap.val() || {};
      }
    } catch (e) {
      console.warn('Firebase niet beschikbaar:', e);
    }

    // Bouw lookup voor gast-fotos (geladen bij eerste gebruik)
    const gastFotosCache = {};
    async function getGastFotos(fg, mapNaam) {
      if (!gastFotosCache[fg.id]) {
        const r = await fetch(`${WORKER_URL}/fotograaf/fotos?id=${fg.id}&categorie=${encodeURIComponent(CATEGORY)}`);
        const d = await r.json();
        gastFotosCache[fg.id] = d.fotos || [];
      }
      return gastFotosCache[fg.id].filter(f =>
        f.key.includes(`/${encodeURIComponent(mapNaam)}/`) || f.key.includes(`/${mapNaam}/`)
      );
    }

    // Als er een gecombineerde volgorde is, gebruik die
    if (gecombineerd && gecombineerd.length > 0) {
      for (const entry of gecombineerd) {
        if (entry.type === 'eigen') {
          const item = eigenItems.find(x => x.map === entry.map);
          if (item) renderEigenItem(item, likeCounts, container);
        } else if (entry.type === 'gast') {
          const fg = fotografen.find(x => x.id === entry.fgId);
          if (fg) {
            const fotos = await getGastFotos(fg, entry.map);
            if (fotos.length) renderGastItem(fg, entry.map, fotos, container);
          }
        }
      }
      // Eigen items die niet in de volgorde staan, achteraan toevoegen
      for (const item of eigenItems) {
        if (!gecombineerd.find(e => e.type === 'eigen' && e.map === item.map)) {
          renderEigenItem(item, likeCounts, container);
        }
      }
    } else {
      // Geen gecombineerde volgorde: eigen items eerst, daarna gast
      eigenItems.forEach(item => renderEigenItem(item, likeCounts, container));
      for (const fg of fotografen) {
        const mappen = (fg.mappen || []).filter(m => m.categorie === CATEGORY || m.categorie === 'eigen');
        for (const map of mappen) {
          const fotos = await getGastFotos(fg, map.map);
          if (fotos.length) renderGastItem(fg, map.map, fotos, container);
        }
      }
    }

    initLightbox();
    initLikes();
    initComments();

    // Initialiseer alle Swipers — lightbox via Swiper onClick zodat het altijd werkt
    document.querySelectorAll('.portfolio-swiper').forEach(el => {
      new Swiper(el, {
        loop: false, slidesPerView: 'auto', spaceBetween: 16, grabCursor: true,
        preventClicks: false,
        preventClicksPropagation: false,
        navigation: { nextEl: el.querySelector('.swiper-button-next'), prevEl: el.querySelector('.swiper-button-prev') },
        pagination: { el: el.querySelector('.swiper-pagination'), type: 'fraction' },
        on: {
          click(swiper, event) {
            const img = event.target.closest('img');
            if (img && window._openLightboxVanImg) window._openLightboxVanImg(img);
          }
        }
      });
      // Cursor pointer op alle afbeeldingen
      el.querySelectorAll('img').forEach(img => img.style.cursor = 'pointer');
    });

    // Koppel overzicht-buttons
    createOverzichtModal();
    document.querySelectorAll('.portfolio-category h3').forEach(h3 => {
      const swiper = h3.closest('.portfolio-category')?.querySelector('.portfolio-swiper');
      const btn = h3.querySelector('.btn-overzicht');
      if (!swiper || !btn) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fotos = Array.from(swiper.querySelectorAll('img')).map(img => ({ src: img.src, _img: img }));
        if (fotos.length) openOverzicht(h3.childNodes[0].textContent.trim(), fotos, swiper);
      });
    });

  } catch (e) {
    container.innerHTML = '<p class="no-content">Kon foto\'s niet laden.</p>';
    console.error(e);
  }
}

function renderEigenItem(item, likeCounts, container) {
    const div = document.createElement('div');
    div.className = 'portfolio-category';
    div.id = 'cat-' + item.id;

    const sortedFotos = [...item.fotos].sort((a, b) => {
      const keyA = photoKey(`${CATEGORY}/${item.map}/${a}`);
      const keyB = photoKey(`${CATEGORY}/${item.map}/${b}`);
      return (likeCounts[keyB] || 0) - (likeCounts[keyA] || 0);
    });

    const slides = sortedFotos.map(f => {
      const path  = `${CATEGORY}/${item.map}/${f}`;
      const key   = photoKey(path);
      const src   = `images/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f)}`;
      const liked = isLikedLocally(key);
      const count = likeCounts[key] || 0;
      return `<div class="swiper-slide">
        <img src="${src}" alt="${item.naam}" loading="lazy" />
        <div class="slide-actions">
          <button class="btn-like ${liked ? 'liked' : ''}" data-key="${key}" data-path="${path}" title="Like">
            <span class="heart">♥</span><span class="like-count">${count > 0 ? count : ''}</span>
          </button>
          <button class="btn-download" data-src="${src}" data-naam="${f}" title="Download"><span>&#8681;</span></button>
        </div>
      </div>`;
    }).join('');

    div.innerHTML = `
      <h3>${item.naam}${item.fotograaf ? `<span class="serie-fotograaf">${item.fotograaf}</span>` : ''}
        <span class="h3-rechts">
          <span class="foto-count">${sortedFotos.length} foto's</span>
          <button class="btn-overzicht" title="Overzicht fotos">⊞</button>
        </span>
      </h3>
      ${item.beschrijving ? `<p class="serie-beschrijving">${item.beschrijving}</p>` : ''}
      <div class="swiper portfolio-swiper">
        <div class="swiper-wrapper">${slides}</div>
        <div class="swiper-button-prev"></div>
        <div class="swiper-button-next"></div>
        <div class="swiper-pagination"></div>
      </div>`;
    container.appendChild(div);
}

function renderGastItem(fg, mapNaam, fotos, container) {
    const div = document.createElement('div');
    div.className = 'portfolio-category gast-fotograaf';
    div.style.setProperty('--gast-kleur', fg.kleur || '#3b82f6');

    const slides = fotos.map(f => {
      const src  = `${WORKER_URL}/foto/${f.key}`;
      const naam = f.naam;
      return `<div class="swiper-slide" data-src="${src}" data-naam="${naam}">
        <img src="${src}" alt="${naam}" loading="lazy" />
        <div class="slide-actions">
          <button class="btn-like" data-key="gast__${fg.id}__${naam}" data-path="gast/${naam}">
            <span class="heart">♥</span><span class="like-count"></span>
          </button>
          <button class="btn-download" data-src="${src}" data-naam="${naam}" title="Download">
            <span>&#8681;</span> Download
          </button>
        </div>
      </div>`;
    }).join('');

    div.innerHTML = `
      <h3>${mapNaam}<span class="serie-fotograaf">${fg.naam}</span>
        <span class="h3-rechts">
          <span class="foto-count">${fotos.length} foto's</span>
          <button class="btn-overzicht" title="Overzicht fotos">⊞</button>
        </span>
      </h3>
      <div class="swiper portfolio-swiper">
        <div class="swiper-wrapper">${slides}</div>
        <div class="swiper-button-prev"></div>
        <div class="swiper-button-next"></div>
        <div class="swiper-pagination"></div>
      </div>`;
    container.appendChild(div);
}


// ── LIKES ─────────────────────────────────────────────────────────────────
function initLikes() {
  // Download-knop in slider
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-download[data-src]');
    if (!btn) return;
    e.stopPropagation();
    downloadAlsJpg(btn.dataset.src, btn.dataset.naam);
  });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('.btn-like');
    if (!btn) return;
    e.stopPropagation();

    const key   = btn.dataset.key;
    const liked = isLikedLocally(key);
    if (typeof db === 'undefined') return;
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
      const snap  = typeof db !== 'undefined' ? await ref.once('value') : null;
      const count = snap ? snap.val() || 0 : 0;
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
  const lbLike      = document.getElementById('lb-like');
  const lbLikeCount = document.getElementById('lb-like-count');
  const lbDownload  = document.getElementById('lb-download');
  const lbActions   = document.querySelector('.lb-actions');
  let allImages = [], allKeys = [], currentIdx = 0;

  // Terug naar overzicht knop (staat in HTML, wired hier)
  const lbTerugBtn = document.getElementById('lb-terug-overzicht');
  const lbTerugSep = document.getElementById('lb-terug-sep');
  if (lbTerugBtn) {
    lbTerugBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      lightbox.classList.add('hidden');
      document.body.style.overflow = '';
      const ov = window._currentOverzicht;
      if (ov && ov.modal) {
        ov.modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    });
  }


  function showLightbox(idx) {
    currentIdx      = idx;
    const img       = allImages[idx];
    lightboxImg.src = img.src;

    const teller = document.getElementById('lb-teller');
    if (teller) teller.textContent = `${idx + 1} / ${allImages.length}`;

    // Like & download knoppen bijwerken
    const key = allKeys[idx];
    if (key && lbLike) {
      lbLike.dataset.key = key;
      lbLike.classList.toggle('liked', isLikedLocally(key));
      if (typeof db !== 'undefined') {
        db.ref(`likes/${key}`).once('value').then(s => {
          const c = s.val() || 0;
          lbLikeCount.textContent = c > 0 ? c : '';
        });
      }
    }
    if (lbDownload) {
      lbDownload.dataset.src  = img.src;
      lbDownload.dataset.naam = img.src.split('/').pop();
    }
    if (window._setCommentPhoto) window._setCommentPhoto(key, img.src);
  }

  function openLightboxVanImg(img) {
    const slider = img.closest('.portfolio-swiper');
    if (!slider) return;
    allImages = Array.from(slider.querySelectorAll('img'));
    allKeys   = Array.from(slider.querySelectorAll('.swiper-slide')).map(slide => {
      const btn = slide.querySelector('.btn-like');
      return btn ? btn.dataset.key : '';
    });
    // Zoek op element-referentie, val terug op src als Swiper DOM heeft gewijzigd
    let idx = allImages.indexOf(img);
    if (idx === -1) idx = allImages.findIndex(i => i.src === img.src);
    if (idx === -1) idx = 0;
    showLightbox(idx);
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const fromOverzicht = !!window._currentOverzicht;
    if (lbTerugBtn) lbTerugBtn.style.display = fromOverzicht ? 'block' : 'none';
    if (lbTerugSep) lbTerugSep.style.display = fromOverzicht ? 'block' : 'none';
  }

  // Globaal beschikbaar voor gastfotograaf-slides
  window._openLightboxVanImg = openLightboxVanImg;

  document.addEventListener('click', e => {
    const img = e.target.closest('.portfolio-swiper img');
    if (!img) return;
    openLightboxVanImg(img);
  });

  // Like in lightbox
  if (lbLike) {
    lbLike.addEventListener('click', async e => {
      e.stopPropagation();
      const key = lbLike.dataset.key;
      if (!key || typeof db === 'undefined') return;
      const liked = isLikedLocally(key);
      const ref   = db.ref(`likes/${key}`);
      if (liked) {
        await ref.transaction(cur => Math.max(0, (cur || 1) - 1));
        setLikedLocally(key, false);
        lbLike.classList.remove('liked');
      } else {
        await ref.transaction(cur => (cur || 0) + 1);
        setLikedLocally(key, true);
        lbLike.classList.add('liked');
      }
      const snap = await ref.once('value');
      const c    = snap.val() || 0;
      lbLikeCount.textContent = c > 0 ? c : '';
      // Sync ook de kleine knop in de slider
      const smallBtn = document.querySelector(`.btn-like[data-key="${key}"]`);
      if (smallBtn) {
        smallBtn.classList.toggle('liked', !liked);
        smallBtn.querySelector('.like-count').textContent = c > 0 ? c : '';
      }
    });
  }

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox || e.target === lightboxImg) closeLightbox();
  });
  document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

  // Download in lightbox → altijd als JPG
  if (lbDownload) {
    lbDownload.addEventListener('click', e => {
      e.stopPropagation();
      const src  = lbDownload.dataset.src;
      const naam = lbDownload.dataset.naam;
      if (src) downloadAlsJpg(src, naam);
    });
  }

  document.getElementById('lb-prev').addEventListener('click', e => {
    e.stopPropagation();
    if (currentIdx > 0) showLightbox(currentIdx - 1);
  });
  document.getElementById('lb-next').addEventListener('click', e => {
    e.stopPropagation();
    if (currentIdx < allImages.length - 1) showLightbox(currentIdx + 1);
  });

  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft'  && currentIdx > 0)                    showLightbox(currentIdx - 1);
    if (e.key === 'ArrowRight' && currentIdx < allImages.length - 1) showLightbox(currentIdx + 1);
  });

  function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
    if (lbTerugBtn) lbTerugBtn.style.display = 'none';
    if (lbTerugSep) lbTerugSep.style.display = 'none';
  }
}

// ── DOWNLOAD ALS JPG ──────────────────────────────────────────────────────
function downloadAlsJpg(src, bestandsnaam) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = bestandsnaam.replace(/\.[^.]+$/, '') + '.jpg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 'image/jpeg', 0.92);
  };
  img.src = src;
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'})
       + ' ' + d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
}

// ── REACTIES ──────────────────────────────────────────────────────────────
function initComments() {
  const drawer   = document.getElementById('reacties-drawer');
  const rdClose  = document.getElementById('rd-close');
  const rdLijst  = document.getElementById('rd-lijst');
  const rdForm   = document.getElementById('rd-form');
  const rdNaam   = document.getElementById('rd-naam');
  const rdTekst  = document.getElementById('rd-tekst');
  const rdCount  = document.getElementById('rd-count');
  const rcBtn    = document.getElementById('lb-reacties-btn');
  const rcCount  = document.getElementById('lb-rc-count');
  if (!drawer || !rcBtn) return;

  // Zorg dat de drawer altijd gesloten start, ongeacht browser-cache
  drawer.classList.add('slide-out');

  let curKey = '', curSrc = '';

  // Wordt aangeroepen vanuit showLightbox()
  window._setCommentPhoto = function(key, src) {
    curKey = key || '';
    curSrc = src  || '';
    updateCount(curKey);
    if (!drawer.classList.contains('slide-out')) loadComments(curKey);
  };

  function updateCount(key) {
    if (!key || typeof db === 'undefined') { rcCount.textContent = ''; return; }
    db.ref('comments/' + key).once('value').then(snap => {
      const n = snap.numChildren();
      rcCount.textContent = n > 0 ? n : '';
      if (rdCount) rdCount.textContent = n > 0 ? '(' + n + ')' : '';
    });
  }

  function loadComments(key) {
    rdLijst.innerHTML = '<p class="rd-geen">Laden…</p>';
    if (!key || typeof db === 'undefined') {
      rdLijst.innerHTML = '<p class="rd-geen">Geen verbinding</p>'; return;
    }
    db.ref('comments/' + key).orderByChild('ts').once('value').then(snap => {
      const items = [];
      snap.forEach(c => items.push({id: c.key, ...c.val()}));
      items.reverse();
      rdLijst.innerHTML = items.length === 0
        ? '<p class="rd-geen">Nog geen reacties — wees de eerste!</p>'
        : items.map(c => `
            <div class="rd-reactie">
              <div class="rd-r-naam">${escHtml(c.naam||'Anoniem')}</div>
              <div class="rd-r-tekst">${escHtml(c.tekst)}</div>
              <div class="rd-r-ts">${fmtTs(c.ts)}</div>
            </div>`).join('');
      updateCount(key);
    });
  }

  // Open / sluit drawer
  rcBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (drawer.classList.contains('slide-out')) {
      drawer.classList.remove('slide-out');
      loadComments(curKey);
    } else {
      drawer.classList.add('slide-out');
    }
  });
  rdClose.addEventListener('click', () => drawer.classList.add('slide-out'));

  // Formulier insturen
  rdForm.addEventListener('submit', async e => {
    e.preventDefault();
    const tekst = rdTekst.value.trim();
    if (!tekst || !curKey || typeof db === 'undefined') return;
    const naam = rdNaam.value.trim() || 'Anoniem';
    const ts   = Date.now();
    const btn  = rdForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    const data = { naam, tekst, ts, pagina: CATEGORY, src: curSrc };
    try {
      const ref = await db.ref('comments/' + curKey).push(data);
      await db.ref('recent_comments/' + ref.key).set({ ...data, photoKey: curKey });
      rdTekst.value = '';
      loadComments(curKey);
    } catch(err) {
      console.warn('Reactie mislukt:', err);
    }
    btn.disabled = false;
  });

  // Sluit drawer ook als lightbox sluit
  document.querySelector('.lightbox-close')?.addEventListener('click', () => {
    drawer.classList.add('slide-out');
  });
  document.getElementById('lightbox')?.addEventListener('click', e => {
    if (e.target.id === 'lightbox' || e.target.id === 'lightbox-img') {
      drawer.classList.add('slide-out');
    }
  });
}

// Deep-link: voetbal.html#foto=photoKey opent de lightbox direct
function checkDeepLink() {
  const hash = decodeURIComponent(location.hash);
  if (!hash.startsWith('#foto=')) return;
  const targetKey = hash.slice(6);
  // Zoek de slide met deze key
  const btn = document.querySelector(`.btn-like[data-key="${targetKey}"]`);
  if (btn) {
    const img = btn.closest('.swiper-slide')?.querySelector('img');
    if (img) { img.click(); location.hash = ''; }
  }
}

loadGallery().then(() => setTimeout(checkDeepLink, 400));
