// zoek.js — site-brede zoekfunctie via zoekbalk in de header (tweede rij)
(function () {
  const WORKER = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

  // ── CSS ───────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Zoekbalk als tweede rij in de header */
    .zk-balk {
      flex: 0 0 100%;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 3rem;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .zk-balk-input {
      background: transparent;
      border: none;
      outline: none;
      color: #aaaaaa;
      font-size: 0.82rem;
      letter-spacing: 1px;
      text-transform: uppercase;
      flex: 1;
      font-family: inherit;
    }
    .zk-balk-input::placeholder { color: #444; letter-spacing: 1px; }
    .zk-balk-input:focus { color: #ffffff; }
    @media (max-width: 768px) {
      .zk-balk { padding: 0.4rem 1.2rem; }
    }
    /* Schuif eerste content-element naar beneden mee met header-hoogte */
    .page-hero,
    .contact-page,
    .clubs-header {
      padding-top: var(--zk-header-hoogte, 120px) !important;
    }
    .zk-trigger {
      background: none; border: none; cursor: pointer;
      color: #aaaaaa; font-size: 1rem; line-height: 1;
      padding: 0.1rem 0.2rem;
      transition: color 0.2s; flex-shrink: 0;
    }
    .zk-trigger:hover { color: var(--oranje, #FF6B00); }
    /* Volledige zoek-overlay */
    .zk-overlay {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(8,8,8,0.96); backdrop-filter: blur(8px);
      display: none; flex-direction: column; align-items: center;
      padding: 8vh 1.2rem 2rem; overflow-y: auto;
    }
    .zk-overlay.open { display: flex; }
    .zk-box { width: 100%; max-width: 620px; }
    .zk-sluit {
      position: absolute; top: 1.2rem; right: 1.6rem;
      background: none; border: none; color: #888; font-size: 1.6rem;
      cursor: pointer; transition: color 0.2s;
    }
    .zk-sluit:hover { color: #fff; }
    .zk-input {
      width: 100%; box-sizing: border-box;
      background: #161616; border: 1px solid #333; border-radius: 12px;
      color: #fff; font-size: 1.05rem; padding: 0.9rem 1.2rem;
      outline: none; transition: border-color 0.2s;
    }
    .zk-input:focus { border-color: var(--oranje, #FF6B00); }
    .zk-chips { display: flex; gap: 0.5rem; margin: 0.9rem 0 1.4rem; flex-wrap: wrap; }
    .zk-chip {
      background: #1a1a1a; border: 1px solid #333; border-radius: 100px;
      color: #999; font-size: 0.78rem; letter-spacing: 1px; text-transform: uppercase;
      padding: 0.35rem 0.9rem; cursor: pointer; transition: all 0.18s;
    }
    .zk-chip:hover { border-color: var(--oranje, #FF6B00); color: var(--oranje, #FF6B00); }
    .zk-chip.actief {
      background: var(--oranje, #FF6B00); border-color: var(--oranje, #FF6B00);
      color: #fff; font-weight: 700;
    }
    .zk-groep-titel {
      font-size: 0.72rem; letter-spacing: 2px; text-transform: uppercase;
      color: #666; margin: 1.2rem 0 0.5rem;
    }
    .zk-item {
      display: flex; align-items: center; gap: 0.8rem;
      background: #141414; border: 1px solid #262626; border-radius: 10px;
      padding: 0.7rem 1rem; margin-bottom: 0.45rem;
      color: #ddd; text-decoration: none; transition: border-color 0.18s, background 0.18s;
    }
    .zk-item:hover { border-color: var(--oranje, #FF6B00); background: #1a1a1a; }
    .zk-item-icoon { font-size: 1.1rem; flex-shrink: 0; width: 1.6rem; text-align: center; }
    .zk-item-naam { font-size: 0.92rem; font-weight: 600; }
    .zk-item-meta { font-size: 0.75rem; color: #888; margin-top: 0.15rem; }
    .zk-leeg { color: #666; font-size: 0.88rem; text-align: center; margin-top: 2rem; }
    .zk-thumb {
      width: 52px; height: 38px; border-radius: 6px; object-fit: cover;
      flex-shrink: 0; background: #222;
    }
  `;
  document.head.appendChild(style);

  // ── Zoekbalk als tweede rij in de header ─────────────────────────────────
  const header = document.querySelector('header');
  if (!header) return;

  header.style.flexWrap = 'wrap';

  const balk = document.createElement('div');
  balk.className = 'zk-balk';

  const balkInput = document.createElement('input');
  balkInput.type = 'text';
  balkInput.className = 'zk-balk-input';
  balkInput.placeholder = 'Zoeken…';
  balkInput.autocomplete = 'off';
  balkInput.spellcheck = false;

  const trigger = document.createElement('button');
  trigger.className = 'zk-trigger';
  trigger.title = 'Zoeken';
  trigger.setAttribute('aria-label', 'Zoeken');
  trigger.innerHTML = '&#128269;';

  balk.appendChild(balkInput);
  balk.appendChild(trigger);
  header.appendChild(balk);

  function updateHeaderOffset() {
    document.documentElement.style.setProperty('--zk-header-hoogte', header.offsetHeight + 'px');
  }
  updateHeaderOffset();
  window.addEventListener('resize', updateHeaderOffset);
  window.addEventListener('load', updateHeaderOffset);

  // ── Overlay ───────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'zk-overlay';
  overlay.innerHTML = `
    <button class="zk-sluit" aria-label="Sluiten">&times;</button>
    <div class="zk-box">
      <input type="text" class="zk-input" placeholder="Zoek op trefwoord, club, serie of fotograaf…" />
      <div class="zk-chips">
        <span class="zk-chip actief" data-filter="alles">Alles</span>
        <span class="zk-chip" data-filter="series">Series</span>
        <span class="zk-chip" data-filter="fotografen">Fotografen</span>
        <span class="zk-chip" data-filter="labels">Labels</span>
      </div>
      <div class="zk-resultaten"></div>
    </div>`;
  document.body.appendChild(overlay);

  const input      = overlay.querySelector('.zk-input');
  const resultaten = overlay.querySelector('.zk-resultaten');
  let filter = 'alles';

  function openZoek(startTekst) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (startTekst) {
      input.value = startTekst;
      render();
    }
    input.focus();
    laadIndex();
  }
  function sluitZoek() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    balkInput.value = '';
    balkInput.blur();
  }

  trigger.addEventListener('click', () => openZoek(balkInput.value));
  balkInput.addEventListener('focus', () => openZoek(balkInput.value));
  balkInput.addEventListener('input', () => openZoek(balkInput.value));

  overlay.querySelector('.zk-sluit').addEventListener('click', sluitZoek);
  overlay.addEventListener('click', e => { if (e.target === overlay) sluitZoek(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) sluitZoek();
  });

  // Sync typen in overlay terug naar balk
  input.addEventListener('input', () => { balkInput.value = input.value; render(); });

  overlay.querySelectorAll('.zk-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      overlay.querySelectorAll('.zk-chip').forEach(c => c.classList.remove('actief'));
      chip.classList.add('actief');
      filter = chip.dataset.filter;
      render();
    });
  });

  // ── Index opbouwen (lazy, bij eerste keer openen) ─────────────────────────
  let _index = null;
  let _laden = null;

  async function laadIndex() {
    if (_index || _laden) return _laden;
    resultaten.innerHTML = '<p class="zk-leeg">Index laden…</p>';
    _laden = (async () => {
      const [manRes, gastRes, labelRes] = await Promise.all([
        fetch('/manifest.json?v=' + Date.now()).catch(() => null),
        fetch(WORKER + '/fotograaf/manifest').catch(() => null),
        fetch(WORKER + '/labels').catch(() => null),
      ]);
      const manifest  = manRes   ? await manRes.json().catch(() => ({}))  : {};
      const gastData  = gastRes  ? await gastRes.json().catch(() => ({})) : {};
      const labelData = labelRes ? await labelRes.json().catch(() => ({})) : {};

      const series = [];
      for (const cat of ['voetbal', 'nosports']) {
        for (const item of (manifest[cat] || [])) {
          series.push({
            naam: item.naam || item.map,
            fotograaf: item.fotograaf || 'Andreas Luckfiel',
            kleur: '#FF6B00',
            labels: item.labels || [],
            cat,
            href: '/' + cat + '.html#serie=' + encodeURIComponent(item.naam || item.map),
            thumb: item.fotos?.length
              ? '/images/' + cat + '/' + encodeURIComponent(item.map) + '/' + encodeURIComponent(item.fotos[0])
              : null,
          });
        }
      }
      const fotografen = [{ id: 'andreas', naam: 'Andreas Luckfiel', kleur: '#FF6B00' }];
      for (const fg of (gastData.fotografen || [])) {
        if (fg.mappen?.length) fotografen.push({ id: fg.id, naam: fg.naam, kleur: fg.kleur || '#FF6B00' });
        for (const m of (fg.mappen || [])) {
          const cat = m.categorie || 'voetbal';
          series.push({
            naam: m.map,
            fotograaf: fg.naam,
            kleur: fg.kleur || '#FF6B00',
            labels: m.labels || [],
            cat,
            href: cat === 'eigen'
              ? '/fotograaf-pagina.html?id=' + fg.id
              : '/' + cat + '.html#serie=' + encodeURIComponent(m.map),
            thumb: null,
          });
        }
      }

      _index = { series, fotografen, labels: labelData.labels || [] };
      render();
    })();
    return _laden;
  }

  // ── Zoeken ────────────────────────────────────────────────────────────────
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function render() {
    if (!_index) return;
    const q = norm(input.value.trim());
    const html = [];

    if (!q) {
      resultaten.innerHTML = '<p class="zk-leeg">Typ om te zoeken — bijv. een clubnaam, wedstrijd of fotograaf.</p>';
      return;
    }

    if (filter === 'alles' || filter === 'fotografen') {
      const hits = _index.fotografen.filter(fg => norm(fg.naam).includes(q));
      if (hits.length) {
        html.push('<div class="zk-groep-titel">Fotografen</div>');
        for (const fg of hits) {
          html.push(`<a class="zk-item" href="/fotograaf-pagina.html?id=${fg.id}">
            <span class="zk-item-icoon" style="color:${fg.kleur}">&#9679;</span>
            <div><div class="zk-item-naam">${fg.naam}</div>
            <div class="zk-item-meta">Bekijk fotograaf-pagina</div></div></a>`);
        }
      }
    }

    if (filter === 'alles' || filter === 'series') {
      const hits = _index.series.filter(s =>
        norm(s.naam).includes(q) ||
        norm(s.fotograaf).includes(q) ||
        (s.labels || []).some(l => norm(l).includes(q))
      );
      if (hits.length) {
        html.push('<div class="zk-groep-titel">Series</div>');
        for (const s of hits.slice(0, 25)) {
          const catLabel = s.cat === 'voetbal' ? '⚽ Voetbal' : s.cat === 'nosports' ? '🌿 No Sports' : '📷 Eigen pagina';
          html.push(`<a class="zk-item" href="${s.href}">
            ${s.thumb ? `<img class="zk-thumb" src="${s.thumb}" loading="lazy" alt="" />` : `<span class="zk-item-icoon">${s.cat === 'nosports' ? '🌿' : '⚽'}</span>`}
            <div><div class="zk-item-naam">${s.naam}</div>
            <div class="zk-item-meta">${catLabel} · <span style="color:${s.kleur}">${s.fotograaf}</span>${s.labels?.length ? ' · 🏷 ' + s.labels.join(', ') : ''}</div></div></a>`);
        }
      }
    }

    if (filter === 'alles' || filter === 'labels') {
      const hits = _index.labels.filter(l => norm(l).includes(q));
      if (hits.length) {
        html.push('<div class="zk-groep-titel">Labels / Clubs</div>');
        for (const l of hits) {
          html.push(`<a class="zk-item" href="/clubs.html?club=${encodeURIComponent(l)}">
            <span class="zk-item-icoon">🏷</span>
            <div><div class="zk-item-naam">${l}</div>
            <div class="zk-item-meta">Bekijk foto's bij dit label</div></div></a>`);
        }
      }
    }

    resultaten.innerHTML = html.length ? html.join('') : '<p class="zk-leeg">Geen resultaten voor "' + input.value.trim().replace(/</g, '&lt;') + '"</p>';
  }
})();
