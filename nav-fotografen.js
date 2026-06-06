// nav-fotografen.js — voegt dynamisch fotograaf-links toe aan de nav en vervangt & Co.
(async function () {
  const WORKER = 'https://zaanslicht-updates.ntxzjzzg8m.workers.dev';
  try {
    const res = await fetch(WORKER + '/fotograaf/manifest');
    const { fotografen } = await res.json();

    // Alleen fotografen met minstens één map tonen
    const actief = (fotografen || []).filter(fg => fg.mappen?.length > 0);

    // ── Namen string bouwen en "& Co." overal vervangen ──────────────────────
    const namenStr = actief.length
      ? 'Andreas Luckfiel & ' + actief.map(fg => fg.naam).join(' & ')
      : 'Andreas Luckfiel';

    // Vervang alle tekstknopen die "Andreas Luckfiel" bevatten
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

    if (!actief.length) return;

    // Desktop nav: voeg links in vóór Contact
    const nav = document.querySelector('header nav');
    if (nav) {
      const contactLink = Array.from(nav.querySelectorAll('a'))
        .find(a => a.textContent.trim() === 'Clubs');
      for (const fg of actief) {
        const a = document.createElement('a');
        a.href = `fotograaf-pagina.html?id=${fg.id}`;
        a.textContent = fg.naam;
        a.style.color = '#aaaaaa';
        a.dataset.fgId = fg.id;
        a.dataset.fgKleur = fg.kleur || '#FF6B00';
        a.addEventListener('mouseover', () => { a.style.color = fg.kleur || '#FF6B00'; });
        a.addEventListener('mouseout',  () => {
          a.style.color = a.classList.contains('active') ? (fg.kleur || '#FF6B00') : '#aaaaaa';
        });
        // Markeer als actief als we op hun pagina zijn
        if (location.pathname.endsWith('fotograaf-pagina.html')) {
          const params = new URLSearchParams(location.search);
          if (params.get('id') === fg.id) {
            a.style.color = fg.kleur || '#FF6B00';
            a.classList.add('active');
          }
        }
        if (contactLink) nav.insertBefore(a, contactLink);
        else nav.appendChild(a);
      }
    }

    // Mobiel nav: zelfde links toevoegen
    const mobileNav = document.getElementById('nav-mobile');
    if (mobileNav) {
      const mobileLinks = mobileNav.querySelector('.mobile-links');
      const target = mobileLinks || mobileNav;
      const mobileContact = Array.from(target.querySelectorAll('a'))
        .find(a => a.textContent.trim() === 'Contact');
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
