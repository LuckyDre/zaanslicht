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
  // Stel key in voor like/reacties script
  const likeEl = document.getElementById('lb2-like');
  if (likeEl) likeEl.dataset.key = f.key || '';
}

function lbSluit() {
  document.getElementById('lb2').classList.add('lb2-hidden');
  document.body.style.overflow = '';
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
    <span class="pc-rechts"><span class="pc-count">${fotos.length} foto's</span></span>`;
  if (kleur) { const sub = h3.querySelector('.pc-sub'); if (sub) sub.style.color = kleur; }
  div.appendChild(h3);

  // Foto-grid — geen Swiper, gewoon scrollen
  const grid = document.createElement('div');
  grid.className = 'foto-grid';
  fotos.forEach((f, i) => {
    const cel = document.createElement('div');
    cel.className = 'foto-cel';
    cel.innerHTML = `<img src="${f.src}" alt="${naam}" loading="lazy" />`;
    cel.addEventListener('click', () => lbOpen(fotos, i));
    grid.appendChild(cel);
  });

  div.appendChild(grid);
  container.appendChild(div);
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

    // Zelfde key-transformatie als de oude gallery.js: / → __ en . → --
    function photoKey(path) {
      return path.replace(/\//g, '__').replace(/\./g, '--');
    }

    function eigenNaarFotos(item) {
      return item.fotos.map(f => ({
        src: `images/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f)}`,
        key: photoKey(`${CATEGORY}/${item.map}/${f}`),
      }));
    }

    async function gastNaarFotos(fgId, mapNaam) {
      const fotos = await getGastFotos(fgId, mapNaam);
      return fotos.map(f => ({
        src: `${WORKER_URL}/foto/${f.key}`,
        key: photoKey(`gast/${fgId}/${f.naam}`),
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
      // Eigen items die ontbreken in volgorde → achteraan (.trim() voor veiligheid)
      for (const item of eigenItems) {
        if (!gecombineerd.find(e => e.type === 'eigen' && e.map.trim() === item.map.trim())) {
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

    // Update totaaltelller bovenaan met alle foto's (eigen + gast)
    const totaalFotos = Array.from(container.querySelectorAll('.pc-swiper .swiper-slide')).length;
    const totaalSeries = container.querySelectorAll('.pc').length;
    const fotoEl   = document.getElementById('meta-fotos');
    const mappenEl = document.getElementById('meta-mappen');
    if (fotoEl)   fotoEl.textContent   = totaalFotos.toLocaleString('nl-NL');
    if (mappenEl) mappenEl.textContent = totaalSeries;

  } catch (err) {
    console.error('Gallery laden mislukt:', err);
    container.innerHTML = '<p class="leeg">Kon foto\'s niet laden.</p>';
  }
}

laadGallery();
