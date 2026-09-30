// Volgorde van de series (sliders) op voetbal/nosports/othersports.html.
// Eén rekenregel voor de site (gallery-nieuw.js), beheer.html en de tab
// "📍 Positie op pagina" in fotograaf.html — zodat ze nooit uit elkaar lopen.
//
// Afspraak 01-10-2026: "Datum is automatisch en gebruiker kan overrulen."
//  - Standaard op datum, nieuwste bovenaan, series zonder datum achteraan.
//  - Een versleepte volgorde wordt bewaard in KV `gallery:volgorde:{cat}` als
//    { versie: 2, items: [{ type, map, fgId, datum }] } — met per serie de datum
//    op het moment van plaatsen.
//  - Bij het tonen blijven bewaarde series op hun plek zolang hun datum gelijk is.
//    Nieuwe series, en series waarvan de datum sindsdien is aangepast, worden op
//    de plek van hun datum ingevoegd: vóór de eerste serie die ouder is.
//  - Oude lijsten (een kale array, van vóór de datum-sortering) tellen niet mee.
(function () {
  function sleutel(s) {
    return s.type === 'gast' ? `gast|${s.fgId}|${s.map}` : `eigen|${s.map}`;
  }

  // Nieuwste eerst, zonder datum achteraan. Array.sort is stabiel: bij gelijke
  // datum blijft de aangeleverde volgorde (eerst eigen, dan gast) staan.
  function opDatum(a, b) {
    const da = a.datum || '', db = b.datum || '';
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  }

  // Is x ouder dan s? (Een serie zonder datum telt als oudst.)
  function ouderDan(x, s) {
    if (!s.datum) return false;
    return !x.datum || x.datum < s.datum;
  }

  function geldig(bewaard) {
    return !!(bewaard && bewaard.versie === 2 && Array.isArray(bewaard.items));
  }

  // series: [{ type: 'eigen'|'gast', map, fgId?, datum, ... }]
  // bewaard: wat GET /gallery/volgorde teruggeeft (of null)
  // → dezelfde objecten, in de volgorde waarin de site ze toont.
  function bereken(series, bewaard) {
    const perSleutel = new Map(series.map(s => [sleutel(s), s]));
    const vast = [];
    const geplaatst = new Set();
    if (geldig(bewaard)) {
      for (const b of bewaard.items) {
        const k = sleutel(b);
        const s = perSleutel.get(k);
        if (!s || geplaatst.has(k)) continue;           // verdwenen of dubbel
        if ((s.datum || '') !== (b.datum || '')) continue; // datum gewijzigd
        geplaatst.add(k);
        vast.push(s);
      }
    }
    const los = series.filter(s => !geplaatst.has(sleutel(s))).sort(opDatum);
    const uit = vast.slice();
    for (const s of los) {
      let i = uit.findIndex(x => ouderDan(x, s));
      if (i < 0) i = uit.length;
      uit.splice(i, 0, s);
    }
    return uit;
  }

  // Wat er bewaard wordt na slepen: de hele lijst, met de huidige datums.
  function naarBewaard(series) {
    return {
      versie: 2,
      items: series.map(s => s.type === 'gast'
        ? { type: 'gast', map: s.map, fgId: s.fgId, datum: s.datum || '' }
        : { type: 'eigen', map: s.map, datum: s.datum || '' }),
    };
  }

  window.zlVolgorde = { sleutel, opDatum, bereken, naarBewaard, geldig };
})();
