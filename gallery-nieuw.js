// gallery-nieuw.js — schone herstart, werkt voor alle fotografen
// Gebruik: <script src="gallery-nieuw.js" data-category="voetbal"></script>

const CATEGORY   = document.currentScript.getAttribute('data-category');
const WORKER_URL = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

// ── LIGHTBOX ──────────────────────────────────────────────────────────────
let _lb_fotos = [];   // { src, key } van de huidige open serie
let _lb_idx   = 0;

function lbOpen(fotos, startIdx) {
  _lb_fotos = fotos;
  _lb_idx   = startIdx;
  lbToon(_lb_idx);
  document.getElementById('lb2').classList.remove('lb2-hidden');
  document.body.style.overflow = 'hidden';
}

function lbToon(idx) {
  _lb_idx = Math.max(0, Math.min(idx, _lb_fotos.length - 1));
  const f = _lb_fotos[_lb_idx];
  document.getElementById('lb2-img').src = f.src;
  document.getElementById('lb2-teller').textContent = `${_lb_idx + 1} / ${_lb_fotos.length}`;
  document.getElementById('lb2-prev').style.opacity = _lb_idx === 0 ? '0.2' : '1';
  document.getElementById('lb2-next').style.opacity = _lb_idx === _lb_fotos.length - 1 ? '0.2' : '1';
  document.getElementById('lb2-download').dataset.src  = f.src;
  document.getElementById('lb2-download').dataset.naam = f.src.split('/').pop().split('?')[0];

  // Like bijwerken
  const likeBtn = document.getElementById('lb2-like');
  if (likeBtn && f.key) {
    likeBtn.dataset.key = f.key;
    likeBtn.classList.toggle('geliked', isLikedLocally(f.key));
    const countEl = document.getElementById('lb2-like-count');
    if (typeof db !== 'undefined') {
      db.ref(`likes/${f.key}`).once('value').then(s => {
        const c = s.val() || 0;
        if (countEl) countEl.textContent = c > 0 ? c : '';
      });
    }
  }

  // Reacties teller bijwerken
  if (f.key) {
    fetch(WORKER_URL + '/comments?key=' + encodeURIComponent(f.key))
      .then(r => r.json())
      .then(d => {
        const n = (d.comments || []).length;
        const rcEl = document.getElementById('lb2-rc-count');
        if (rcEl) rcEl.textContent = n > 0 ? n : '';
      }).catch(() => {});
  }
}

function lbSluit() {
  document.getElementById('lb2').classList.add('lb2-hidden');
  document.body.style.overflow = '';
  const drawer = document.getElementById('reacties-drawer');
  if (drawer) drawer.classList.add('slide-out');
}

// Lokale like opslag
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

function initLightbox() {
  document.getElementById('lb2-sluit').addEventListener('click', lbSluit);
  document.getElementById('lb2-prev').addEventListener('click', e => { e.stopPropagation(); lbToon(_lb_idx - 1); });
  document.getElementById('lb2-next').addEventListener('click', e => { e.stopPropagation(); lbToon(_lb_idx + 1); });
  document.getElementById('lb2').addEventListener('click', e => { if (e.target === document.getElementById('lb2')) lbSluit(); });
  document.getElementById('lb2-download').addEventListener('click', e => {
    e.stopPropagation();
    const { src, naam } = e.currentTarget.dataset;
    downloadFoto(src, naam);
  });
  document.addEventListener('keydown', e => {
    if (document.getElementById('lb2').classList.contains('lb2-hidden')) return;
    if (e.key === 'Escape')      lbSluit();
    if (e.key === 'ArrowLeft')   lbToon(_lb_idx - 1);
    if (e.key === 'ArrowRight')  lbToon(_lb_idx + 1);
  });

  // Like knop
  const likeBtn = document.getElementById('lb2-like');
  if (likeBtn) {
    likeBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const key = likeBtn.dataset.key;
      if (!key || typeof db === 'undefined') return;
      const liked = isLikedLocally(key);
      const ref   = db.ref(`likes/${key}`);
      if (liked) {
        await ref.transaction(cur => Math.max(0, (cur || 1) - 1));
        setLikedLocally(key, false); likeBtn.classList.remove('geliked');
      } else {
        await ref.transaction(cur => (cur || 0) + 1);
        setLikedLocally(key, true); likeBtn.classList.add('geliked');
      }
      const snap = await ref.once('value');
      const c = snap.val() || 0;
      const countEl = document.getElementById('lb2-like-count');
      if (countEl) countEl.textContent = c > 0 ? c : '';
    });
  }

  // Reacties knop
  const rcBtn = document.getElementById('lb2-reacties');
  const drawer = document.getElementById('reacties-drawer');
  if (rcBtn && drawer) {
    rcBtn.addEventListener('click', e => {
      e.stopPropagation();
      drawer.classList.toggle('slide-out');
      if (!drawer.classList.contains('slide-out')) laadReacties();
    });
    document.getElementById('rd-close').addEventListener('click', () => drawer.classList.add('slide-out'));
    document.getElementById('rd-form').addEventListener('submit', async e => {
      e.preventDefault();
      const tekst = document.getElementById('rd-tekst').value.trim();
      const naam  = document.getElementById('rd-naam').value.trim() || 'Anoniem';
      const key   = document.getElementById('lb2-like')?.dataset.key || '';
      if (!tekst || !key) return;
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const res = await fetch(WORKER_URL + '/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ naam, tekst, photoKey: key, src: document.getElementById('lb2-img').src }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || 'Fout');
        document.getElementById('rd-tekst').value = '';
        laadReacties();
      } catch (err) { alert('Fout: ' + err.message); }
      btn.disabled = false;
    });
  }

  function laadReacties() {
    const key = document.getElementById('lb2-like')?.dataset.key || '';
    const lijst = document.getElementById('rd-lijst');
    if (!lijst || !key) return;
    lijst.innerHTML = '<p class="rd-geen">Laden…</p>';
    fetch(WORKER_URL + '/comments?key=' + encodeURIComponent(key))
      .then(r => r.json())
      .then(d => {
        const items = d.comments || [];
        lijst.innerHTML = items.length === 0
          ? '<p class="rd-geen">Nog geen reacties</p>'
          : items.map(c => `<div class="rd-reactie">
              <div class="rd-r-naam">${c.naam || 'Anoniem'}</div>
              <div class="rd-r-tekst">${c.tekst}</div>
              <div class="rd-r-ts">${new Date(c.ts).toLocaleDateString('nl-NL')}</div>
            </div>`).join('');
        const n = items.length;
        const rcEl = document.getElementById('lb2-rc-count');
        if (rcEl) rcEl.textContent = n > 0 ? n : '';
      }).catch(() => { lijst.innerHTML = '<p class="rd-geen">Fout bij laden</p>'; });
  }
}

// ── RENDER SERIE ──────────────────────────────────────────────────────────
function renderSerie(container, { naam, fotograaf, fotos, kleur }) {
  if (!fotos.length) return;

  const div = document.createElement('div');
  div.className = 'pc';

  // Header
  const h3 = document.createElement('h3');
  h3.className = 'pc-titel';
  h3.innerHTML = `${naam}${fotograaf ? `<span class="pc-sub">${fotograaf}</span>` : ''}
    <span class="pc-rechts">
      <span class="pc-count">${fotos.length} foto's</span>
      <button class="pc-overzicht" title="Overzicht">⊞</button>
    </span>`;
  if (kleur) h3.querySelector('.pc-sub') && (h3.querySelector('.pc-sub').style.color = kleur);
  div.appendChild(h3);

  // Swiper
  const swiperEl = document.createElement('div');
  swiperEl.className = 'swiper pc-swiper';
  swiperEl.innerHTML = `
    <div class="swiper-wrapper">
      ${fotos.map((f, i) => `
        <div class="swiper-slide">
          <img src="${f.src}" alt="${naam}" loading="lazy" />
          <button class="foto-open" data-idx="${i}" aria-label="Foto openen"></button>
          <div class="slide-acties">
            <button class="btn-like" data-key="${f.key}" title="Like"><span class="hart">♥</span></button>
            <button class="btn-dl" data-src="${f.src}" data-naam="${f.src.split('/').pop().split('?')[0]}" title="Download">&#8681;</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="swiper-button-prev"></div>
    <div class="swiper-button-next"></div>
    <div class="swiper-pagination"></div>`;
  div.appendChild(swiperEl);
  container.appendChild(div);

  // Swiper init
  const sw = new Swiper(swiperEl, {
    loop: false, slidesPerView: 'auto', spaceBetween: 16, grabCursor: true,
    navigation: { nextEl: swiperEl.querySelector('.swiper-button-next'), prevEl: swiperEl.querySelector('.swiper-button-prev') },
    pagination: { el: swiperEl.querySelector('.swiper-pagination'), type: 'fraction' },
  });

  // Foto openen via transparante knop — 100% betrouwbaar
  swiperEl.querySelectorAll('.foto-open').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      lbOpen(fotos, parseInt(btn.dataset.idx));
    });
  });

  // Overzicht knop
  h3.querySelector('.pc-overzicht').addEventListener('click', e => {
    e.stopPropagation();
    toonOverzicht(naam, fotos);
  });
}

// ── OVERZICHT GRID ─────────────────────────────────────────────────────────
function toonOverzicht(titel, fotos) {
  const modal  = document.getElementById('ov');
  const grid   = document.getElementById('ov-grid');
  document.getElementById('ov-titel').textContent = titel;
  grid.innerHTML = '';
  fotos.forEach((f, i) => {
    const d = document.createElement('div');
    d.className = 'ov-thumb';
    d.innerHTML = `<img src="${f.src}" loading="lazy" />`;
    d.addEventListener('click', () => {
      modal.classList.remove('ov-open');
      document.body.style.overflow = '';
      setTimeout(() => lbOpen(fotos, i), 50);
    });
    grid.appendChild(d);
  });
  modal.classList.add('ov-open');
  document.body.style.overflow = 'hidden';
}

function initOverzicht() {
  const modal = document.getElementById('ov');
  document.getElementById('ov-terug').addEventListener('click', () => {
    modal.classList.remove('ov-open');
    document.body.style.overflow = '';
  });
  document.getElementById('ov-sluit').addEventListener('click', () => {
    modal.classList.remove('ov-open');
    document.body.style.overflow = '';
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) { modal.classList.remove('ov-open'); document.body.style.overflow = ''; }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('ov-open')) {
      modal.classList.remove('ov-open'); document.body.style.overflow = '';
    }
  });
}

// ── LIKES / DOWNLOAD ──────────────────────────────────────────────────────
function initActies() {
  document.addEventListener('click', async e => {
    // Like knop in slider
    const likeBtn = e.target.closest('.btn-like');
    if (likeBtn && !likeBtn.closest('.lb2')) {
      e.stopPropagation();
      likeBtn.classList.toggle('geliked');
      return;
    }
    // Download knop in slider
    const dlBtn = e.target.closest('.btn-dl');
    if (dlBtn) {
      e.stopPropagation();
      downloadFoto(dlBtn.dataset.src, dlBtn.dataset.naam);
    }
  });
}

// ── DOWNLOAD ──────────────────────────────────────────────────────────────
function downloadFoto(src, naam) {
  if (!src) return;
  const isWebp = src.toLowerCase().includes('.webp');
  if (isWebp) {
    // WebP → JPG via canvas
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const base = naam ? naam.replace(/\.webp$/i, '') : 'foto';
        a.href = url; a.download = base + '.jpg';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => window.open(src, '_blank');
    img.src = src;
  } else {
    // JPG/etc: Worker stuurt Content-Disposition: attachment bij ?download=1
    const downloadUrl = src.includes(WORKER_URL)
      ? src + (src.includes('?') ? '&' : '?') + 'download=1'
      : src;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = naam || 'foto.jpg';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }
}

// ── LADEN ─────────────────────────────────────────────────────────────────
async function laadGallery() {
  const container = document.getElementById('gallery-container');
  container.innerHTML = '<div class="laden">Laden<span class="puntjes"></span></div>';

  initLightbox();
  initOverzicht();
  initActies();

  try {
    // Laad manifest + gast manifest + gecombineerde volgorde parallel
    const [manRes, gastRes, volRes] = await Promise.all([
      fetch('manifest.json?v=' + Date.now()),
      fetch(WORKER_URL + '/fotograaf/manifest'),
      fetch(WORKER_URL + '/gallery/volgorde').catch(() => ({ json: () => ({}) })),
    ]);

    const manifest      = await manRes.json();
    const gastData      = await gastRes.json();
    const volgordeData  = await volRes.json().catch(() => ({}));

    const eigenItems   = manifest[CATEGORY] || [];
    const fotografen   = (gastData.fotografen || []).filter(fg => fg.mappen?.length);
    const gecombineerd = volgordeData[CATEGORY] || null;

    container.innerHTML = '';

    // Bouw lookup voor gast-fotos
    const gastCache = {};
    async function getGastFotos(fgId, mapNaam) {
      if (!gastCache[fgId]) {
        const r = await fetch(`${WORKER_URL}/fotograaf/fotos?id=${fgId}`);
        const d = await r.json();
        gastCache[fgId] = d.fotos || [];
      }
      // Zoek fotos van deze map — vergelijk decoded keys
      return gastCache[fgId].filter(f => {
        try {
          const decodedKey = decodeURIComponent(f.key);
          return decodedKey.includes(`/${mapNaam}/`) || decodedKey.includes(`/${decodeURIComponent(mapNaam)}/`);
        } catch { return false; }
      });
    }

    function eigenNaarFotos(item) {
      return item.fotos.map(f => ({
        src: `images/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f)}`,
        key: `${CATEGORY}__${item.map}__${f}`,
      }));
    }

    async function gastNaarFotos(fgId, mapNaam) {
      const fotos = await getGastFotos(fgId, mapNaam);
      return fotos.map(f => ({
        src: `${WORKER_URL}/foto/${f.key}`,
        key: `gast__${fgId}__${f.naam}`,
      }));
    }

    // Render in gecombineerde volgorde, of eigen-eerst als geen volgorde
    if (gecombineerd?.length) {
      for (const entry of gecombineerd) {
        if (entry.type === 'eigen') {
          const item = eigenItems.find(x => x.map === entry.map);
          if (item) renderSerie(container, {
            naam: item.naam, fotograaf: item.fotograaf,
            fotos: eigenNaarFotos(item),
          });
        } else if (entry.type === 'gast') {
          const fg = fotografen.find(x => x.id === entry.fgId);
          if (fg) {
            const fotos = await gastNaarFotos(fg.id, entry.map);
            if (fotos.length) renderSerie(container, {
              naam: entry.map, fotograaf: fg.naam,
              fotos, kleur: fg.kleur,
            });
          }
        }
      }
      // Eigen items die ontbreken in volgorde → achteraan
      for (const item of eigenItems) {
        if (!gecombineerd.find(e => e.type === 'eigen' && e.map === item.map)) {
          renderSerie(container, { naam: item.naam, fotograaf: item.fotograaf, fotos: eigenNaarFotos(item) });
        }
      }
    } else {
      // Geen opgeslagen volgorde: eigen eerst, daarna gast
      for (const item of eigenItems) {
        renderSerie(container, { naam: item.naam, fotograaf: item.fotograaf, fotos: eigenNaarFotos(item) });
      }
      for (const fg of fotografen) {
        const mappen = (fg.mappen || []).filter(m => m.categorie === CATEGORY || m.categorie === 'eigen');
        for (const map of mappen) {
          const fotos = await gastNaarFotos(fg.id, map.map);
          if (fotos.length) renderSerie(container, {
            naam: map.map, fotograaf: fg.naam, fotos, kleur: fg.kleur,
          });
        }
      }
    }

    if (!container.children.length) {
      container.innerHTML = '<p class="leeg">Nog geen foto\'s — kom snel terug!</p>';
    }

  } catch (err) {
    console.error('Gallery laden mislukt:', err);
    container.innerHTML = '<p class="leeg">Kon foto\'s niet laden.</p>';
  }
}

laadGallery();
