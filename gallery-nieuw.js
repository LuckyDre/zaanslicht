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
  // Bekijken gebeurt op de 2200px-versie (-groot.webp); alleen foto's die
  // breder waren hebben die. Downloaden blijft het volledige origineel.
  const lbImg = document.getElementById('lb2-img');
  // Geketende terugval: -groot (2200px) → origineel op Pages → master via de Worker.
  // Foto's die nooit breder dan 2200px waren hebben geen -groot en landen dus op
  // stap 2, rechtstreeks bij Pages — die blijven daarmee even snel als voorheen.
  // Stap 3 vangt de masters op die sinds v0.48 alleen nog in R2 staan.
  const terugval = [f.groot, f.src, f.master].filter(Boolean);
  let stap = 0;
  lbImg.onerror = () => {
    stap += 1;
    if (stap < terugval.length) lbImg.src = terugval[stap];
  };
  lbImg.src = terugval[0];
  document.getElementById('lb2-teller').textContent = `${_lb_idx + 1} / ${_lb_fotos.length}`;
  document.getElementById('lb2-prev').style.opacity = _lb_idx === 0 ? '0.2' : '1';
  document.getElementById('lb2-next').style.opacity = _lb_idx === _lb_fotos.length - 1 ? '0.2' : '1';
  // Downloaden gaat altijd via de master-URL: die werkt of het bestand in R2 staat
  // of nog op Pages, en stuurt CORS-headers mee die de canvas-omzetting nodig heeft.
  document.getElementById('lb2-download').dataset.src  = f.master || f.src;
  document.getElementById('lb2-download').dataset.naam = f.src.split('/').pop().split('?')[0];
  // Stel key in voor like/reacties script
  const likeEl = document.getElementById('lb2-like');
  if (likeEl) likeEl.dataset.key = f.key || '';
  // Fotoweergave tellen voor de views-teller in beheer (eigenaar uit de foto-key)
  if (window.zlTelFotoView) {
    const key = f.key || '';
    window.zlTelFotoView(key.startsWith('gast__') ? key.split('__')[1] : 'eigen');
  }
}

function lbSluit() {
  document.getElementById('lb2').classList.add('lb2-hidden');
  // Een foto wordt altijd bekeken bínnen het overzicht-grid van de serie.
  // Sluit je de foto, dan blijft dat grid open (kijker kiest de volgende foto);
  // pas het sluiten van het grid brengt je terug naar de sliderpagina. Body-scroll
  // dus alleen vrijgeven als het grid óók dicht is.
  const ovOpen = document.getElementById('ov').classList.contains('ov-open');
  if (!ovOpen) { document.body.style.overflow = ''; return; }
  // Grid blijft open: scroll (indien al gerenderd) naar de laatst bekeken foto,
  // zodat na vooruit/terug-bladeren de juiste thumbnail in beeld staat.
  const doel = document.getElementById('ov-grid').querySelectorAll('.ov-thumb')[_lb_idx];
  if (doel) doel.scrollIntoView({ block: 'center' });
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
    // Staat er een foto open, dan handelt de lightbox de toets af — voorkom dat
    // de overzicht-handler dezelfde Escape óók verwerkt en het grid meesluit.
    if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.stopImmediatePropagation();
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

// "2026-09-12" → "12 september 2026". Lege of onherkenbare datum → lege string,
// zodat een serie zonder ingestelde datum niets extra's toont.
const MAANDEN_NL = ['januari','februari','maart','april','mei','juni',
                    'juli','augustus','september','oktober','november','december'];

function datumNL(datum) {
  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return '';
  const [jaar, maand, dag] = datum.split('-').map(Number);
  if (!MAANDEN_NL[maand - 1]) return '';
  return `${dag} ${MAANDEN_NL[maand - 1]} ${jaar}`;
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
      100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
    .pc-datum{font-size:.72rem;letter-spacing:.5px;color:var(--dim,#888);white-space:nowrap;}
    /* Zonder deze twee regels duwt de datum de kop te breed op een telefoon:
       gemeten op 320-420px liep .pc-titel ~80px buiten zijn kader. De rechterbalk
       mag nu afbreken naar een tweede regel in plaats van uit te dijen. */
    .pc-titel .pc-rechts{flex-wrap:wrap;justify-content:flex-end;row-gap:.3rem;flex-shrink:1;}
    .pc-deel-ok{border-color:#3ddc7f !important;color:#3ddc7f !important;background:rgba(61,220,127,.1) !important;}
    @media(max-width:600px){.pc-datum{font-size:.66rem;}}`;
  document.head.appendChild(st);
}

// Kopieert tekst naar het klembord. navigator.clipboard is niet overal
// beschikbaar (oudere browsers, of een pagina zonder https), vandaar de
// terugvalweg via een verborgen tekstveld.
async function kopieerNaarKlembord(tekst) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(tekst);
      return true;
    }
  } catch (e) { /* hieronder de terugvalweg */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = tekst;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

// ── RENDER SERIE ──────────────────────────────────────────────────────────
function renderSerie(container, { naam, fotograaf, fotos, kleur, labels, beschrijving, datum }) {
  if (!fotos.length) return;

  const div = document.createElement('div');
  div.className = 'pc';

  // Altijd injecteren: de stijl bevat naast de NIEUW-badge ook de datum en de
  // bevestiging van de deelknop. Stond die aanroep alleen achter isNieuw()/datum,
  // dan miste een serie zonder datum de groene terugkoppeling bij het kopiëren.
  ensureNieuwStyles();

  // Header
  const h3 = document.createElement('h3');
  h3.className = 'pc-titel';
  h3.innerHTML = `${naam}${fotograaf ? `<span class="pc-sub">${fotograaf}</span>` : ''}
    <span class="pc-rechts"><span class="pc-count">${fotos.length} foto's</span></span>`;
  if (kleur) { const sub = h3.querySelector('.pc-sub'); if (sub) sub.style.color = kleur; }

  // Datum van de serie, links in de rechterbalk. Staat er geen datum ingesteld,
  // dan blijft de kop precies zoals hij was.
  const datumTekst = datumNL(datum);
  if (datumTekst) {
    ensureNieuwStyles();
    const d = document.createElement('span');
    d.className = 'pc-datum';
    d.textContent = datumTekst;
    const rechts = h3.querySelector('.pc-rechts');
    rechts.insertBefore(d, rechts.firstChild);
  }

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
  ovBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>';
  ovBtn.addEventListener('click', e => { e.stopPropagation(); toonOverzicht(naam, fotos); });
  h3.querySelector('.pc-rechts').appendChild(ovBtn);

  // Deelknop: geeft een directe link naar déze serie. Zo'n link met de hand
  // maken ging mis (14-09-2026): spaties moeten %20 worden, anders knipt
  // WhatsApp de link af bij de eerste spatie en landt de kijker bovenaan de
  // pagina in plaats van bij de wedstrijd. encodeURIComponent doet dat nu.
  const deelBtn = document.createElement('button');
  deelBtn.className = 'pc-overzicht pc-deel';
  deelBtn.title = 'Link naar deze serie kopiëren';
  const DEEL_ICOON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"></line><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line></svg>';
  const VINK_ICOON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  deelBtn.innerHTML = DEEL_ICOON;

  deelBtn.addEventListener('click', async e => {
    e.stopPropagation();
    const link = `${location.origin}${location.pathname}#serie=${encodeURIComponent(naam)}`;

    // Alleen op een aanraakapparaat het echte deelmenu (WhatsApp, Mail...). Op de
    // desktop bestaat navigator.share ook, maar daar opent het een modaal
    // systeemvenster dat de pagina blokkeert — onverwacht voor een kopieerknop.
    const isAanraak = matchMedia('(pointer: coarse)').matches;
    if (navigator.share && isAanraak) {
      try { await navigator.share({ title: naam, url: link }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }  // zelf geannuleerd
    }
    const gelukt = await kopieerNaarKlembord(link);
    deelBtn.innerHTML = gelukt ? VINK_ICOON : DEEL_ICOON;
    deelBtn.title = gelukt ? 'Link gekopieerd!' : link;
    deelBtn.classList.toggle('pc-deel-ok', gelukt);
    if (!gelukt) window.prompt('Kopieer de link naar deze serie:', link);
    setTimeout(() => {
      deelBtn.innerHTML = DEEL_ICOON;
      deelBtn.title = 'Link naar deze serie kopiëren';
      deelBtn.classList.remove('pc-deel-ok');
    }, 2500);
  });
  h3.querySelector('.pc-rechts').appendChild(deelBtn);

  div.appendChild(h3);

  // Verhaal/beschrijving boven de slider — standaard 2 regels, uitklapbaar
  if (beschrijving?.trim()) {
    const p = document.createElement('p');
    p.className = 'serie-beschrijving';
    p.textContent = beschrijving.trim();
    div.appendChild(p);

    // Pas na render is scrollHeight bekend; alleen dan een toggle tonen als
    // de tekst daadwerkelijk over de 2 regels heen gaat.
    requestAnimationFrame(() => {
      if (p.scrollHeight > p.clientHeight + 1) {
        const toggle = document.createElement('button');
        toggle.className = 'serie-beschrijving-toggle';
        toggle.type = 'button';
        toggle.textContent = 'Lees meer';
        toggle.addEventListener('click', () => {
          const open = p.classList.toggle('open');
          toggle.textContent = open ? 'Lees minder' : 'Lees meer';
        });
        p.insertAdjacentElement('afterend', toggle);
      }
    });
  }

  // Foto-grid
  const grid = document.createElement('div');
  grid.className = 'foto-grid';
  fotos.forEach((f, i) => {
    const cel = document.createElement('div');
    cel.className = 'foto-cel';
    cel.innerHTML = `<img src="${f.thumb || f.src}" alt="${naam}" loading="lazy" onerror="if(this.src!=='${f.src}')this.src='${f.src}'" />`;
    // Open de foto binnen het overzicht-grid, zodat sluiten terugkeert naar het
    // grid (volgende foto kiezen) i.p.v. meteen naar de sliderpagina.
    cel.addEventListener('click', () => { toonOverzicht(naam, fotos, i); lbOpen(fotos, i); });
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

// Onthoudt de huidig geopende serie zodat lbSluit naar de laatst bekeken foto
// in het grid kan terugscrollen.
let _ov_fotos = [];

function toonOverzicht(titel, fotos, scrollNaarIdx = -1) {
  const modal = document.getElementById('ov');
  const grid  = document.getElementById('ov-grid');

  // Cleanup vorige observer
  if (_ovObserver) { _ovObserver.disconnect(); _ovObserver = null; }

  document.getElementById('ov-titel').textContent = `${titel} (${fotos.length})`;
  grid.innerHTML = '';
  grid.scrollTop = 0;
  _ov_fotos = fotos;

  let rendered = 0;
  let sentinel = null;

  function renderBatch() {
    // Loop-veilig: ruim de vorige sentinel/observer op vóór we verder renderen,
    // zodat vooruit-renderen (scrollNaarIdx) geen losse sentinels achterlaat.
    if (_ovObserver) { _ovObserver.disconnect(); _ovObserver = null; }
    if (sentinel) { sentinel.remove(); sentinel = null; }

    const batch = fotos.slice(rendered, rendered + OV_PAGE);
    batch.forEach((f, i) => {
      const absIdx = rendered + i;
      const d = document.createElement('div');
      d.className = 'ov-thumb';
      const img = document.createElement('img');
      // Thumbnail (400px), niet het origineel: een serie originelen is al gauw
      // tientallen MB's en maakte deze view tergend traag. Lightbox toont wél
      // het origineel.
      img.src = f.thumb || f.src;
      img.loading = 'lazy';
      img.alt = '';
      // Ontbreekt de thumbnail, val één keer terug op het origineel.
      img.onerror = () => {
        if (img.dataset.viel_terug) return;
        img.dataset.viel_terug = '1';
        img.src = f.src;
      };
      d.appendChild(img);
      d.addEventListener('click', () => lbOpen(fotos, absIdx));
      grid.appendChild(d);
    });
    rendered += batch.length;

    // Sentinel voor volgende batch (lazy-load bij scrollen)
    if (rendered < fotos.length) {
      sentinel = document.createElement('div');
      sentinel.style.cssText = 'grid-column:1/-1;height:1px;';
      grid.appendChild(sentinel);

      _ovObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) renderBatch();
      }, { root: grid, rootMargin: '0px 0px 300px 0px' });

      _ovObserver.observe(sentinel);
    }
  }

  renderBatch();

  modal.classList.add('ov-open');
  document.body.style.overflow = 'hidden';

  // Geopend vanuit een slider-foto: render door tot die foto in het grid zit en
  // scroll ernaartoe, zodat het sluiten van de foto op de juiste plek terugkomt.
  // Ná het openen van het grid (display:flex), anders kan scrollIntoView niets meten.
  if (scrollNaarIdx >= 0) {
    while (rendered <= scrollNaarIdx && rendered < fotos.length) renderBatch();
    const doel = grid.querySelectorAll('.ov-thumb')[scrollNaarIdx];
    if (doel) doel.scrollIntoView({ block: 'center' });
  }
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
    // Alleen sluiten als het grid open is én er geen foto bovenop staat —
    // anders sluit Escape eerst de foto (de lightbox-handler doet dat).
    const lbOpen = !document.getElementById('lb2').classList.contains('lb2-hidden');
    if (e.key === 'Escape' && modal.classList.contains('ov-open') && !lbOpen) sluitOverzicht();
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

    // Labels van eigen series staan in KV (via beheer.html), niet in manifest.json —
    // haal ze los op zodat de labelchips ook bij eigen series verschijnen. Faalt veilig.
    const eigenLabels = await fetch(WORKER_URL + '/eigen-labels')
      .then(r => r.json()).catch(() => ({}));

    const eigenItems = manifest[CATEGORY] || [];
    const fotografen = (gastData.fotografen || []).filter(fg => fg.mappen?.length);

    container.innerHTML = '';

    // Likes laden met korte deadline: kort wachten zodat de eerste series al
    // gesorteerd renderen, maar de galerij nooit blokkeren als Firebase traag/stuk is
    let likeCounts = {};
    const likesPromise = fbGet('likes');
    likeCounts = (await Promise.race([
      likesPromise,
      new Promise(r => setTimeout(() => r(null), 800)),
    ]).catch(() => null)) || {};
    likesPromise.then(counts => {
      likeCounts = counts || {};
      container.querySelectorAll('.btn-like[data-key]').forEach(btn => {
        const c = likeCounts[btn.dataset.key] || 0;
        const sp = btn.querySelector('.like-count');
        if (sp) sp.textContent = c > 0 ? c : '';
      });
    }).catch(() => {});

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
      return item.fotos
        .map(f => ({
          src:   `images/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f)}`,
          thumb: `images/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f.replace(/\.webp$/i, '-thumb.webp'))}`,
          groot: `images/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f.replace(/\.webp$/i, '-groot.webp'))}`,
          // Camera-masters (>2200px) staan sinds v0.48 in R2 i.p.v. op Pages, om de
          // gepubliceerde site onder de 1 GB-richtlijn te houden. De Worker serveert
          // ze, en geeft foto's die nooit verhuisden (≤2200px) door vanaf Pages.
          // Alleen de downloadknop heeft dit nodig — thumb en groot staan op Pages.
          master: `${WORKER_URL}/foto/eigen/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f)}`,
          key:   photoKey(`${CATEGORY}/${item.map}/${f}`),
        }))
        .sort((a, b) => (likeCounts[b.key] || 0) - (likeCounts[a.key] || 0));
    }

    async function gastNaarFotos(fgId, mapNaam) {
      const fotos = await getGastFotos(fgId, mapNaam);
      return fotos
        .map(f => ({
          src:   `${WORKER_URL}/foto/${f.key}`,
          thumb: `${WORKER_URL}/foto/${f.key}?thumb=1`,
          key:   photoKey(`gast/${fgId}/${f.naam}`),
        }))
        .sort((a, b) => (likeCounts[b.key] || 0) - (likeCounts[a.key] || 0));
    }

    // Bouw gecombineerde lijst van alle series met hun datum
    const alleSeries = [];

    for (const item of eigenItems) {
      if (item.verborgen) continue;
      alleSeries.push({
        datum: item.datum || '',
        render: () => renderSerie(container, {
          naam: item.naam, fotograaf: item.fotograaf,
          fotos: eigenNaarFotos(item),
          labels: item.labels || eigenLabels[`${CATEGORY}/${item.map}`] || [],
          beschrijving: item.beschrijving, datum: item.datum,
        }),
      });
    }

    for (const fg of fotografen) {
      const mappen = (fg.mappen || []).filter(m => {
        if (CATEGORY === 'voetbal')    return m.opVoetbal  !== undefined ? m.opVoetbal  : m.categorie === 'voetbal';
        if (CATEGORY === 'nosports')   return m.opNosports !== undefined ? m.opNosports : m.categorie === 'nosports';
        if (CATEGORY === 'othersports') return m.opOthersports === true;
        return false;
      });
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
      // Direct na het renderen proberen: staat de gezochte serie er, dan springt
      // de pagina meteen in plaats van pas na de laatste gastserie.
      scrollNaarSerieUitHash(container);
    }

    if (!container.children.length) {
      container.innerHTML = '<p class="leeg">Nog geen foto\'s — kom snel terug!</p>';
    }

    // Update totaaltelller bovenaan met alle foto's (eigen + gast)
    const totaalFotos = Array.from(container.querySelectorAll('.foto-cel')).length;
    const totaalSeries = container.querySelectorAll('.pc').length;
    const fotoEl   = document.getElementById('meta-fotos');
    const mappenEl = document.getElementById('meta-mappen');
    if (fotoEl)   fotoEl.textContent   = totaalFotos.toLocaleString('nl-NL');
    if (mappenEl) mappenEl.textContent = totaalSeries;

    // Deeplink vanuit zoekfunctie: #serie=<naam> → scroll naar die serie.
    // Laatste correctie: afbeeldingen die intussen zijn ingeladen kunnen de
    // hoogte hebben veranderd. Slaat zichzelf over als de bezoeker al scrolt.
    scrollNaarSerieUitHash(container, true);

  } catch (err) {
    console.error('Gallery laden mislukt:', err);
    container.innerHTML = '<p class="leeg">Kon foto\'s niet laden.</p>';
  }
}

// ── DEEPLINK #serie=<naam> ────────────────────────────────────────────────
// Werd tot 14-09-2026 pas aangeroepen nádat álle series gerenderd waren. Elke
// gastserie doet daarvoor een eigen fetch, dus dat duurt op een verse pagina
// seconden — een bezoeker die een gedeelde link opende was allang zelf aan het
// scrollen voordat de sprong kwam, en de markering stond maar 2,5s. Nu springt
// hij zodra de gezochte serie in de DOM staat, en corrigeert hij de positie na
// afloop alleen als de bezoeker nog niet zelf heeft gescrold.
let _dlEl = null;          // gevonden serie-element
let _dlGemarkeerd = false;
let _dlEigenScroll = false;

for (const ev of ['wheel', 'touchstart', 'keydown']) {
  window.addEventListener(ev, () => { _dlEigenScroll = true; }, { passive: true, once: true });
}

function deeplinkDoel() {
  const m = location.hash.match(/^#serie=(.+)$/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).trim(); } catch { return null; }
}

function scrollNaarSerieUitHash(container, definitief = false) {
  const doel = deeplinkDoel();
  if (!doel) return;

  if (!_dlEl) {
    for (const pc of container.querySelectorAll('.pc')) {
      const titel = pc.querySelector('.pc-titel');
      // childNodes[0] is de naam-tekst, vóór de sub/teller-spans
      const naam = titel?.childNodes[0]?.nodeValue?.trim() || '';
      if (naam === doel) { _dlEl = pc; break; }
    }
  }
  if (!_dlEl) return;

  // Na afloop niet nóg eens springen als de bezoeker zelf de pagina al bedient.
  if (definitief && _dlEigenScroll) return;

  _dlEl.scrollIntoView({ behavior: definitief ? 'auto' : 'smooth', block: 'start' });

  if (!_dlGemarkeerd) {
    _dlGemarkeerd = true;
    _dlEl.style.transition = 'box-shadow 0.4s';
    _dlEl.style.boxShadow = '0 0 0 2px var(--oranje, #FF6B00)';
    setTimeout(() => { if (_dlEl) _dlEl.style.boxShadow = ''; }, 6000);
  }
}

laadGallery();
