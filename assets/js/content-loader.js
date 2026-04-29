/* =========================================================
   ESERVE INFOTECH — Content Loader
   Reads content.json and populates [data-edit="page.key"] elements.
   Falls back silently — if the fetch fails, the inline HTML stays visible.

   IMPORTANT — Cache busting:
   Browsers, hosting providers and CDNs (Cloudflare, BunnyCDN, etc.) love
   to cache .json files. Without busting, visitors keep seeing the old
   content even after the writer hits "Save". We use three layers:
     1. A timestamp query string on every fetch (per page-load).
     2. cache: 'no-store' to bypass the HTTP disk cache.
     3. Cache-Control: no-store header on content.json from .htaccess.
   ========================================================= */

(function () {
  'use strict';

  // Resolve the site root (where content.json + content.php live)
  // relative to where this loader script lives, so it works at any
  // subdirectory depth without per-page heuristics.
  function findSiteRoot() {
    var script = document.currentScript;
    if (!script) {
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src && scripts[i].src.indexOf('content-loader') !== -1) {
          script = scripts[i];
          break;
        }
      }
    }
    if (script && script.src) {
      // /assets/js/content-loader.js → walk up THREE segments to reach site root
      return script.src.replace(/\/[^\/]*$/, '').replace(/\/[^\/]*$/, '').replace(/\/[^\/]*$/, '');
    }
    return window.location.origin;
  }

  function applyContent(data) {
    if (!data) return;
    document.querySelectorAll('[data-edit]').forEach(function (el) {
      var key = el.getAttribute('data-edit');
      var val = key.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, data);
      if (val == null) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = val;
      } else if (el.hasAttribute('data-edit-html')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });
    document.querySelectorAll('[data-edit-href]').forEach(function (el) {
      var key = el.getAttribute('data-edit-href');
      var prefix = el.getAttribute('data-edit-prefix') || '';
      var val = key.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, data);
      if (val != null) el.setAttribute('href', prefix + val);
    });
  }

  var fetchOpts = {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
  };

  function fetchJson(url) {
    return fetch(url, fetchOpts).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function load() {
    var root = findSiteRoot();
    var bust = '?v=' + Date.now();

    // Apply local draft first (only relevant on the editor's preview tab),
    // then overwrite with the live server JSON when it arrives.
    try {
      var draft = localStorage.getItem('eserveContentDraft');
      if (draft) applyContent(JSON.parse(draft));
    } catch (e) { /* ignore */ }

    // Prefer content.php (always serves with no-cache headers, even when
    // the host's mod_headers / .htaccess directives are disabled).
    // Fall back to content.json if PHP is unavailable.
    fetchJson(root + '/content.php' + bust)
      .catch(function () { return fetchJson(root + '/content.json' + bust); })
      .then(function (data) { if (data) applyContent(data); })
      .catch(function (e) {
        if (window.console && console.warn) console.warn('content-loader: fetch failed', e);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
