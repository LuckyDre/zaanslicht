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
      margin-left: 1.4rem;
    }
    .nav-meer-trigger {
      color: #aaaaaa;
      font-size: 0.78rem;
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

    /* Bewust GEEN eigen font-size / letter-spacing / margin-left hier: dit is
       een <a> binnen de nav, dus de 'nav a'-regel van de pagina bepaalt het
       uiterlijk. Zo zien Andreas en de gastfotografen er op élke pagina
       hetzelfde uit als Home/Voetbal/No Sports. Zette dit blok wél eigen maten,
       dan wonnen die (class > element-selector) en werden de fotograaf-links
       zichtbaar groter dan de rest. */
    .nav-fg-link {
      display: inline-flex; align-items: center;
      text-decoration: none;
      transition: color 0.2s;
      overflow: hidden;
    }
    .nav-fg-link .fg-achternaam {
      display: inline-block;
      max-width: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-width 0.35s ease, opacity 0.25s ease;
    }
    /* Uitklappen via een class i.p.v. :hover. Tijdens het uitklappen verschuift
       de nav, en dan herbeoordeelt de browser :hover niet betrouwbaar — de
       vorige naam bleef daardoor openstaan als je doorging naar de volgende. */
    .nav-fg-link.uitgeklapt .fg-achternaam,
    .nav-fg-link.active .fg-achternaam {
      max-width: 120px;
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // Er mag er maar één tegelijk uitgeklapt zijn. Ga je van Andreas naar Jan,
  // dan klapt Andreas dus gegarandeerd weer dicht.
  function klapAlleenDezeUit(actieveLink) {
    document.querySelectorAll('.nav-fg-link.uitgeklapt').forEach(el => {
      if (el !== actieveLink) el.classList.remove('uitgeklapt');
    });
    if (actieveLink) actieveLink.classList.add('uitgeklapt');
  }

  function maakNavLink(voornaam, achternaam, href, kleur, isActief) {
    const a = document.createElement('a');
    a.href = href;
    a.className = 'nav-fg-link';
    a.innerHTML = `${voornaam}<span class="fg-achternaam">&nbsp;${achternaam}</span>`;
    a.style.color = isActief ? kleur : '#aaaaaa';
    if (isActief) a.classList.add('active');
    // mouseenter/mouseleave i.p.v. mouseover/mouseout: die laatste bubbelen en
    // vuren ook bij het betreden van de <span> met de achternaam.
    a.addEventListener('mouseenter', () => {
      klapAlleenDezeUit(a);
      a.style.color = kleur;
    });
    a.addEventListener('mouseleave', () => {
      a.classList.remove('uitgeklapt');
      a.style.color = a.classList.contains('active') ? kleur : '#aaaaaa';
    });
    return a;
  }

  function isActiefPagina(id) {
    if (!location.pathname.endsWith('fotograaf-pagina.html')) return false;
    return new URLSearchParams(location.search).get('id') === id;
  }

  // ── SYNCHROON: "..." groeperen + Andreas invoegen ────────────────────────
  // Dit gebeurt meteen bij laden, zonder op de fetch hieronder te wachten.
  // Voorheen gebeurde de hele herindeling (Tools/Clubs/Over ons/Contact
  // verdwijnen in "...", Andreas + gastfotografen verschijnen) pas ná de
  // async fetch — op een trage verbinding zag je dus eerst het onbewerkte
  // menu, waarna het in één klap "flipte" naar de definitieve vorm. Precies
  // op het moment dat je naar een naam (bijv. Jan) klikte, kon het menu
  // onder je cursor vandaan springen. Andreas' link heeft geen fetch nodig
  // (staat vast), dus die en de groepering gebeuren nu synchroon; alleen
  // gastfotografen (die wél uit de Worker komen) worden later toegevoegd —
  // dat is een kleine aanvulling, geen herindeling van het hele menu.
  const nav = document.querySelector('header nav');
  let dropdown_wrapper = null;
  if (nav) {
    // Vangnet: verlaat de muis het menu in één beweging, dan klapt alles dicht.
    nav.addEventListener('mouseleave', () => klapAlleenDezeUit(null));

    const groepeernamen = ['Tools', 'Clubs', 'Over ons', 'Contact'];
    const teGroeperen = Array.from(nav.querySelectorAll('a')).filter(a =>
      groepeernamen.includes(a.textContent.trim())
    );
    if (teGroeperen.length) {
      dropdown_wrapper = document.createElement('div');
      dropdown_wrapper.className = 'nav-meer';
      dropdown_wrapper.innerHTML = `<span class="nav-meer-trigger">&#9776;</span><div class="nav-meer-dropdown"><div class="nav-meer-dropdown-inner"></div></div>`;
      const dropdown = dropdown_wrapper.querySelector('.nav-meer-dropdown-inner');
      teGroeperen[0].parentNode.insertBefore(dropdown_wrapper, teGroeperen[0]);
      teGroeperen.forEach(a => dropdown.appendChild(a));
    }

    const aAndreas = maakNavLink('Andreas', 'Luckfiel', 'fotograaf-pagina.html?id=andreas', '#FF6B00', isActiefPagina('andreas'));
    if (dropdown_wrapper) nav.insertBefore(aAndreas, dropdown_wrapper);
    else nav.appendChild(aAndreas);
  }

  const mobileNav = document.getElementById('nav-mobile');
  let mobileTarget = null, mobileContact = null;
  if (mobileNav) {
    mobileTarget = mobileNav.querySelector('.mobile-links') || mobileNav;
    mobileContact = Array.from(mobileTarget.querySelectorAll('a'))
      .find(a => a.textContent.trim() === 'Contact');

    const mAndreas = document.createElement('a');
    mAndreas.href = 'fotograaf-pagina.html?id=andreas';
    mAndreas.textContent = 'Andreas Luckfiel';
    mAndreas.style.color = '#FF6B00';
    if (mobileContact) mobileTarget.insertBefore(mAndreas, mobileContact);
    else mobileTarget.appendChild(mAndreas);
  }

  // ── ASYNC: alleen gastfotografen + "& Co."-tekstvervanging ───────────────
  try {
    const res = await fetch(WORKER + '/fotograaf/manifest');
    const { fotografen } = await res.json();

    const actief = (fotografen || []).filter(fg => fg.mappen?.length > 0);

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

    if (nav) {
      for (const fg of actief) {
        const [voornaam, ...rest] = fg.naam.split(' ');
        const achternaam = rest.join(' ');
        const kleur = fg.kleur || '#FF6B00';
        const a = maakNavLink(voornaam, achternaam, `fotograaf-pagina.html?id=${fg.id}`, kleur, isActiefPagina(fg.id));
        a.dataset.fgId    = fg.id;
        a.dataset.fgKleur = kleur;
        if (dropdown_wrapper) nav.insertBefore(a, dropdown_wrapper);
        else nav.appendChild(a);
      }
    }

    if (mobileTarget) {
      for (const fg of actief) {
        const a = document.createElement('a');
        a.href = `fotograaf-pagina.html?id=${fg.id}`;
        a.textContent = fg.naam;
        a.style.color = fg.kleur || '#FF6B00';
        if (mobileContact) mobileTarget.insertBefore(a, mobileContact);
        else mobileTarget.appendChild(a);
      }
    }
  } catch (e) {
    // Stille fout — nav werkt met Andreas' link, alleen gastfotografen ontbreken
  }
})();

// Correcte anchor-scroll voor fixed header (scroll-padding-top werkt niet in alle browsers)
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    if (href === '#') return;
    var el = document.querySelector(href);
    if (!el) return;
    e.preventDefault();
    var header = document.querySelector('header');
    var offset = header ? header.getBoundingClientRect().height : 0;
    var top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    history.pushState(null, '', href);
  });
})();
