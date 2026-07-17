// Toont de Other Sports-ingangen (navlinks + homepage-tegel) pas zodra er inhoud is:
// een gastserie met opOthersports===true, óf een eigen serie in manifest.othersports.
// Zo blijft de pagina "offline" tot iemand er daadwerkelijk een serie op zet.
// Elementen die gegate worden krijgen class="othersports-link" en style="display:none".
(function () {
  const WORKER = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

  async function heeftInhoud() {
    try {
      const [man, gast] = await Promise.all([
        fetch('manifest.json?v=' + Date.now()).then(r => r.json()).catch(() => ({})),
        fetch(WORKER + '/fotograaf/manifest').then(r => r.json()).catch(() => ({})),
      ]);
      if ((man.othersports || []).length) return true;
      for (const fg of (gast.fotografen || []))
        for (const m of (fg.mappen || []))
          if (m.opOthersports === true) return true;
      return false;
    } catch { return false; }
  }

  function toon() {
    document.querySelectorAll('.othersports-link').forEach(el => { el.style.display = ''; });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // Op de Other Sports-pagina zelf altijd tonen — je bent er immers al.
    if (location.pathname.endsWith('othersports.html')) { toon(); return; }
    if (await heeftInhoud()) toon();
  });
})();
