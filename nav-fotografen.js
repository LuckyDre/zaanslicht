// nav-fotografen.js — voegt dynamisch fotograaf-links toe aan de nav en vervangt & Co.
(async function () {
  const WORKER = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

  // ── CSS voor schuif-animatie + dropdown ─────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Dropdown "..." */
    .nav-meer {
      position: relative;
      display: inline-flex; align-items: center;
      margin-left: 1.5rem;
    }
    .nav-meer-trigger {
      color: #aaaaaa;
      font-size: 0.9rem;
      cursor: default;
      padding: 0 0.2rem;
      transition: color 0.2s;
      user-select: none;
      display: inline-block;
      transform: scaleX(2);
      transform-origin: center;
    }
    .nav-meer:hover .nav-meer-trigger { color: var(--oranje, #FF6B00); }
    .nav-meer-dropdown {
      position: absolute;
      top: 100%;
      right: 0.5rem;
      /* Padding-top zorgt voor visuele ruimte zonder hover-gat */
      padding-top: 10px;
      background: transparent;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s ease;
      transform: translateY(-4px);
      z-index: 600;
    }
    .nav-meer-dropdown-inner {
      background: rgba(13,13,13,0.97);
      border: 1px solid rgba(255,107,0,0.18);
      border-radius: 10px;
      padding: 0.4rem 0;
      min-width: 150px;
      backdrop-filter: blur(10px);
    }
    .nav-meer:hover .nav-meer-dropdown {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0);
    }
    .nav-meer-dropdown a {
      display: block;
      padding: 0.55rem 1.2rem;
      color: #aaaaaa !important;
      font-size: 0.82rem; letter-spacing: 1px; text-transform: uppercase;
      text-decoration: none;
      transition: color 0.18s;
      white-space: nowrap;
    }
    .nav-meer-dropdown a:hover { color: var(--oranje, #FF6B00) !important; }

    .nav-fg-link {
      display: inline-flex; align-items: center;
      color: #aaaaaa; text-decoration: none;
      font-size: 0.9rem; letter-spacing: 1px; text-transform: uppercase;
      transition: color 0.2s;
      white-space: nowrap; overflow: hidden;
      margin-left: 1.5rem;
    }
    .nav-fg-link .fg-achternaam {
      display: inline-block;
      max-width: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-width 0.35s ease, opacity 0.25s ease;
    }
    .nav-fg-link:hover .fg-achternaam,
    .nav-fg-link.active .fg-achternaam {
      max-width: 120px;
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  function maakNavLink(voornaam, achternaam, href, kleur, isActief) {
    const a = document.createElement('a');
    a.href = href;
    a.className = 'nav-fg-link';
    a.innerHTML = `${voornaam}<span class="fg-achternaam">&nbsp;${achternaam}</span>`;
    a.style.color = isActief ? kleur : '#aaaaaa';
    if (isActief) a.classList.add('active');
    a.addEventListener('mouseover', () => { a.style.color = kleur; });
    a.addEventListener('mouseout',  () => {
      a.style.color = a.classList.contains('active') ? kleur : '#aaaaaa';
    });
    return a;
  }

  function isActiefPagina(id) {
    if (!location.pathname.endsWith('fotograaf-pagina.html')) return false;
    return new URLSearchParams(location.search).get('id') === id;
  }

  try {
    const res = await fetch(WORKER + '/fotograaf/manifest');
    const { fotografen } = await res.json();

    const actief = (fotografen || []).filter(fg => fg.mappen?.length > 0);

    // ── Namen string bouwen en "& Co." overal vervangen ──────────────────
    const namenStr = actief.length
      ? 'Andreas Luckfiel & ' + actief.map(fg => fg.naam).join(' & ')
      : 'Andreas Luckfiel';
    function vervangTekst(rootEl) {
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        if (node.nodeValue.includes('Andreas Luckfiel')) {
          node.nodeValue = node.nodeValue.replace(/Andreas Luckfiel & Co\./g, namenStr + '.');
        }
      });
    }
    vervangTekst(document.body);

    // ── Clubs / Over ons / Contact groeperen in "..." dropdown ───────────
    const nav = document.querySelector('header nav');
    if (nav) {
      const groepeernamen = ['Tools', 'Clubs', 'Over ons', 'Contact'];
      const teGroeperen = Array.from(nav.querySelectorAll('a')).filter(a =>
        groepeernamen.includes(a.textContent.trim())
      );
      let dropdown_wrapper = null;
      if (teGroeperen.length) {
        dropdown_wrapper = document.createElement('div');
        dropdown_wrapper.className = 'nav-meer';
        dropdown_wrapper.innerHTML = `<span class="nav-meer-trigger">&#9776;</span><div class="nav-meer-dropdown"><div class="nav-meer-dropdown-inner"></div></div>`;
        const dropdown = dropdown_wrapper.querySelector('.nav-meer-dropdown-inner');
        teGroeperen[0].parentNode.insertBefore(dropdown_wrapper, teGroeperen[0]);
        teGroeperen.forEach(a => dropdown.appendChild(a));
      }

      // Fotografen-links invoegen vóór de "..." wrapper
      const invoegpunt = dropdown_wrapper;

      // Andreas altijd als eerste (vóór de "..." wrapper)
      const aAndreas = maakNavLink('Andreas', 'Luckfiel', 'fotograaf-pagina.html?id=andreas', '#FF6B00', isActiefPagina('andreas'));
      if (invoegpunt) nav.insertBefore(aAndreas, invoegpunt);
      else nav.appendChild(aAndreas);

      // Gastfotografen (ook vóór de "..." wrapper)
      for (const fg of actief) {
        const [voornaam, ...rest] = fg.naam.split(' ');
        const achternaam = rest.join(' ');
        const kleur = fg.kleur || '#FF6B00';
        const a = maakNavLink(voornaam, achternaam, `fotograaf-pagina.html?id=${fg.id}`, kleur, isActiefPagina(fg.id));
        a.dataset.fgId    = fg.id;
        a.dataset.fgKleur = kleur;
        if (invoegpunt) nav.insertBefore(a, invoegpunt);
        else nav.appendChild(a);
      }
    }

    // ── Mobiel nav ────────────────────────────────────────────────────────
    const mobileNav = document.getElementById('nav-mobile');
    if (mobileNav) {
      const target = mobileNav.querySelector('.mobile-links') || mobileNav;
      const mobileContact = Array.from(target.querySelectorAll('a'))
        .find(a => a.textContent.trim() === 'Contact');

      const mAndreas = document.createElement('a');
      mAndreas.href = 'fotograaf-pagina.html?id=andreas';
      mAndreas.textContent = 'Andreas Luckfiel';
      mAndreas.style.color = '#FF6B00';
      if (mobileContact) target.insertBefore(mAndreas, mobileContact);
      else target.appendChild(mAndreas);

      for (const fg of actief) {
        const a = document.createElement('a');
        a.href = `fotograaf-pagina.html?id=${fg.id}`;
        a.textContent = fg.naam;
        a.style.color = fg.kleur || '#FF6B00';
        if (mobileContact) target.insertBefore(a, mobileContact);
        else target.appendChild(a);
      }
    }
  } catch (e) {
    // Stille fout — nav werkt zonder fotografen-links
  }
})();
