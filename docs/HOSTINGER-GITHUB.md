# Hostinger Business: import this GitHub project

Use **Websites → Add Website → Deploy Web App → Import Git Repository**. This is the managed build flow, not **Advanced → Git** and not the manual static ZIP flow.

- Repository: `https://github.com/sanadunt/Gridbound`
- Branch: `main`
- Project root: `.` (the folder containing `package.json`, not `src` or `dist`).

The repository is private. Connect your own GitHub account and grant Hostinger access to this repository. Pasting a private URL into the unauthenticated public-repository importer will not work. Do not make the repository public just to bypass this step.

## Recommended: Vite frontend

Gridbound is a browser game and does not require a backend process. Choose this when **Vite** is available in the framework selector:

| Build config field | Value |
|---|---|
| Framework | Vite |
| Node.js | 22.x, at least 22.12.0 |
| Package manager | npm |
| Install command, if shown | `npm ci --include=dev` |
| Build command | `npm run build` |
| Output / publish directory | `dist` |
| Node entry file | Leave empty / not applicable |
| Start command | Not needed for static Vite hosting |
| Environment variables | None required |

Vite's build entry is the repository's **`index.html`**; it compiles `src/main.ts` into browser JavaScript. Neither `src/main.ts` nor a content-hashed file inside `dist/assets` is a Node startup file. If a mandatory JavaScript entry field remains visible, check whether the framework is still **Other** rather than Vite.

If the builder installs production-only dependencies and reports `vite: not found` or `tsc: not found`, explicitly use `npm ci --include=dev` for installation. If there is no install field, use `npm ci --include=dev && npm run build` as the build command. Build tools belong in devDependencies but must exist during the build.

## Alternative: a Node form that requests a JavaScript entry

The repository also supplies **`server.js`** and **`npm start`**. This is a dependency-free Node HTTP server for the production `dist` directory, not Vite dev/preview.

| Build config field | Value |
|---|---|
| Framework | Other (Node application) |
| Project / application root | `.` |
| Node.js | 22.x, at least 22.12.0 |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Entry file | `server.js`, relative to the repository/application root |
| Start command, if shown | `npm start` |
| Environment | `NODE_ENV=production` optional; no secrets required |

The **browser build output is `dist`**, while the **Node entry is outside it at the project root**. This Node route must retain `server.js` alongside `dist/`; do not deploy only the contents of `dist` and expect the Node entry to exist. If a panel field specifically selects the folder retained as the complete Node runtime, use the project root `.`. If it only asks where browser build files are generated, that is `dist`. Do not confuse these with the Vite static publish-directory field. If Hostinger resolves entry files differently in the displayed form, check its field help/build log before deploying; actual hPanel field semantics have not been verified against a logged-in account.

The process respects the platform's `PORT`, binds to `0.0.0.0` by default, and serves only the built index/favicon/assets. Source files, dotfiles, directory listing, traversal, and escaping symlinks are not served. The default local port is 3000 when `PORT` is absent. Do not override Hostinger's injected port. `HOST` exists for isolated local tests; no Hostinger override is needed.

Apache `.htaccess` applies only to Apache-compatible static hosting. The Node entry sets its own MIME/cache/nosniff headers; TLS and compression can be handled by the hosting proxy. There is no forced HTTPS redirect in the application.

## Local verification

```sh
npm ci --include=dev
npm test
npm run build
npm start
```

Open `http://localhost:3000/`. `npm start` deliberately fails with an actionable error when the production build is missing. To exercise the actual Node entry with an isolated headless browser:

```sh
npm run test:webapp
```

This checks town → party preparation → campaign combat, local resource URLs and no development QA global. Separate unit tests launch the entry from another working directory and test HTTP methods, missing files, MIME/cache behavior, traversal, dotfiles, symlinks, invalid ports and missing build output.

## After Hostinger finishes deployment

1. Confirm the deployment uses the intended `main` commit and has a successful build log.
2. Open the provided HTTPS URL; verify town, party preparation, chapter start and sprite taps.
3. Confirm JS/CSS/font requests return successfully, without console errors.
4. Reload after finishing a chapter to verify the browser save. Localhost saves do not migrate automatically; keep the HTTPS domain stable.
5. Use Hostinger's redeploy/update controls as available; local build success does not prove that GitHub authorization, domain, SSL or live deployment is configured.

No Hostinger credentials or DNS changes are needed in this repository. Nothing here logs into or deploys to your hosting account automatically.

Source: [Hostinger's managed Web App / GitHub deployment guide](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/). It lists Vite and Other support, GitHub authorization, output directories and optional entry files. Read against the current panel because UI labels can change.
