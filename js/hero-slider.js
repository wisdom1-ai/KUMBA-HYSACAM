(() => {
  'use strict';
  const hero = document.querySelector('.hero-slider');
  if (!hero) return;

  const slides = Array.from(hero.querySelectorAll('.hero-slide'));
  const eyebrow = document.getElementById('hero-eyebrow');
  const title = document.getElementById('hero-title');
  const description = document.getElementById('hero-description');
  if (slides.length < 2) return;

  const copy = [
    {
      eyebrow: 'A CLEANER KUMBA STARTS WITH US',
      title: 'Cleaner streets.<br><em>Healthier communities.</em>',
      description: "Discover HYSACAM's work across waste collection, environmental services and a cleaner Kumba"
    },
    {
      eyebrow: 'RESPONSIBLE WASTE MANAGEMENT',
      title: 'Better waste solutions.<br><em>A better tomorrow.</em>',
      description: 'Modern environmental facilities and responsible waste treatment help protect the places we call home'
    },
    {
      eyebrow: 'RELIABLE COLLECTION SERVICES',
      title: 'Working every day<br><em>for a cleaner city.</em>',
      description: 'Dedicated teams and collection vehicles help keep neighbourhoods cleaner, safer and more welcoming'
    },
    {
      eyebrow: 'RECYCLE MORE. WASTE LESS.',
      title: 'Give waste a purpose.<br><em>Build a greener future.</em>',
      description: 'Recycling helps recover valuable materials, reduce waste and create a more sustainable environment'
    },
    {
      eyebrow: 'CLEAN STREETS, SHARED PRIDE',
      title: 'A cleaner Kumba<br><em>begins with all of us.</em>',
      description: 'From street cleaning to everyday care, a healthy environment is a shared responsibility'
    }
  ];

  let current = 0;
  let timer;
  let savedMotion = false; try { savedMotion = !!JSON.parse(localStorage.getItem('hysacam-device-preferences-v1') || '{}').reduceMotion; } catch {}
  const reducedMotion = savedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const noStops = text => String(text).replace(/\.(?=\s|$|<)/g, "");

  function showSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      const image = slide.querySelector('img');
      if (active && image && image.loading === 'lazy') image.loading = 'eager';
    });
    const item = copy[current] || copy[0];
    if (eyebrow) eyebrow.textContent = noStops(item.eyebrow);
    if (title) title.innerHTML = noStops(item.title);
    if (description) description.textContent = noStops(item.description);
  }

  showSlide(0);

  // The hero advances automatically. There are deliberately no arrows,
  // dots, keyboard controls, click handlers, or touch/swipe navigation.
  if (!reducedMotion) {
    timer = window.setInterval(() => {
      if (!document.hidden) showSlide(current + 1);
    }, 7000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer) {
      window.clearInterval(timer);
      timer = null;
    } else if (!document.hidden && !reducedMotion && !timer) {
      timer = window.setInterval(() => showSlide(current + 1), 7000);
    }
  });
})();