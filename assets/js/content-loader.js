/* =========================================================
   ESERVE INFOTECH — Content Loader
   Reads content.json (or localStorage override from /admin)
   and populates [data-edit="page.key"] elements.
   Falls back silently if anything fails — original HTML stays visible.
   ========================================================= */

(function () {
  'use strict';

  // Walk up to find content.json regardless of subdirectory depth
  // index.html → "./content.json"
  // services/x.html → "../content.json"
  function findContentUrl() {
    const path = window.location.pathname;
    // count how many path segments are below the site root
    // we use a heuristic: if path includes "/services/" or "/admin/", use ../
    if (path.includes('/services/') || path.includes('/admin/')) return '../content.json';
    return 'content.json';
  }

  function applyContent(data) {
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      const key = el.getAttribute('data-edit');
      const parts = key.split('.');
      let val = data;
      for (let i = 0; i < parts.length; i++) {
        if (val == null) return;
        val = val[parts[i]];
      }
      if (val == null) return;
      // For inputs/selects, set value; for everything else, set text/HTML
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = val;
      } else if (el.hasAttribute('data-edit-html')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    // Update href/src attributes that mirror content (mailto, tel)
    document.querySelectorAll('[data-edit-href]').forEach(function (el) {
      const key = el.getAttribute('data-edit-href');
      const prefix = el.getAttribute('data-edit-prefix') || '';
      const parts = key.split('.');
      let val = data;
      for (let i = 0; i < parts.length; i++) {
        if (val == null) return;
        val = val[parts[i]];
      }
      if (val != null) el.setAttribute('href', prefix + val);
    });
  }

  // Try localStorage preview first (set by admin panel), then fetch JSON
  function load() {
    try {
      const local = localStorage.getItem('eserveContentDraft');
      if (local) {
        applyContent(JSON.parse(local));
      }
    } catch (e) { /* ignore */ }

    fetch(findContentUrl(), { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data) applyContent(data); })
      .catch(function () { /* fail silent — fallback to inline content */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
