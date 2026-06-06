// gallery.js — dynamische slider pagina voor voetbal.html en nosports.html
// Gebruik: <script src="gallery.js" data-category="voetbal"></script>

const CATEGORY = document.currentScript.getAttribute('data-category');

// ── STIJL INJECTEREN ─────────────────────────────────────────────────────
(function injectStijl() {
  const s = document.createElement('style');
  s.textContent = `
    .btn-serie-grid {
      margin-left: 0.5rem;
      background: none;
      border: 1px solid rgba(255,255,255,0.12);
      color: #666;
      width: 28px; height: 28px;
      border-radius: 6px;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.18s;
      flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      vertical-align: middle;
    }
    .btn-serie-grid:hover {
      border-color: var(--orange, #FF6B00);
      color: var(--orange, #FF6B00);
      background: rgba(255,107,0,0.08);
    }
  `;
  document.head.appendChild(s);
})();

// ── SERIE-OVERZICHT OVERLAY ───────────────────────────────────────────────
(function injectOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'serie-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:2500;
    background:rgba(10,10,10,0.97);
    display:flex;flex-direction:column;
    opacity:0;pointer-events:none;
    transition:opacity 0.22s ease;
  `;
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:1.2rem 2rem;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">
      <div>
        <div id="serie-overlay-label" style="font-size:0.7rem;letter-spacing:3px;
          text-transform:uppercase;color:#666;font-family:monospace;margin-bottom:0.3rem"></div>
        <h2 id="serie-overlay-titel" style="font-size:1.4rem;font-weight:700;color:#f0f0f0"></h2>
      </div>
      <button id="serie-overlay-sluit" style="
        background:none;border:1px solid rgba(255,255,255,0.12);color:#888;
        width:40px;height:40px;border-radius:50%;font-size:1.2rem;cursor:pointer;
        transition:all 0.2s;flex-shrink:0"
        onmouseover="this.style.borderColor='var(--orange,#FF6B00)';this.style.color='var(--orange,#FF6B00)'"
        onmouseout="this.style.borderColor='rgba(255,255,255,0.12)';this.style.color='#888'">&times;</button>
    </div>
    <div id="serie-overlay-grid" style="
      flex:1;overflow-y:auto;
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
      gap:4px;padding:4px;"></div>
    <div style="padding:0.7rem 2rem;border-top:1px solid rgba(255,255,255,0.06);
      font-size:0.72rem;color:#444;font-family:monospace;text-align:center;flex-shrink:0">
      <span id="serie-overlay-count"></span> &nbsp;·&nbsp; Klik op een foto om te vergroten &nbsp;·&nbsp; ESC om te sluiten
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('serie-overlay-sluit').addEventListener('click', sluitSerieOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) sluitSerieOverlay(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') sluitSerieOverlay(); });
})();

function openSerieOverlay(titel, fotograaf, swiperEl) {
  const overlay = document.getElementById('serie-overlay');
  const grid    = document.getElementById('serie-overlay-grid');

  // Lees alle img-elementen uit de Swiper (die zijn al geladen/gecached)
  const slides = swiperEl.querySelectorAll('.swiper-slide img');
  const fotos = Array.from(slides).map(img => ({
    src:  img.src,
    naam: img.alt || '',
  }));

  document.getElementById('serie-overlay-label').textContent  = fotograaf || 'Zaans Licht';
  document.getElementById('serie-overlay-titel').textContent  = titel;
  document.getElementById('serie-overlay-count').textContent  = `${fotos.length} foto's`;

  grid.innerHTML = '';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
  grid.style.gap = '2px';

  fotos.forEach((f, i) => {
    const cel = document.createElement('div');
    cel.style.cssText = 'aspect-ratio:1/1;overflow:hidden;cursor:pointer;position:relative;background:#111';
    cel.dataset.idx   = i;

    // Gebruik originele swiper-img (al geladen), maar klein afbeelden
    const origImg = slides[i];
    const img = document.createElement('img');
    img.src             = origImg.src;
    img.alt             = origImg.alt || '';
    img.loading         = 'lazy';
    img.decoding        = 'async';
    img.style.cssText   = 'width:100%;height:100%;object-fit:contain;transition:filter 0.15s;filter:brightness(0.8);background:#0a0a0a';
    img.onmouseover     = () => { img.style.filter = 'brightness(1) scale(1.05)'; cel.style.zIndex = '10'; };
    img.onmouseout      = () => { img.style.filter = 'brightness(0.8)'; cel.style.zIndex = '1'; };

    cel.appendChild(img);
    cel.addEventListener('click', () => {
      sluitSerieOverlay();
      setTimeout(() => { if (window._openLightboxVanSerie) window._openLightboxVanSerie(fotos, i); }, 120);
    });
    grid.appendChild(cel);
  });

  overlay.style.pointerEvents = 'auto';
  overlay.style.opacity       = '1';
  document.body.style.overflow = 'hidden';
}

function sluitSerieOverlay() {
  const overlay = document.getElementById('serie-overlay');
  overlay.style.opacity       = '0';
  overlay.style.pointerEvents = 'none';
  document.body.style.overflow = '';
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

      // Sorteer foto's op like-count (meest geliked vooraan)
      const sortedFotos = [...item.fotos].sort((a, b) => {
        const keyA = photoKey(`${CATEGORY}/${item.map}/${a}`);
        const keyB = photoKey(`${CATEGORY}/${item.map}/${b}`);
        return (likeCounts[keyB] || 0) - (likeCounts[keyA] || 0);
      });

      const slides = sortedFotos.map(f => {
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
              <button class="btn-download" data-src="${src}" data-naam="${f}" title="Download foto">
                <span>&#8681;</span>
              </button>
            </div>
          </div>`;
      }).join('');

      div.innerHTML = `
        <h3>${item.naam}${item.fotograaf ? `<span class="serie-fotograaf">${item.fotograaf}</span>` : ''}
          <span class="foto-count">${sortedFotos.length} foto's</span>
          <button class="btn-serie-grid" title="Overzicht alle foto's">⊞</button>
        </h3>
        ${item.beschrijving ? `<p class="serie-beschrijving">${item.beschrijving}</p>` : ''}
        <div class="swiper portfolio-swiper">
          <div class="swiper-wrapper">${slides}</div>
          <div class="swiper-button-prev"></div>
          <div class="swiper-button-next"></div>
          <div class="swiper-pagination"></div>
        </div>`;

      container.appendChild(div);

      // Grid-overzicht knop
      const swiperEl = div.querySelector('.swiper');
      div.querySelector('.btn-serie-grid').addEventListener('click', () => {
        openSerieOverlay(item.naam, item.fotograaf || 'Zaans Licht', swiperEl);
      });
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
        pagination: {
          el: el.querySelector('.swiper-pagination'),
          type: 'fraction',
        },
      });
    });

    initLightbox();
    initLikes();
    initComments();

    // Laad gastfotografen-foto's
    laadGastFotos(container);

  } catch (e) {
    container.innerHTML = '<p class="no-content">Kon foto\'s niet laden.</p>';
    console.error(e);
  }
}

// ── GASTFOTOGRAFEN ────────────────────────────────────────────────────────
const WORKER_URL = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

async function laadGastFotos(container) {
  try {
    const res  = await fetch(WORKER_URL + '/fotograaf/manifest');
    const data = await res.json();
    const fotografen = data.fotografen || [];

    for (const fg of fotografen) {
      // Filter mappen die bij deze categorie horen
      const mappen = (fg.mappen || []).filter(m => m.categorie === CATEGORY || m.categorie === 'eigen');
      if (!mappen.length) continue;

      for (const map of mappen) {
        // Haal de foto's op voor deze map
        const fotosRes = await fetch(`${WORKER_URL}/fotograaf/fotos?id=${fg.id}&categorie=${encodeURIComponent(map.categorie)}`);
        const fotosData = await fotosRes.json();
        const alleFotos = (fotosData.fotos || []).filter(f =>
          f.key.includes(`/${encodeURIComponent(map.map)}/`) || f.key.includes(`/${map.map}/`)
        );
        if (!alleFotos.length) continue;

        const div = document.createElement('div');
        div.className = 'portfolio-category gast-fotograaf';
        div.style.setProperty('--gast-kleur', fg.kleur || '#3b82f6');

        const slides = alleFotos.map(f => {
          const src = `${WORKER_URL}/foto/${f.key}`;
          const naam = f.naam;
          return `<div class="swiper-slide" data-src="${src}" data-naam="${naam}">
            <img src="${src}" alt="${naam}" loading="lazy" />
            <div class="slide-actions">
              <button class="btn-like" data-key="gast__${fg.id}__${naam}" data-path="gast/${naam}">
                <span class="heart">♥</span>
                <span class="like-count"></span>
              </button>
              <button class="btn-download" data-src="${src}" data-naam="${naam}" title="Download">
                <span>&#8681;</span> Download
              </button>
            </div>
          </div>`;
        }).join('');

        div.innerHTML = `
          <h3>${map.map}<span class="serie-fotograaf">${fg.naam}</span>
            <span class="foto-count">${alleFotos.length} foto's</span>
            <button class="btn-serie-grid" title="Overzicht alle foto's">⊞</button>
          </h3>
          <div class="swiper portfolio-swiper">
            <div class="swiper-wrapper">${slides}</div>
            <div class="swiper-button-prev"></div>
            <div class="swiper-button-next"></div>
            <div class="swiper-pagination"></div>
          </div>`;

        container.appendChild(div);

        // Initialiseer Swiper voor deze map
        const swiperEl = div.querySelector('.portfolio-swiper');
        new Swiper(swiperEl, {
          loop: false,
          slidesPerView: 'auto',
          spaceBetween: 16,
          grabCursor: true,
          navigation: {
            nextEl: swiperEl.querySelector('.swiper-button-next'),
            prevEl: swiperEl.querySelector('.swiper-button-prev'),
          },
          pagination: {
            el: swiperEl.querySelector('.swiper-pagination'),
            type: 'fraction',
          },
        });

        // Grid-overzicht knop
        div.querySelector('.btn-serie-grid').addEventListener('click', () => {
          openSerieOverlay(map.map, fg.naam, swiperEl);
        });

        // Directe click listeners op imgs — omzeilt Swiper event-interceptie
        swiperEl.querySelectorAll('img').forEach(img => {
          img.style.cursor = 'pointer';
          img.addEventListener('click', e => {
            e.stopPropagation();
            if (window._openLightboxVanImg) window._openLightboxVanImg(img);
          });
        });
      }
    }

    // Herinitialiseer lightbox voor nieuwe slides
    if (fotografen.length) initLightbox();

  } catch (e) {
    console.warn('Gastfotografen niet geladen:', e);
  }
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
  let allImages = [], allKeys = [], currentIdx = 0;

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
    showLightbox(allImages.indexOf(img));
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  // Globaal beschikbaar voor gastfotograaf-slides
  window._openLightboxVanImg = openLightboxVanImg;

  // Openen vanuit serie-overlay (geeft array van {src,naam} en startindex)
  window._openLightboxVanSerie = function(fotos, startIdx) {
    allImages = fotos.map(f => ({ src: f.src }));
    allKeys   = fotos.map(() => '');
    showLightbox(startIdx);
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

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
