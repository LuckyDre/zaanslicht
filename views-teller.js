// views-teller.js — telt paginaweergaven en fotoweergaven in Firebase (pad: views/)
// De tellers zijn alleen zichtbaar op de beheerpagina (tab Fotografen).
//
// Slim tellen:
// - paginaweergave: maximaal 1 per browsersessie per pagina, reloads tellen niet mee
// - fotoweergave: elke foto die groot in beeld komt; gebundeld verstuurd (elke 3 s)
//   zodat doorbladeren niet tot tientallen losse schrijfacties leidt
// - de beheerder en ingelogde fotografen op dit apparaat worden niet meegeteld,
//   zodat alleen echte kijkers in de cijfers zitten
//
// Firebase-regel die dit pad open moet zetten (Realtime Database > Rules):
//   "views": { ".read": true, ".write": true }
(() => {
  const DB = 'https://zaanslicht-0001-default-rtdb.europe-west1.firebasedatabase.app';

  // Eigen weergaven niet meetellen: beheerder of ingelogde fotograaf
  let eigenKijker = false;
  try {
    eigenKijker = !!(localStorage.getItem('zl_worker_secret') || localStorage.getItem('zl_fotograaf'));
  } catch {}

  // Niet atomair (net als fbIncrement in firebase-rest.js), maar voor deze
  // bezoekersaantallen ruim voldoende betrouwbaar.
  async function tel(pad, delta) {
    try {
      const res = await fetch(`${DB}/${pad}.json`);
      const cur = res.ok ? (await res.json()) || 0 : 0;
      await fetch(`${DB}/${pad}.json`, {
        method: 'PUT',
        body: JSON.stringify(cur + delta),
        keepalive: true,
      });
    } catch {}
  }

  // ── Paginaweergave: 1x per browsersessie per pagina ─────────────────────
  const pagina = (location.pathname.split('/').pop() || 'index.html')
    .replace(/\.html$/, '') || 'index';
  try {
    if (!eigenKijker && !sessionStorage.getItem('zl_view_' + pagina)) {
      sessionStorage.setItem('zl_view_' + pagina, '1');
      tel('views/pagina/' + pagina, 1);
    }
  } catch {}

  // ── Fotoweergaven: gebundeld per eigenaar ('eigen' of fotograaf-id) ─────
  const buffer = {};
  let flushTimer = null;

  function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    for (const eigenaar of Object.keys(buffer)) {
      const n = buffer[eigenaar];
      delete buffer[eigenaar];
      if (n > 0) tel('views/fotograaf/' + eigenaar, n);
    }
  }

  window.zlTelFotoView = function (eigenaar) {
    if (eigenKijker || !eigenaar) return;
    // Firebase-sleutels mogen geen . # $ [ ] / bevatten
    eigenaar = String(eigenaar).replace(/[.#$\[\]\/]/g, '_');
    buffer[eigenaar] = (buffer[eigenaar] || 0) + 1;
    if (!flushTimer) flushTimer = setTimeout(flush, 3000);
  };

  addEventListener('pagehide', flush);
})();
