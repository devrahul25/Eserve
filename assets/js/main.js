/* =========================================================
   ESERVE INFOTECH — Main JS
   Lightweight, dependency-free interactions.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Theme toggle (persists in memory only) ---------- */
  const root = document.documentElement;
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
    });
  }

  /* ---------- Navbar shadow on scroll ---------- */
  const navbar = document.querySelector('.navbar');
  const onScroll = () => {
    if (!navbar) return;
    if (window.scrollY > 16) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // close menu when a link is clicked
    navLinks.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.tagName === 'A' && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Reveal on scroll (IntersectionObserver) ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ---------- Hero stat counter ---------- */
  const counters = document.querySelectorAll('[data-count]');
  const animate = (el) => {
    const target = parseFloat(el.getAttribute('data-count')) || 0;
    const decimals = (el.getAttribute('data-count').split('.')[1] || '').length;
    const suffix = el.getAttribute('data-suffix') || '';
    const dur = 1400;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = (target * eased).toFixed(decimals);
      el.textContent = v + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(decimals) + suffix;
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window && counters.length) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          co.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => co.observe(el));
  }

  /* ---------- Portfolio filters ---------- */
  const filterBtns = document.querySelectorAll('[data-filter]');
  const projects = document.querySelectorAll('[data-cat]');
  if (filterBtns.length && projects.length) {
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.getAttribute('data-filter');
        projects.forEach((p) => {
          const match = cat === 'all' || p.getAttribute('data-cat').includes(cat);
          p.style.display = match ? '' : 'none';
          if (match) {
            p.classList.remove('in');
            requestAnimationFrame(() => p.classList.add('in'));
          }
        });
      });
    });
  }

  /* ---------- Contact form (client-side validation) ---------- */
  const form = document.querySelector('#contactForm');
  if (form) {
    const success = form.querySelector('.form-success');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;
      form.querySelectorAll('.field').forEach((f) => {
        const input = f.querySelector('input, textarea, select');
        const err = f.querySelector('.err');
        if (!input) return;
        let msg = '';
        if (input.required && !input.value.trim()) msg = 'This field is required';
        else if (input.type === 'email' && input.value && !/^\S+@\S+\.\S+$/.test(input.value)) msg = 'Enter a valid email';
        if (err) err.textContent = msg;
        if (msg) valid = false;
      });
      if (valid) {
        if (success) {
          success.classList.add('show');
          form.reset();
          setTimeout(() => success.classList.remove('show'), 5000);
        }
      }
    });
    // clear error on input
    form.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', () => {
        const err = el.closest('.field').querySelector('.err');
        if (err) err.textContent = '';
      });
    });
  }

  /* ---------- Year in footer ---------- */
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- Scroll progress bar ---------- */
  const sp = document.querySelector('.scroll-progress');
  if (sp) {
    const tick = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      sp.style.width = pct + '%';
    };
    window.addEventListener('scroll', tick, { passive: true });
    tick();
  }

  /* ---------- Cursor-tracked spotlight on cards ---------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    document.querySelectorAll('.spotlight').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  /* ---------- Tilt cards (3D mouse follow) ---------- */
  if (!reduceMotion) {
    document.querySelectorAll('.tilt').forEach((el) => {
      let raf = null;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--ry', (x * 8) + 'deg');
          el.style.setProperty('--rx', (-y * 8) + 'deg');
        });
      });
      el.addEventListener('mouseleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- Magnetic primary CTA ---------- */
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.btn-primary').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* ---------- Hero mockup parallax on cursor ---------- */
  const mockup = document.querySelector('.hero-mockup');
  if (mockup && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    const floats = mockup.querySelectorAll('.floating');
    mockup.addEventListener('mousemove', (e) => {
      const r = mockup.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      floats.forEach((el, i) => {
        const depth = parseFloat(el.dataset.depth || (i + 1) * 8);
        el.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
      });
    });
    mockup.addEventListener('mouseleave', () => {
      floats.forEach((el) => { el.style.transform = ''; });
    });
  }
})();
