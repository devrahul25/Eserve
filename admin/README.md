# Content Editor — Deployment Guide

The editor lives at **`/admin/`** on the live site. It uses two small PHP endpoints to authenticate and save changes back to `content.json` on the server. Writers click **Save changes** and the live site updates immediately — no JSON file to download or upload.

> Internal use only — the editor is **not** linked from any public page and is marked `noindex, nofollow`.

---

## What's where

```
eserve-website/
├── content.json              ← the live content the public site reads
└── admin/
    ├── index.html            ← editor UI
    ├── admin.css / admin.js  ← UI assets
    ├── config.php            ← paths + helpers (do not edit)
    ├── auth.php              ← login / logout / change password
    ├── save.php              ← writes content.json (auth required)
    ├── .htaccess             ← blocks access to data/, backups/, config.php
    ├── data/
    │   └── password.hash     ← bcrypt password (auto-created on first run)
    └── backups/              ← rolling timestamped JSON backups (last 30)
```

## Hosting requirements

- **PHP 7.4 or newer** (uses `password_hash`, `random_bytes`, `JSON_PRETTY_PRINT`).
- **Apache or LiteSpeed** for the `.htaccess` file to take effect. On Nginx, replicate the rules in your server block (see below).
- The `eserve-website/` folder must be served as the document root (or under one, with `content.json` at the same level as `admin/`).

## First-time deployment

1. Upload the entire `eserve-website/` folder to your hosting (cPanel File Manager, FTP, SFTP — whatever you usually use).
2. Make sure the web server can write to:
   - `content.json` — `chmod 664` (or `666` on some shared hosts)
   - `admin/data/` — `chmod 755`, with `password.hash` writable (`chmod 644` is fine)
   - `admin/backups/` — `chmod 755`
3. Visit `https://yourdomain.co.uk/admin/`
4. Sign in with the default password: **`eserve2026`**
5. **Immediately go to Tools → Change password** and set a strong team password.

## Nginx alternative to .htaccess

Add this to your `server { ... }` block:

```nginx
location ~ ^/admin/(data|backups)/ { return 404; }
location = /admin/config.php       { return 403; }
location = /admin/_common.php      { return 403; }
```

## How saving works

1. Writer edits a field. The change is held in their browser as a local draft.
2. When they click **Save changes**, the panel POSTs the new JSON to `/admin/save.php`.
3. `save.php` checks the session, takes a timestamped backup of the current `content.json` into `admin/backups/`, then atomically replaces `content.json`.
4. The public site re-reads `content.json` on the next page load — visitors see the new text immediately.

Up to 30 timestamped backups are kept automatically. To roll back, copy a backup from `admin/backups/` over `content.json`.

## "I saved in the editor but the live site still shows old content"

This is almost always **caching** — not a save failure. The editor writes `content.json` to the server correctly, but the visitor's browser (or a CDN like Cloudflare) keeps serving the previous copy. The site already has three layers of defence:

1. The public loader fetches with `?v=<timestamp>` cache-bust + `cache: 'no-store'`.
2. `/content.php` proxies `content.json` and ALWAYS sends `Cache-Control: no-store`. The loader prefers this URL.
3. The root `.htaccess` sets `Cache-Control: no-store` on `content.json` directly.

If you're still seeing stale content after Save, check in this order:

- **Hard-refresh once** (Ctrl+Shift+R / Cmd+Shift+R) to verify your local browser cache, not the server, is the issue.
- **Open the live site in a private/incognito window** — clean cache, clean test.
- **Open DevTools → Network → reload → click `content.php`** (or `content.json` if PHP is disabled). Confirm the response body has the new text. If not, the file was not saved on the server — check `admin/backups/` for the latest backup; if there's a fresh one, the host blocked the rename. Run `chmod 664 content.json` and retry.
- **If you use Cloudflare**, in the Cloudflare dashboard add a Page Rule for `*yourdomain.co.uk/content.json` and `*yourdomain.co.uk/content.php` → **Cache Level: Bypass**. Or purge the cache from the dashboard after each save. The Page Rule is the durable fix.
- **If your hosting has its own CDN** (cPanel LiteSpeed Cache, NitroPack, WP Rocket-style plugin), exclude `content.json` and `content.php` from caching in that plugin's settings.
- **If the host disables `mod_headers`**, the `.htaccess` rules silently no-op — but `content.php` still works because it sends headers from PHP.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "PHP is not running" on the login screen | The host serves `.php` files as plain text, or PHP is disabled. | Enable PHP for the site, or check the hosting plan. |
| "Could not write to content.json" | Web server can't write to the file. | `chmod 664 content.json`; ensure the file is owned by the FTP/web user. |
| "Could not write password file" | `admin/data/` not writable. | `chmod 755 admin/data` and `chmod 644 admin/data/password.hash`. |
| 403 / 404 on `/admin/data/...` | Working as designed — direct access is blocked. | If you need to reset the password, delete `admin/data/password.hash` over FTP and the next sign-in will recreate it from the default. |
| "Too many failed sign-in attempts" | Six wrong passwords in 10 minutes. | Wait 10 minutes or delete `admin/data/throttle.json` over FTP. |

## Resetting a forgotten password

1. Log into your hosting via FTP/SFTP/cPanel.
2. Delete `admin/data/password.hash`.
3. Visit `/admin/` — the file is recreated with the default password `eserve2026`.
4. Sign in and immediately set a new password from Tools → Change password.

## What's editable

| Page | Fields |
|---|---|
| Site-wide | Company name, footer tagline, header CTA text, email, phone, address |
| Home | Hero, stats, services intro, process intro, testimonials (×2), final CTA |
| About | Hero, story heading + paragraphs, six principles |
| Services overview | Hero + five service cards |
| Portfolio | Hero + nine projects (tag, title, description) |
| Contact | Hero, form heading/subhead/submit |

The five service detail pages (web-development, mobile-app, etc.) keep their long-form content (features lists, FAQs, tech pills) directly in the HTML for now. If the team wants those editable too, the schema in `admin.js` and the `data-edit` hooks in those HTML files can be extended — just ask.
