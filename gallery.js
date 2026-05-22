// gallery.js — dynamische slider pagina voor voetbal.html en nosports.html
// Gebruik: <script src="gallery.js" data-category="voetbal"></script>

const CATEGORY = document.currentScript.getAttribute('data-category');

async function loadGallery() {
  const container = document.getElementById('gallery-container');

  try {
    const res = await fetch('manifest.json?v=' + Date.now());
    const manifest = await res.json();
    const items = manifest[CATEGORY] || [];

    if (items.length === 0) {
      container.innerHTML = '<p class="no-content">Nog geen foto\'s toegevoegd — kom snel terug!</p>';
      return;
    }

    container.innerHTML = '';

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'portfolio-category';
      div.id = 'cat-' + item.id;

      const slides = item.fotos.map(f =>
        `<div class="swiper-slide"><img src="images/${CATEGORY}/${encodeURIComponent(item.map)}/${encodeURIComponent(f)}" alt="${item.naam}" loading="lazy" /></div>`
      ).join('');

      div.innerHTML = `
        <h3>${item.naam}</h3>
        <div class="swiper portfolio-swiper">
          <div class="swiper-wrapper">${slides}</div>
          <div class="swiper-button-prev"></div>
          <div class="swiper-button-next"></div>
        </div>`;

      container.appendChild(div);
    });

    // Initialiseer alle Swipers
    document.querySelectorAll('.portfolio-swiper').forEach(el => {
      new Swiper(el, {
        loop: false,
        slidesPerView: 'auto',
        spaceBetween: 16,
        grabCursor: true,
        navigation: {
          nextEl: el.querySelector('.swiper-button-next'),
          prevEl: el.querySelector('.swiper-button-prev'),
        },
      });
    });

    initLightbox();

  } catch (e) {
    container.innerHTML = '<p class="no-content">Kon foto\'s niet laden.</p>';
    console.error(e);
  }
}

function initLightbox() {
  const lightbox    = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  let allImages = [], currentIdx = 0;

  document.addEventListener('click', e => {
    const img = e.target.closest('.portfolio-swiper img');
    if (!img) return;
    const slider = img.closest('.portfolio-swiper');
    allImages = Array.from(slider.querySelectorAll('img'));
    currentIdx = allImages.indexOf(img);
    lightboxImg.src = img.src;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  lightbox.addEventListener('click', e => {
    if (e.target !== lightboxImg) closeLightbox();
  });
  document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

  document.getElementById('lb-prev').addEventListener('click', e => {
    e.stopPropagation();
    if (currentIdx > 0) { currentIdx--; lightboxImg.src = allImages[currentIdx].src; }
  });
  document.getElementById('lb-next').addEventListener('click', e => {
    e.stopPropagation();
    if (currentIdx < allImages.length - 1) { currentIdx++; lightboxImg.src = allImages[currentIdx].src; }
  });

  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft'  && currentIdx > 0) { currentIdx--; lightboxImg.src = allImages[currentIdx].src; }
    if (e.key === 'ArrowRight' && currentIdx < allImages.length - 1) { currentIdx++; lightboxImg.src = allImages[currentIdx].src; }
  });

  function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

loadGallery();
