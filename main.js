// Hero slider
new Swiper('.hero-swiper', {
  loop: true,
  effect: 'fade',
  fadeEffect: { crossFade: true },
  speed: 1000,
  autoplay: { delay: 5000, disableOnInteraction: false },
  pagination: { el: '.hero-swiper .swiper-pagination', clickable: true },
  navigation: {
    nextEl: '.hero-swiper .swiper-button-next',
    prevEl: '.hero-swiper .swiper-button-prev',
  },
});

// Portfolio sliders
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

// Lightbox - zo simpel mogelijk
const lightbox    = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
let allImages = [];
let currentIdx = 0;

// Klik op elke foto in portfolio
document.addEventListener('click', function(e) {
  const img = e.target.closest('.portfolio-swiper img');
  if (!img) return;

  // Verzamel alle foto's in deze slider
  const slider = img.closest('.portfolio-swiper');
  allImages = Array.from(slider.querySelectorAll('img'));
  currentIdx = allImages.indexOf(img);

  lightboxImg.src = img.src;
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
});

// Sluit lightbox
lightbox.addEventListener('click', function(e) {
  if (e.target !== lightboxImg) {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }
});

document.querySelector('.lightbox-close').addEventListener('click', function() {
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
});

// Pijltjes navigatie
document.getElementById('lb-prev').addEventListener('click', function(e) {
  e.stopPropagation();
  if (currentIdx > 0) {
    currentIdx--;
    lightboxImg.src = allImages[currentIdx].src;
  }
});

document.getElementById('lb-next').addEventListener('click', function(e) {
  e.stopPropagation();
  if (currentIdx < allImages.length - 1) {
    currentIdx++;
    lightboxImg.src = allImages[currentIdx].src;
  }
});

document.addEventListener('keydown', function(e) {
  if (lightbox.classList.contains('hidden')) return;
  if (e.key === 'Escape') { lightbox.classList.add('hidden'); document.body.style.overflow = ''; }
  if (e.key === 'ArrowLeft'  && currentIdx > 0) { currentIdx--; lightboxImg.src = allImages[currentIdx].src; }
  if (e.key === 'ArrowRight' && currentIdx < allImages.length - 1) { currentIdx++; lightboxImg.src = allImages[currentIdx].src; }
});

// Contactformulier
document.getElementById('contact-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const feedback = document.getElementById('form-feedback');
  const btn = form.querySelector('button[type="submit"]');

  btn.disabled = true;

  try {
    const res = await fetch('https://formspree.io/f/xqenvjyo', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form)
    });

    if (res.ok) {
      form.reset();
      feedback.textContent = 'Bedankt, je bericht is verzonden.';
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 4000);
    } else {
      feedback.textContent = 'Er ging iets mis. Probeer het later opnieuw.';
      feedback.classList.remove('hidden');
    }
  } catch {
    feedback.textContent = 'Er ging iets mis. Controleer je internetverbinding.';
    feedback.classList.remove('hidden');
  }

  btn.disabled = false;
});

// Header
window.addEventListener('scroll', () => {
  document.querySelector('header').style.background = window.scrollY > 80
    ? 'rgba(13,13,13,0.97)'
    : 'rgba(13,13,13,0.85)';
});
