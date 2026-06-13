// gallery-nieuw.js — schone herstart, werkt voor alle fotografen
// Gebruik: <script src="gallery-nieuw.js" data-category="voetbal"></script>

const CATEGORY   = document.currentScript.getAttribute('data-category');
const WORKER_URL = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

let _ovObserver = null; // IntersectionObserver voor lazy-load in overzicht

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

// ── "NIEUW"-badge: series met een datum < 2 weken oud ─────────────────────
const NIEUW_DAGEN = 14;

function isNieuw(datum) {
  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return false;
  const d = new Date(datum + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const dagenOud = (Date.now() - d.getTime()) / 86400000;
  return dagenOud >= 0 && dagenOud < NIEUW_DAGEN; // vandaag t/m 13 dagen oud
}

// Voeg de badge-stijl éénmalig toe (werkt op elke pagina die deze gallery laadt)
function ensureNieuwStyles() {
  if (document.getElementById('pc-nieuw-styles')) return;
  const st = document.createElement('style');
  st.id = 'pc-nieuw-styles';
  st.textContent = `
    .pc-nieuw{display:inline-flex;align-items:center;gap:.35rem;font-size:.62rem;font-weight:800;
      letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;color:#fff;
      background:linear-gradient(135deg,#FF6B00,#ff3d3d);padding:.28rem .6rem;border-radius:100px;
      box-shadow:0 2px 8px rgba(255,61,61,.4);}
    .pc-nieuw::before{content:'';width:6px;height:6px;border-radius:50%;background:#fff;
      animation:pc-nieuw-pulse 1.8s infinite;}
    @keyframes pc-nieuw-pulse{
      0%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}
      70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}
      100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}`;
  document.head.appendChild(st);
}

// ── RENDER SERIE ──────────────────────────────────────────────────────────
function renderSerie(container, { naam, fotograaf, fotos, kleur, labels, beschrijving, datum }) {
  if (!fotos.length) return;

  const div = document.createElement('div');
  div.className = 'pc';

  // Header
  const h3 = document.createElement('h3');
  h3.className = 'pc-titel';
  h3.innerHTML = `${naam}${fotograaf ? `<span class="pc-sub">${fotograaf}</span>` : ''}
    <span class="pc-rechts"><span class="pc-count">${fotos.length} foto's</span></span>`;
  if (kleur) { const sub = h3.querySelector('.pc-sub'); if (sub) sub.style.color = kleur; }

  // "NIEUW"-badge vóór de fototeller als de serie < 2 weken oud is
  if (isNieuw(datum)) {
    ensureNieuwStyles();
    const badge = document.createElement('span');
    badge.className = 'pc-nieuw';
    badge.textContent = 'Nieuw';
    badge.title = 'Nieuwe foto\'s — blijven ongeveer 2 weken staan';
    const rechts = h3.querySelector('.pc-rechts');
    rechts.insertBefore(badge, rechts.querySelector('.pc-count'));
  }

  // Overzicht-knop naast de teller
  const ovBtn = document.createElement('button');
  ovBtn.className = 'pc-overzicht';
  ovBtn.title = 'Alle foto\'s als thumbnail';
  ovBtn.textContent = '⊞';
  ovBtn.addEventListener('click', e => { e.stopPropagation(); toonOverzicht(naam, fotos); });
  h3.querySelector('.pc-rechts').appendChild(ovBtn);

  div.appendChild(h3);

  // Verhaal/beschrijving boven de slider
  if (beschrijving?.trim()) {
    const p = document.createElement('p');
    p.className = 'serie-beschrijving';
    p.textContent = beschrijving.trim();
    div.appendChild(p);
  }

  // Foto-grid
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

  // Labels onderaan de slider
  if (labels?.length) {
    const labelBar = document.createElement('div');
    labelBar.className = 'serie-labels';
    labelBar.innerHTML = labels.map(l =>
      `<span class="serie-label-chip">${l}</span>`
    ).join('');
    div.appendChild(labelBar);
  }

  container.appendChild(div);
}

// ── OVERZICHT GRID (lazy-load: 20 thumbnails, meer bij scrollen) ───────────
const OV_PAGE = 30;

function toonOverzicht(titel, fotos) {
  const modal = document.getElementById('ov');
  const grid  = document.getElementById('ov-grid');

  // Cleanup vorige observer
  if (_ovObserver) { _ovObserver.disconnect(); _ovObserver = null; }

  document.getElementById('ov-titel').textContent = `${titel} (${fotos.length})`;
  grid.innerHTML = '';
  grid.scrollTop = 0;

  let rendered = 0;

  function renderBatch() {
    const batch = fotos.slice(rendered, rendered + OV_PAGE);
    batch.forEach((f, i) => {
      const absIdx = rendered + i;
      const d = document.createElement('div');
      d.className = 'ov-thumb';
      const img = document.createElement('img');
      img.src = f.src;
      img.loading = 'lazy';
      img.alt = '';
      d.appendChild(img);
      d.addEventListener('click', () => {
        sluitOverzicht();
        setTimeout(() => lbOpen(fotos, absIdx), 50);
      });
      grid.appendChild(d);
    });
    rendered += batch.length;

    // Sentinel voor volgende batch
    if (rendered < fotos.length) {
      const sentinel = document.createElement('div');
      sentinel.style.cssText = 'grid-column:1/-1;height:1px;';
      grid.appendChild(sentinel);

      _ovObserver = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) return;
        _ovObserver.disconnect();
        _ovObserver = null;
        sentinel.remove();
        renderBatch();
      }, { root: grid, rootMargin: '0px 0px 300px 0px' });

      _ovObserver.observe(sentinel);
    }
  }

  renderBatch();

  modal.classList.add('ov-open');
  document.body.style.overflow = 'hidden';
}

function sluitOverzicht() {
  if (_ovObserver) { _ovObserver.disconnect(); _ovObserver = null; }
  const modal = document.getElementById('ov');
  modal.classList.remove('ov-open');
  document.body.style.overflow = '';
}

function initOverzicht() {
  document.getElementById('ov-terug').addEventListener('click', sluitOverzicht);
  document.getElementById('ov-sluit').addEventListener('click', sluitOverzicht);
  const modal = document.getElementById('ov');
  modal.addEventListener('click', e => { if (e.target === modal) sluitOverzicht(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('ov-open')) sluitOverzicht();
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
    // Laad manifest + gast manifest parallel
    const [manRes, gastRes] = await Promise.all([
      fetch('manifest.json?v=' + Date.now()),
      fetch(WORKER_URL + '/fotograaf/manifest'),
    ]);

    const manifest  = await manRes.json();
    const gastData  = await gastRes.json();

    const eigenItems = manifest[CATEGORY] || [];
    const fotografen = (gastData.fotografen || []).filter(fg => fg.mappen?.length);

    container.innerHTML = '';

    // Bouw lookup voor gast-fotos
    const gastCache = {};
    async function getGastFotos(fgId, mapNaam) {
      if (!gastCache[fgId]) {
        const r = await fetch(`${WORKER_URL}/fotograaf/fotos?id=${fgId}`);
        const d = await r.json();
        gastCache[fgId] = d.fotos || [];
      }
      return gastCache[fgId].filter(f => {
        try {
          const decodedKey = decodeURIComponent(f.key);
          return decodedKey.includes(`/${mapNaam}/`) || decodedKey.includes(`/${decodeURIComponent(mapNaam)}/`);
        } catch { return false; }
      });
    }

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

    // Bouw gecombineerde lijst van alle series met hun datum
    const alleSeries = [];

    for (const item of eigenItems) {
      alleSeries.push({
        datum: item.datum || '',
        render: () => renderSerie(container, {
          naam: item.naam, fotograaf: item.fotograaf,
          fotos: eigenNaarFotos(item), labels: item.labels,
          beschrijving: item.beschrijving, datum: item.datum,
        }),
      });
    }

    for (const fg of fotografen) {
      const mappen = (fg.mappen || []).filter(m =>
        m.categorie === CATEGORY ||
        (m.categorie === 'eigen' && CATEGORY === 'voetbal')
      );
      for (const map of mappen) {
        alleSeries.push({
          datum: map.datum || '',
          render: async () => {
            const fotos = await gastNaarFotos(fg.id, map.map);
            if (fotos.length) renderSerie(container, {
              naam: map.map, fotograaf: fg.naam,
              fotos, kleur: fg.kleur, labels: map.labels, datum: map.datum,
            });
          },
        });
      }
    }

    // Sorteer op datum (nieuwste eerst), series zonder datum achteraan
    alleSeries.sort((a, b) => {
      if (!a.datum && !b.datum) return 0;
      if (!a.datum) return 1;
      if (!b.datum) return -1;
      return b.datum.localeCompare(a.datum);
    });

    for (const serie of alleSeries) {
      await serie.render();
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

    // Deeplink vanuit zoekfunctie: #serie=<naam> → scroll naar die serie
    scrollNaarSerieUitHash(container);

  } catch (err) {
    console.error('Gallery laden mislukt:', err);
    container.innerHTML = '<p class="leeg">Kon foto\'s niet laden.</p>';
  }
}

function scrollNaarSerieUitHash(container) {
  const m = location.hash.match(/^#serie=(.+)$/);
  if (!m) return;
  let doel;
  try { doel = decodeURIComponent(m[1]).trim(); } catch { return; }
  const pcs = container.querySelectorAll('.pc');
  for (const pc of pcs) {
    const titel = pc.querySelector('.pc-titel');
    // childNodes[0] is de naam-tekst, vóór de sub/teller-spans
    const naam = titel?.childNodes[0]?.nodeValue?.trim() || '';
    if (naam === doel) {
      pc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      pc.style.transition = 'box-shadow 0.4s';
      pc.style.boxShadow = '0 0 0 2px var(--oranje, #FF6B00)';
      setTimeout(() => { pc.style.boxShadow = ''; }, 2500);
      return;
    }
  }
}

laadGallery();
