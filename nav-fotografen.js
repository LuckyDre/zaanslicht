// nav-fotografen.js — voegt dynamisch fotograaf-links toe aan de nav en vervangt & Co.
(async function () {
  const WORKER = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';

  // ── CSS voor schuif-animatie ──────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .nav-fg-link {
      display: inline-flex; align-items: center;
      color: #aaaaaa; text-decoration: none;
      font-size: 0.9rem; letter-spacing: 1px; text-transform: uppercase;
      transition: color 0.2s;
      white-space: nowrap; overflow: hidden;
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

    // ── Desktop nav ───────────────────────────────────────────────────────
    const nav = document.querySelector('header nav');
    if (nav) {
      const vórClubs = Array.from(nav.querySelectorAll('a'))
        .find(a => a.textContent.trim() === 'Clubs');

      // Andreas altijd als eerste
      const aAndreas = maakNavLink('Andreas', 'Luckfiel', 'fotograaf-pagina.html?id=andreas', '#FF6B00', isActiefPagina('andreas'));
      if (vórClubs) nav.insertBefore(aAndreas, vórClubs);
      else nav.appendChild(aAndreas);

      // Gastfotografen
      for (const fg of actief) {
        const [voornaam, ...rest] = fg.naam.split(' ');
        const achternaam = rest.join(' ');
        const kleur = fg.kleur || '#FF6B00';
        const a = maakNavLink(voornaam, achternaam, `fotograaf-pagina.html?id=${fg.id}`, kleur, isActiefPagina(fg.id));
        a.dataset.fgId   = fg.id;
        a.dataset.fgKleur = kleur;
        if (vórClubs) nav.insertBefore(a, vórClubs);
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
