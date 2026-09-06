# Gridbound on Hostinger / hPanel

**Importing GitHub with a Build Config form on Business hosting? Use [HOSTINGER-GITHUB.md](HOSTINGER-GITHUB.md) instead.** It covers Vite builds and the optional `server.js` entry. The instructions below are only for manual static ZIP upload.

Gridbound runs as **static files**. Use Hostinger web hosting that exposes File Manager / a document root. No Node.js runtime, npm on the server, PHP app, MySQL database, VPS or environment secrets are needed. Hostinger Website Builder/Horizons-only workflows are different: if no File Manager is available, do not try importing this ZIP as a builder theme. Check the site's hosting type first.

## Ready-to-upload package

Use `Gridbound-Hostinger-0.3.0.zip`, generated with:

```sh
npm ci
npm run package:hostinger
```

Packaging runs the production build, then a Python 3.9+ standard-library packager. Python and Node are needed **only on the build machine**, not Hostinger. The ZIP and SHA-256 checksum are in `artifacts/`. It contains only built website files, including the hidden `.htaccess`. There is no enclosing `dist/` or `public_html/` folder.

## Safest first deployment: a subfolder

If your domain already hosts WordPress or another site, leave its files and root `.htaccess` intact. Use a separate subfolder or a dedicated subdomain/document root instead.

1. In hPanel, open the target website's dashboard, then **Files → File Manager**. Labels can vary by hPanel/site type.
2. Open that site's `public_html` directory.
3. Create a new folder such as `gridbound` and open it.
4. Upload `Gridbound-Hostinger-0.3.0.zip` **inside this folder**.
5. Use **Extract**. Choose the current folder or move the extracted contents up if the extractor creates an extra directory.
6. Confirm this exact layout; enable hidden-file visibility to confirm `.htaccess`:

```text
public_html/
  gridbound/
    index.html
    .htaccess
    favicon.svg
    assets/
      index-<hash>.js
      engine-<hash>.js
      index-<hash>.css
      ...local font files
```

7. Visit `https://your-domain.example/gridbound/` with the trailing slash. Delete the uploaded ZIP from the public folder after extraction; retain a local backup.
8. Test town → prepare party → begin campaign → tap a sprite. Check that the network panel has no asset 404s. The game must use the same domain/protocol each time to retain the same browser save.

## Use the entire domain

For a **dedicated, empty game site**, extract the same ZIP directly into `public_html`, so `public_html/index.html` exists. Then open `https://your-domain.example/`.

Back up first. Do not blindly delete existing WordPress, website content or hosting configuration. If a default landing page still appears, inspect existing `index.php`, `default.php` or other index files and the site's directory-index configuration; rename only the placeholder you have identified and backed up. Do not overwrite an unrelated root `.htaccess` just to host a game—use a dedicated folder/site.

## HTTPS, caching and updates

- Enable/verify SSL through the hosting dashboard. This ZIP does **not** force redirects or alter DNS, avoiding proxy/SSL redirect loops.
- `.htaccess` sets the HTML entry to revalidate, sets content-hashed JS/CSS/fonts to one-year immutable cache, disables directory listing, declares font/JS MIME types, adds `nosniff`, and enables gzip for text where supported.
- Modules are guarded where possible. The supplied rules are Apache-compatible and intended for compatible LiteSpeed hosting. Actual hosting policy/module support can differ.
- If Hostinger cache/CDN serves the previous page, purge that site's cache using the dashboard's available cache controls and hard reload. Edge cache settings can override origin headers.
- On updates, upload new hashed assets **first**, then replace `index.html` last. Keep previous hashed assets temporarily for already-open tabs. Extracting a ZIP over a live site is acceptable for a small prototype but not an atomic deployment.
- Keep the URL path stable across updates. No source code or runtime database is uploaded.

## Save-data implications

Saves use localStorage, not MySQL. They are tied to browser and origin (`scheme + domain + port`). Moving from localhost to Hostinger, HTTP to HTTPS, or one subdomain to another does **not** migrate a save. Two copies under different paths on the **same origin share this game's save namespace**, so use a separate test subdomain or isolated browser when testing a second copy. Active battles are not saved: finish a chapter before reload/update.

## Troubleshooting

| Symptom | Check |
|---|---|
| Hostinger placeholder instead of game | Correct site's document root; `index.html` at the intended level; old placeholder index and edge cache |
| Blank page / asset 404 | Uploaded production ZIP, not source; no extra dist/public_html directory; all assets present; trailing slash for a subfolder |
| HTTP 500 after adding `.htaccess` | Check hosting error log. Back up and temporarily rename **only this game's** `.htaccess`; the static game can run without optional cache rules. Do not edit unrelated hosting configuration |
| HTTP 403 | File/folder permissions and correct index entry; directory browsing is intentionally disabled |
| No sound | Tap the game once to unlock Web Audio; verify game mute and device/browser audio settings |
| Old game after update | Purge site/edge cache, hard reload, verify the new index refers to new asset hashes |
| Progress missing | Verify same browser, HTTPS and domain; private browsing and clearing site data use/remove separate storage |

## Verification boundary

Run `npm run package:hostinger && npm run test:hostinger` on macOS with system Apache and an installed Chrome (the isolated browser harness discovers it). The Apache smoke test uses a temporary document root and localhost port, and stops its own process afterward; it does not change system Apache settings. Other systems can set `APACHE_BIN`, `APACHE_MODULE_DIR` and `APACHE_MIME_TYPES` to their compatible local Apache installation. CI builds and validates the ZIP, but does not run this Apache/browser gate.

Local production tests prove root/subfolder gameplay and Apache-compatible `.htaccess` behavior, including MIME types, cache headers, gzip and hidden-file protection. They do not establish that your domain, SSL, hosting plan or live hPanel deployment has been configured. A live URL must be checked separately after upload. No Hostinger login, DNS, billing or deployment is performed by these scripts.

Hostinger's public upload guide: https://www.hostinger.com/tutorials/how-to-upload-your-website/ (retrieved live when preparing this package). It documents File Manager/archive upload and the `public_html` document root; panel labels may evolve.
