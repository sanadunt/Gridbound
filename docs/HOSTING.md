# Static hosting

## Build once, serve files

Requirements for building: Node 22.12+ and npm. Production hosting requires only an HTTP static file server.

```sh
npm ci
npm run build
```

Publish the **contents of dist/**. Do not upload node_modules or the development source as the website. No secrets, environment variables, database, cloud account or server process are needed by the game.

- **Hostinger Business / GitHub import:** follow [HOSTINGER-GITHUB.md](HOSTINGER-GITHUB.md) for managed Vite build settings and the optional Node entry.
- **Hostinger / manual hPanel upload:** use the Hostinger-specific ZIP; follow [HOSTINGER.md](HOSTINGER.md). No Node server or database is needed.
- **Netlify:** import the repository; the included netlify.toml sets build command and dist directory.
- **Vercel:** import as Vite; vercel.json explicitly selects dist and npm run build.
- **nginx / Apache / object storage:** copy dist contents to the web root, or a subfolder ending with a slash.
- **GitHub Pages:** use a static artifact deployment if your account/visibility supports it. A private repository alone does not guarantee Pages availability. No Pages deployment is automatically enabled here.

The Vite base is `./`, so `/games/Gridbound/` works without rebuilding. Assets are relative, and the production smoke serves the real bundle from `/subdir/Gridbound/`. No client-side route rewriting is necessary.

## Cache and delivery

Serve HTML with revalidation. Hashed assets can use `Cache-Control: public, max-age=31536000, immutable`. Enable gzip or Brotli at the host. The Phaser engine and application are separate hashed chunks, allowing unchanged engine code to stay cached across story/content updates. Keep every generated font and asset file.

LocalStorage is isolated by domain and protocol. A move from localhost to a hosted domain starts a different save. Do not promise cloud sync or seamless cross-domain migration. Active battles are not saved: reload returns to town and discards unbanked expedition loot.

## Verify deployment

Open the actual deployed URL, start a campaign and check the browser console/network. Asset 404s usually mean the dist directory was nested incorrectly or the URL lacks its trailing slash. The source index.html is not a production entry point.

```sh
npm run test:production
```

This command starts and cleans up a temporary local static server and isolated Chrome, proves nested-path assets/gameplay, and asserts that production does not expose window.gridbound.

The GitHub upload in this delivery is source control, not a claim that a public hosting deployment has happened.
