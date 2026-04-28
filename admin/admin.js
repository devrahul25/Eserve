/* =========================================================
   Admin Panel — content editor logic
   - Auth + Save go through PHP endpoints (/admin/auth.php, /admin/save.php).
   - Click "Save changes" → live content.json is rewritten on the server.
   - "Export backup" downloads a JSON copy for the team's records.
   - localStorage holds the on-device draft for preview/refresh-safety.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- CONFIG: form schema ---------- */
  const SCHEMA = {
    site: {
      title: 'Site-wide content',
      sub: 'Things that appear on every page — company info, footer tagline, contact details.',
      sections: [
        {
          title: 'Company info', tag: 'Brand',
          desc: 'Company name and the small footer tagline.',
          fields: [
            { key: 'site.company', label: 'Company name', type: 'text' },
            { key: 'site.cta_quote_button', label: 'Header CTA button text', type: 'text' },
            { key: 'site.footer_tagline', label: 'Footer tagline', type: 'textarea',
              help: 'One sentence under the logo in the footer of every page.' },
          ]
        },
        {
          title: 'Contact details', tag: 'Footer · Contact page',
          desc: 'Used in the footer on every page and on the Contact page info cards.',
          fields: [
            { key: 'site.email', label: 'Email address', type: 'text' },
            { key: 'site.phone', label: 'Phone number', type: 'text' },
            { key: 'site.address_line_1', label: 'Address line 1', type: 'text' },
            { key: 'site.address_line_2', label: 'Address line 2', type: 'text' },
          ]
        },
      ]
    },
    home: {
      title: 'Home page',
      sub: 'index.html — hero, services intro, testimonials and final CTA.',
      sections: [
        {
          title: 'Hero', tag: 'Top of page',
          desc: 'The big headline and subheadline visitors see first.',
          fields: [
            { key: 'home.hero_eyebrow', label: 'Small label above heading', type: 'text' },
            { key: 'home.hero_h1_line1', label: 'Headline — line 1', type: 'text' },
            { key: 'home.hero_h1_line2', label: 'Headline — line 2', type: 'text' },
            { key: 'home.hero_h1_line3', label: 'Headline — line 3 (highlighted)', type: 'text' },
            { key: 'home.hero_lead', label: 'Subheadline / description', type: 'textarea' },
            { key: 'home.hero_cta_primary', label: 'Primary button text', type: 'text' },
            { key: 'home.hero_cta_secondary', label: 'Secondary button text', type: 'text' },
          ]
        },
        {
          title: 'Stats row', tag: 'Hero',
          desc: 'The three numbers under the hero — projects, clients, years.',
          fields: [
            { key: 'home.stat_1_value', label: 'Stat 1 — number', type: 'text' },
            { key: 'home.stat_1_suffix', label: 'Stat 1 — suffix (eg. +)', type: 'text' },
            { key: 'home.stat_1_label', label: 'Stat 1 — label', type: 'text' },
            { key: 'home.stat_2_value', label: 'Stat 2 — number', type: 'text' },
            { key: 'home.stat_2_suffix', label: 'Stat 2 — suffix', type: 'text' },
            { key: 'home.stat_2_label', label: 'Stat 2 — label', type: 'text' },
            { key: 'home.stat_3_value', label: 'Stat 3 — number', type: 'text' },
            { key: 'home.stat_3_suffix', label: 'Stat 3 — suffix', type: 'text' },
            { key: 'home.stat_3_label', label: 'Stat 3 — label', type: 'text' },
          ]
        },
        {
          title: 'Services intro', tag: 'Section 2',
          desc: 'Heading text introducing the services grid below.',
          fields: [
            { key: 'home.services_eyebrow', label: 'Eyebrow label', type: 'text' },
            { key: 'home.services_heading_1', label: 'Heading — start', type: 'text' },
            { key: 'home.services_heading_2', label: 'Heading — highlighted', type: 'text' },
            { key: 'home.services_subhead', label: 'Subheadline', type: 'textarea' },
          ]
        },
        {
          title: 'Process intro', tag: 'Section 3',
          desc: 'Heading above the four-step process cards.',
          fields: [
            { key: 'home.process_eyebrow', label: 'Eyebrow label', type: 'text' },
            { key: 'home.process_heading_1', label: 'Heading — start', type: 'text' },
            { key: 'home.process_heading_2', label: 'Heading — highlighted', type: 'text' },
            { key: 'home.process_subhead', label: 'Subheadline', type: 'textarea' },
          ]
        },
        {
          title: 'Testimonials', tag: 'Section 4',
          desc: 'Two client quotes. Heading, then each testimonial.',
          fields: [
            { key: 'home.testimonials_eyebrow', label: 'Eyebrow label', type: 'text' },
            { key: 'home.testimonials_heading_1', label: 'Heading — start', type: 'text' },
            { key: 'home.testimonials_heading_2', label: 'Heading — highlighted', type: 'text' },
            { key: 'home.testimonials_subhead', label: 'Subheadline', type: 'textarea' },
          ],
          subgroups: [
            { title: 'Testimonial 1', fields: [
              { key: 'home.testimonial_1_quote', label: 'Quote', type: 'textarea' },
              { key: 'home.testimonial_1_name', label: 'Name', type: 'text' },
              { key: 'home.testimonial_1_role', label: 'Role / company', type: 'text' },
            ]},
            { title: 'Testimonial 2', fields: [
              { key: 'home.testimonial_2_quote', label: 'Quote', type: 'textarea' },
              { key: 'home.testimonial_2_name', label: 'Name', type: 'text' },
              { key: 'home.testimonial_2_role', label: 'Role / company', type: 'text' },
            ]},
          ]
        },
        {
          title: 'Final CTA banner', tag: 'Bottom of page',
          desc: 'The call-to-action banner just above the footer.',
          fields: [
            { key: 'home.cta_eyebrow', label: 'Eyebrow label', type: 'text' },
            { key: 'home.cta_heading_1', label: 'Heading — start', type: 'text' },
            { key: 'home.cta_heading_2', label: 'Heading — highlighted', type: 'text' },
            { key: 'home.cta_subhead', label: 'Subheadline', type: 'textarea' },
            { key: 'home.cta_primary', label: 'Primary button text', type: 'text' },
            { key: 'home.cta_secondary', label: 'Secondary button text', type: 'text' },
          ]
        },
      ]
    },
    about: {
      title: 'About page',
      sub: 'about.html — story, principles and team values.',
      sections: [
        {
          title: 'Hero', tag: 'Top of page',
          desc: 'Headline and subheadline at the top of the About page.',
          fields: [
            { key: 'about.hero_h1_part1', label: 'Headline — start', type: 'text' },
            { key: 'about.hero_h1_part2', label: 'Headline — highlighted', type: 'text' },
            { key: 'about.hero_lead', label: 'Subheadline', type: 'textarea' },
          ]
        },
        {
          title: 'Our story', tag: 'Section 2',
          desc: 'The "Our story" panel — heading and two paragraphs.',
          fields: [
            { key: 'about.story_eyebrow', label: 'Eyebrow', type: 'text' },
            { key: 'about.story_heading', label: 'Heading', type: 'textarea' },
            { key: 'about.story_p1', label: 'Paragraph 1', type: 'textarea' },
            { key: 'about.story_p2', label: 'Paragraph 2', type: 'textarea' },
          ]
        },
        {
          title: 'Six principles', tag: 'Section 3',
          desc: 'Six cards — what we believe.',
          subgroups: [1,2,3,4,5,6].map(function(n){ return {
            title: 'Principle ' + n,
            fields: [
              { key: 'about.principle_' + n + '_title', label: 'Title', type: 'text' },
              { key: 'about.principle_' + n + '_text', label: 'Text', type: 'textarea' },
            ]
          };})
        },
      ]
    },
    services: {
      title: 'Services overview',
      sub: 'services.html — listing of all five services.',
      sections: [
        {
          title: 'Hero', tag: 'Top of page',
          fields: [
            { key: 'services.hero_h1_part1', label: 'Headline — start', type: 'text' },
            { key: 'services.hero_h1_part2', label: 'Headline — highlighted', type: 'text' },
            { key: 'services.hero_lead', label: 'Subheadline', type: 'textarea' },
          ]
        },
        {
          title: 'Service cards', tag: 'Grid',
          desc: 'The five service cards with title and short description.',
          subgroups: [1,2,3,4,5].map(function(n){ return {
            title: 'Card ' + n,
            fields: [
              { key: 'services.card_' + n + '_title', label: 'Title', type: 'text' },
              { key: 'services.card_' + n + '_desc', label: 'Description', type: 'textarea' },
            ]
          };})
        },
      ]
    },
    portfolio: {
      title: 'Portfolio page',
      sub: 'portfolio.html — case studies and projects.',
      sections: [
        {
          title: 'Hero', tag: 'Top of page',
          fields: [
            { key: 'portfolio.hero_h1_part1', label: 'Headline — start', type: 'text' },
            { key: 'portfolio.hero_h1_part2', label: 'Headline — highlighted', type: 'text' },
            { key: 'portfolio.hero_lead', label: 'Subheadline', type: 'textarea' },
          ]
        },
        {
          title: 'Projects', tag: 'Grid',
          desc: 'Edit the title, tag and description for each project.',
          subgroups: [1,2,3,4,5,6,7,8,9].map(function(n){ return {
            title: 'Project ' + n,
            fields: [
              { key: 'portfolio.project_' + n + '_tag', label: 'Tag (eg. "Web · SEO")', type: 'text' },
              { key: 'portfolio.project_' + n + '_title', label: 'Title', type: 'text' },
              { key: 'portfolio.project_' + n + '_desc', label: 'Description', type: 'textarea' },
            ]
          };})
        },
      ]
    },
    contact: {
      title: 'Contact page',
      sub: 'contact.html — heading and form labels.',
      sections: [
        {
          title: 'Hero', tag: 'Top of page',
          fields: [
            { key: 'contact.hero_h1_part1', label: 'Headline — start', type: 'text' },
            { key: 'contact.hero_h1_part2', label: 'Headline — highlighted', type: 'text' },
            { key: 'contact.hero_lead', label: 'Subheadline', type: 'textarea' },
          ]
        },
        {
          title: 'Contact form', tag: 'Form',
          fields: [
            { key: 'contact.form_heading', label: 'Form heading', type: 'text' },
            { key: 'contact.form_subhead', label: 'Form subheading', type: 'text' },
            { key: 'contact.form_submit', label: 'Submit button text', type: 'text' },
          ]
        },
      ]
    },
  };

  /* ---------- STATE ---------- */
  const STORAGE_DRAFT = 'eserveContentDraft';
  let data = null;        // current working data
  let serverData = null;  // last loaded server JSON
  let pageDirty = false;  // are there unsaved changes vs serverData

  /* ---------- DATA UTIL ---------- */
  function getByPath(obj, path) {
    return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, obj);
  }
  function setByPath(obj, path, val) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function deepEqual(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }

  /* ---------- TOAST ---------- */
  let toastTimer = null;
  function toast(msg, kind) {
    const el = document.getElementById('toast');
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3000);
  }

  /* ---------- API ---------- */
  async function api(endpoint, opts) {
    const res = await fetch(endpoint, Object.assign({
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    }, opts || {}));
    let body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) {
      const msg = (body && body.error) || ('Request failed: ' + res.status);
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return body || {};
  }

  /* ---------- LOAD ---------- */
  async function loadServerJSON() {
    try {
      const r = await fetch('../content.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      serverData = await r.json();
    } catch (e) {
      console.warn('Could not load content.json from server, using empty.', e);
      serverData = {};
    }
  }
  function loadDraft() {
    try {
      const draft = localStorage.getItem(STORAGE_DRAFT);
      if (draft) return JSON.parse(draft);
    } catch (e) {}
    return null;
  }
  function saveDraft() {
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(data));
    updateDirty();
  }
  function updateDirty() {
    pageDirty = !deepEqual(data, serverData);
    setStatus(
      pageDirty ? 'Unsaved changes — click "Save changes" to publish' : 'All changes published',
      pageDirty ? 'dirty' : 'saved'
    );
  }

  /* ---------- RENDER ---------- */
  function renderPage(pageKey) {
    const schema = SCHEMA[pageKey];
    const root = document.getElementById('editor');
    if (!schema) { root.innerHTML = ''; return; }

    let html = '<h2>' + escape(schema.title) + '</h2><p class="page-sub">' + escape(schema.sub || '') + '</p>';

    schema.sections.forEach(function (sec) {
      html += '<div class="section">';
      html += '<h3>' + escape(sec.title);
      if (sec.tag) html += ' <span class="pill">' + escape(sec.tag) + '</span>';
      html += '</h3>';
      if (sec.desc) html += '<p class="desc">' + escape(sec.desc) + '</p>';
      if (sec.fields) html += renderFields(sec.fields);
      if (sec.subgroups) {
        sec.subgroups.forEach(function (sg, i) {
          html += '<div class="subgroup"><div class="subgroup-title"><span class="num">' + (i + 1) + '</span>' + escape(sg.title) + '</div>' + renderFields(sg.fields) + '</div>';
        });
      }
      html += '</div>';
    });

    root.innerHTML = html;
    bindFieldEvents();
  }

  function renderFields(fields) {
    let html = '<div class="field-row" style="grid-template-columns:1fr">';
    fields.forEach(function (f) {
      const v = getByPath(data, f.key);
      const safe = escape(v == null ? '' : String(v));
      html += '<div class="field"><label for="f-' + escapeAttr(f.key) + '">' + escape(f.label) + '</label>';
      if (f.type === 'textarea') {
        html += '<textarea id="f-' + escapeAttr(f.key) + '" data-key="' + escapeAttr(f.key) + '">' + safe + '</textarea>';
      } else {
        html += '<input id="f-' + escapeAttr(f.key) + '" data-key="' + escapeAttr(f.key) + '" type="text" value="' + safe + '" />';
      }
      if (f.help) html += '<span class="help">' + escape(f.help) + '</span>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function bindFieldEvents() {
    document.querySelectorAll('#editor [data-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        setByPath(data, el.getAttribute('data-key'), el.value);
        saveDraft();
      });
    });
  }

  function setStatus(msg, kind) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function escape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escape(s); }

  /* ---------- ACTIONS ---------- */
  async function saveToServer() {
    const btn = document.getElementById('btnSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await api('save.php', {
        method: 'POST',
        body: JSON.stringify({ data: data })
      });
      // Sync server snapshot, clear draft
      serverData = deepClone(data);
      localStorage.removeItem(STORAGE_DRAFT);
      updateDirty();
      toast('Live site updated · ' + (res.bytes ? res.bytes + ' bytes written' : 'saved'), 'success');
    } catch (e) {
      console.error(e);
      if (e.status === 401) {
        toast('Session expired — please sign in again', 'error');
        setTimeout(function () { location.reload(); }, 1200);
      } else {
        toast(e.message || 'Save failed', 'error');
      }
    } finally {
      btn.disabled = false; btn.textContent = 'Save changes';
    }
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Backup downloaded', 'success');
  }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(reader.result);
        data = parsed;
        saveDraft();
        renderPage(currentPage());
        toast('Imported successfully', 'success');
      } catch (e) {
        toast('Import failed — invalid JSON', 'error');
      }
    };
    reader.readAsText(file);
  }
  async function reloadFromServer() {
    if (pageDirty && !confirm('Reload from server? Any unsaved draft changes will be lost.')) return;
    await loadServerJSON();
    data = deepClone(serverData);
    localStorage.removeItem(STORAGE_DRAFT);
    renderPage(currentPage());
    updateDirty();
    toast('Reloaded from server', 'success');
  }
  function resetDraft() {
    if (!confirm('Reset all unsaved changes back to the last saved version?')) return;
    data = deepClone(serverData);
    localStorage.removeItem(STORAGE_DRAFT);
    renderPage(currentPage());
    updateDirty();
    toast('Draft reset');
  }
  function currentPage() {
    const active = document.querySelector('.side-item.active[data-page]');
    return active ? active.getAttribute('data-page') : 'site';
  }

  /* ---------- CHANGE PASSWORD ---------- */
  function showChangePwModal() {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = '<div class="modal"><h3>Change password</h3><p class="muted">This is the password the team uses to sign in to this editor.</p>' +
      '<label for="oldPw">Current password</label><input id="oldPw" type="password" />' +
      '<label for="newPw">New password</label><input id="newPw" type="password" />' +
      '<label for="newPw2">Confirm new password</label><input id="newPw2" type="password" />' +
      '<div class="modal-actions"><button class="btn ghost" data-act="cancel" type="button">Cancel</button><button class="btn primary" data-act="save" type="button">Save</button></div></div>';
    document.body.appendChild(back);
    back.addEventListener('click', function (e) { if (e.target === back) back.remove(); });
    back.querySelector('[data-act="cancel"]').onclick = function () { back.remove(); };
    back.querySelector('[data-act="save"]').onclick = async function () {
      const cur = back.querySelector('#oldPw').value;
      const nw = back.querySelector('#newPw').value;
      const nw2 = back.querySelector('#newPw2').value;
      if (!cur || !nw) { toast('Fill in all fields', 'error'); return; }
      if (nw.length < 6) { toast('New password must be at least 6 characters', 'error'); return; }
      if (nw !== nw2) { toast('New passwords do not match', 'error'); return; }
      try {
        await api('auth.php?action=change', { method: 'POST', body: JSON.stringify({ current: cur, new: nw }) });
        back.remove();
        toast('Password changed', 'success');
      } catch (e) {
        toast(e.message || 'Could not change password', 'error');
      }
    };
  }

  /* ---------- DYNAMIC FIELD DISCOVERY ---------- */
  async function discoverDynamicFields() {
    const files = [
      '../index.html',
      '../about.html',
      '../services.html',
      '../portfolio.html',
      '../contact.html'
    ];
    const foundKeys = new Set();
    
    for (let i = 0; i < files.length; i++) {
      try {
        const res = await fetch(files[i] + '?t=' + Date.now());
        if (!res.ok) continue;
        const text = await res.text();
        const matches = text.matchAll(/data-edit(?:-href)?="([^"]+)"/g);
        for (const m of matches) {
          foundKeys.add(m[1]);
        }
      } catch(e) {}
    }
    
    const knownKeys = new Set();
    Object.keys(SCHEMA).forEach(function(pageKey) {
      if (SCHEMA[pageKey].sections) {
        SCHEMA[pageKey].sections.forEach(function(sec) {
          if (sec.fields) sec.fields.forEach(function(f) { knownKeys.add(f.key); });
          if (sec.subgroups) {
            sec.subgroups.forEach(function(sg) {
              if (sg.fields) sg.fields.forEach(function(f) { knownKeys.add(f.key); });
            });
          }
        });
      }
    });

    foundKeys.forEach(function(key) {
      if (!knownKeys.has(key)) {
        const parts = key.split('.');
        const pageKey = parts[0];
        
        if (!SCHEMA[pageKey]) {
          SCHEMA[pageKey] = {
            title: pageKey.charAt(0).toUpperCase() + pageKey.slice(1) + ' (Auto-discovered)',
            sub: 'Dynamically found fields from HTML',
            sections: []
          };
          const nav = document.getElementById('sideNav');
          if (nav && !nav.querySelector('[data-page="' + pageKey + '"]')) {
            const btn = document.createElement('button');
            btn.className = 'side-item';
            btn.setAttribute('data-page', pageKey);
            btn.innerHTML = '<span class="ic">✨</span>' + pageKey.charAt(0).toUpperCase() + pageKey.slice(1);
            btn.addEventListener('click', function () {
              document.querySelectorAll('.side-item[data-page]').forEach(function(x) { x.classList.remove('active'); });
              btn.classList.add('active');
              renderPage(pageKey);
            });
            nav.appendChild(btn);
          }
        }
        
        let targetSection = null;
        SCHEMA[pageKey].sections.forEach(function(s) { if (s.tag === 'Auto') targetSection = s; });
        if (!targetSection) {
          targetSection = {
            title: 'New fields', tag: 'Auto',
            desc: 'Fields automatically found in the HTML files.',
            fields: []
          };
          SCHEMA[pageKey].sections.push(targetSection);
        }
        
        const formattedLabel = parts.slice(1).join(' ').replace(/_/g, ' ');
        targetSection.fields.push({
          key: key,
          label: formattedLabel.charAt(0).toUpperCase() + formattedLabel.slice(1),
          type: (key.includes('desc') || key.includes('text') || key.includes('p') || key.includes('lead')) ? 'textarea' : 'text'
        });
      }
    });
  }

  /* ---------- INIT ---------- */
  async function showApp() {
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('app').hidden = false;
    await initApp();
  }

  async function initApp() {
    await discoverDynamicFields();
    await loadServerJSON();
    const draft = loadDraft();
    data = draft ? draft : deepClone(serverData || {});
    renderPage('site');
    updateDirty();

    // Sidebar nav
    document.querySelectorAll('.side-item[data-page]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.side-item[data-page]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        renderPage(b.getAttribute('data-page'));
      });
    });

    // Top actions
    document.getElementById('btnSave').onclick = saveToServer;
    document.getElementById('btnDownload').onclick = exportBackup;
    document.getElementById('btnReload').onclick = reloadFromServer;
    document.getElementById('btnLogout').onclick = async function () {
      try { await api('auth.php?action=logout', { method: 'POST' }); } catch (e) {}
      location.reload();
    };
    document.getElementById('btnChangePw').onclick = showChangePwModal;
    document.getElementById('btnReset').onclick = resetDraft;

    // Drag-and-drop import (still useful)
    document.getElementById('importFile').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importJson(e.target.files[0]);
      e.target.value = '';
    });

    // Warn on unload if dirty
    window.addEventListener('beforeunload', function (e) {
      if (pageDirty) { e.preventDefault(); e.returnValue = ''; }
    });

    // Keyboard: Cmd/Ctrl+S to save
    window.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (pageDirty) saveToServer();
      }
    });
  }

  /* ---------- LOGIN ---------- */
  let isPhpRunning = false;
  
  async function checkPhpAndSession() {
    const status = document.getElementById('phpStatus');
    try {
      const ping = await api('auth.php?action=ping');
      if (!ping || ping.php !== true) throw new Error('PHP not executing');
      isPhpRunning = true;
      const r = await api('auth.php?action=check');
      if (r.authed) return showApp();
      status.textContent = '';
    } catch (e) {
      status.innerHTML = '<span style="color:#DC2626">⚠ PHP is not running. Please start a PHP server (e.g. run <code>php -S localhost:8000</code> in your terminal) to use the editor.</span>';
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errEl = document.getElementById('pwErr');
    if (!isPhpRunning) {
      errEl.textContent = 'Cannot sign in: PHP server is not running.';
      return;
    }
    
    const pw = document.getElementById('pw').value;
    errEl.textContent = '';
    try {
      await api('auth.php?action=login', { method: 'POST', body: JSON.stringify({ password: pw }) });
      showApp();
    } catch (err) {
      errEl.textContent = err.message || 'Sign in failed';
    }
  });

  // Boot
  checkPhpAndSession();

})();
