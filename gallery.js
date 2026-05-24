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
    initComments();

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
      lbDownload.href     = img.src;
      lbDownload.download = img.src.split('/').pop();
    }
    if (window._setCommentPhoto) window._setCommentPhoto(key, img.src);
  }

  document.addEventListener('click', e => {
    const img = e.target.closest('.portfolio-swiper img');
    if (!img) return;
    const slider = img.closest('.portfolio-swiper');
    allImages  = Array.from(slider.querySelectorAll('img'));
    // Verzamel bijbehorende keys uit de slide-actions knoppen
    allKeys = Array.from(slider.querySelectorAll('.swiper-slide')).map(slide => {
      const btn = slide.querySelector('.btn-like');
      return btn ? btn.dataset.key : '';
    });
    showLightbox(allImages.indexOf(img));
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
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

loadGallery();
