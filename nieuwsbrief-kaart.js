// Flits-kaartje: piept rechtsonder binnen met een korte cameraflits en nodigt uit
// voor de nieuwsbrief. Verschijnt hooguit 1× per sessie, en na sluiten/aanmelden
// 60 dagen niet meer. Meldt aan via het bestaande /subscribe-endpoint.
(function () {
  const WORKER = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';
  const DISMISS_KEY = 'zl_nb_dismiss';
  const DISMISS_DAGEN = 60;

  try {
    const d = localStorage.getItem(DISMISS_KEY);
    if (d && Date.now() - Number(d) < DISMISS_DAGEN * 864e5) return;
    if (sessionStorage.getItem('zl_nb_shown')) return;
  } catch {}

  const css = `
  #zl-nb{position:fixed;right:18px;bottom:18px;z-index:1500;width:290px;max-width:calc(100vw - 36px);
    background:#141414;border:1px solid #2a2a2a;border-top:2px solid #8B5CF6;border-radius:14px;
    padding:1rem 1.1rem 1.05rem;box-shadow:0 12px 40px rgba(0,0,0,.5);color:#f4f4f4;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5;
    transform:translateY(140%);opacity:0;transition:transform .5s cubic-bezier(.2,.8,.2,1),opacity .5s}
  #zl-nb.zl-in{transform:translateY(0);opacity:1}
  #zl-nb .zl-nb-x{position:absolute;top:.5rem;right:.65rem;background:none;border:none;color:#6d6d6d;
    font-size:.95rem;cursor:pointer;padding:2px 5px;line-height:1;border-radius:5px}
  #zl-nb .zl-nb-x:hover{color:#f4f4f4;background:#222}
  #zl-nb .zl-nb-cam{width:38px;height:38px;border-radius:9px;background:#0d0d0d;border:1px solid #333;
    display:flex;align-items:center;justify-content:center;font-size:1.15rem;position:relative;overflow:hidden}
  #zl-nb .zl-nb-cam::after{content:"";position:absolute;inset:0;background:#fff;opacity:0}
  #zl-nb.zl-in .zl-nb-cam::after{animation:zlflash .7s ease-out .35s 1}
  @keyframes zlflash{0%{opacity:0}18%{opacity:.9}55%{opacity:0}100%{opacity:0}}
  #zl-nb .zl-nb-h{font-weight:700;font-size:.98rem;margin:.6rem 0 .15rem;letter-spacing:-.2px}
  #zl-nb .zl-nb-count{font-size:.79rem;color:#9a9a9a;margin-bottom:.7rem}
  #zl-nb .zl-nb-count b{color:#A78BFA;font-weight:600}
  #zl-nb input[type=email]{width:100%;background:#0a0a0a;border:1px solid #333;border-radius:8px;
    color:#fff;padding:.55rem .7rem;font-size:.85rem;outline:none;box-sizing:border-box}
  #zl-nb input[type=email]:focus{border-color:#8B5CF6}
  #zl-nb .zl-nb-ok{display:flex;gap:.45rem;align-items:flex-start;margin:.55rem 0;font-size:.68rem;color:#8a8a8a;line-height:1.35}
  #zl-nb .zl-nb-ok input{margin-top:2px;accent-color:#8B5CF6;flex-shrink:0}
  #zl-nb .zl-nb-btn{width:100%;background:#8B5CF6;border:none;color:#fff;font-weight:700;font-size:.85rem;
    padding:.6rem;border-radius:8px;cursor:pointer;transition:.15s;font-family:inherit}
  #zl-nb .zl-nb-btn:hover{background:#A78BFA}
  #zl-nb .zl-nb-btn:disabled{opacity:.6;cursor:default}
  #zl-nb .zl-nb-fb{font-size:.76rem;margin-top:.5rem;min-height:1em}
  @media (prefers-reduced-motion:reduce){#zl-nb{transition:opacity .3s}#zl-nb.zl-in{transform:translateY(0)}
    #zl-nb.zl-in .zl-nb-cam::after{animation:none}}
  @media (max-width:520px){#zl-nb{left:14px;right:14px;width:auto}}
  `;

  const el = document.createElement('div');
  el.id = 'zl-nb';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Aanmelden voor de nieuwsbrief');
  el.innerHTML = `
    <button class="zl-nb-x" aria-label="Sluiten">✕</button>
    <div class="zl-nb-cam" aria-hidden="true">📷</div>
    <div class="zl-nb-h">Als eerste de mooiste plaatjes?</div>
    <div class="zl-nb-count" id="zl-nb-count">Krijg elke nieuwe serie meteen in je mail.</div>
    <form id="zl-nb-form" novalidate>
      <input type="email" required placeholder="jouw@emailadres.nl" aria-label="E-mailadres" autocomplete="email" />
      <label class="zl-nb-ok"><input type="checkbox" required aria-label="Akkoord" /><span>Ja, bewaar mijn e-mail voor foto-updates. Uitschrijven kan altijd.</span></label>
      <button type="submit" class="zl-nb-btn">Ja, hou me op de hoogte</button>
      <div class="zl-nb-fb" id="zl-nb-fb" role="status"></div>
    </form>`;

  function init() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    document.body.appendChild(el);

    const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} verberg(); };
    const verberg = () => { el.classList.remove('zl-in'); setTimeout(() => el.remove(), 500); };

    el.querySelector('.zl-nb-x').addEventListener('click', dismiss);

    // Teller: alleen een echt getal tonen als het genoeg is om te imponeren (>=50),
    // afgerond naar beneden op 25. Daaronder blijft de zachte tekst staan (geen verzonnen getal).
    fetch(WORKER + '/aantal').then(r => r.json()).then(d => {
      const n = Number(d.count) || 0;
      if (n >= 50) {
        const afg = Math.floor(n / 25) * 25;
        document.getElementById('zl-nb-count').innerHTML = `Al <b>${afg}+ fans</b> krijgen de foto's als eerste.`;
      }
    }).catch(() => {});

    const form = el.querySelector('#zl-nb-form');
    const fb = el.querySelector('#zl-nb-fb');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type=email]').value.trim();
      const ok = form.querySelector('input[type=checkbox]').checked;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fb.style.color = '#f0997b'; fb.textContent = 'Vul een geldig e-mailadres in.'; return; }
      if (!ok) { fb.style.color = '#f0997b'; fb.textContent = 'Zet even het vinkje aan.'; return; }
      const btn = form.querySelector('.zl-nb-btn');
      btn.disabled = true; btn.textContent = 'Bezig…';
      try {
        const res = await fetch(WORKER + '/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.ok) {
          fb.style.color = '#5dcaa5';
          fb.textContent = data.message === 'Al aangemeld' ? 'Je stond al op de lijst — top!' : 'Gelukt! Je staat op de lijst.';
          try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
          setTimeout(verberg, 2600);
        } else {
          fb.style.color = '#f0997b'; fb.textContent = data.error || 'Er ging iets mis, probeer later opnieuw.';
          btn.disabled = false; btn.textContent = 'Ja, hou me op de hoogte';
        }
      } catch {
        fb.style.color = '#f0997b'; fb.textContent = 'Geen verbinding — probeer het later nog eens.';
        btn.disabled = false; btn.textContent = 'Ja, hou me op de hoogte';
      }
    });

    // Verschijnen: na 7s óf zodra >40% gescrold — wat het eerst komt, hooguit 1× per sessie.
    let getoond = false;
    const toon = () => {
      if (getoond) return; getoond = true;
      try { sessionStorage.setItem('zl_nb_shown', '1'); } catch {}
      requestAnimationFrame(() => el.classList.add('zl-in'));
      window.removeEventListener('scroll', onScroll);
    };
    const onScroll = () => {
      const h = document.documentElement;
      const pct = (h.scrollTop) / Math.max(1, h.scrollHeight - h.clientHeight);
      if (pct > 0.4) toon();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(toon, 7000);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
