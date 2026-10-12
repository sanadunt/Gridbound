// itch.io store art, drawn by the game itself (see docs/ITCH.md):
//   docs/itch/cover.png            630×500 cover (scripts/itch/cover.html: town art, the nine classes, the logo)
//   docs/itch/banner.png           960×240 page banner (optional on itch)
//   docs/itch/screenshots/*.png    phone-portrait screenshots of a seeded mid-game save in English (Indonesian in screenshots/id/)
// Usage: CHROME_PATH=/path/to/chrome npm run itch:assets   (= node scripts/itch-assets.mjs)
//   ITCH_ONLY=cover,banner,shots   parts to draw (default all)      ITCH_LANGS=en,id   screenshot languages (default both)
//   ITCH_OUT=dir                   output folder (default docs/itch) ITCH_DPR=2         screenshot pixel ratio (540×960 CSS px → 1080×1920)
//   ITCH_PORT=5187                 port of the Vite dev server this script starts; GRIDBOUND_URL uses a running one instead
import { realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser } from './browser-harness.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.env.ITCH_OUT || join(root, 'docs', 'itch');
const only = (process.env.ITCH_ONLY || 'cover,banner,shots').split(',');
const langs = (process.env.ITCH_LANGS || 'en,id').split(',').filter(lang => ['en', 'id'].includes(lang));
const dpr = Number(process.env.ITCH_DPR) || 2;
const PHONE = { width: 540, height: 960 };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = [];

/** A save in Act III (chapters 1–9 cleared, 13 heroes, advanced jobs, gear and talents, chests and quests claimed, every mode visited),
 *  built with the game's own progression functions and migrated into a fresh Commander on the next load. */
const SEED = lang => `(async () => {
  await new Promise(done => { const q = indexedDB.deleteDatabase('gridbound.commanders.r1'); q.onsuccess = q.onerror = q.onblocked = () => done(); });
  localStorage.clear(); localStorage.setItem('gridbound.lang', ${JSON.stringify(lang)});
  localStorage.setItem('gridbound.ui.unlocks', JSON.stringify({ intro: ['dungeon', 'raid', 'endless'], visited: ['dungeon', 'raid', 'endless'] }));
  const { createProfile, completeZone, recordChapterResult, claimStarChest, claimQuest, promote, equipSkill, equipGear, buyTalent } = await import('/src/game/profile.ts');
  const { xpForLevel } = await import('/src/game/levels.ts'), { JOBS, GEAR } = await import('/src/game/jobs.ts'), { ROSTER } = await import('/src/game/content.ts'), { QUESTS, questProgress } = await import('/src/game/quests.ts');
  const p = createProfile(); p.sound = false; p.motion = false;
  for (let i = 0; i < 9; i++) { completeZone(p, i); recordChapterResult(p, i, i % 4 === 3 ? 2 : 3, false); }
  p.gold = 1e6;
  p.roster.forEach((id, k) => {
    const cls = ROSTER[id].classId, level = 13 + k % 3, job = Object.values(JOBS).filter(j => j.base === cls && j.tier === 2)[k % 2];
    p.loadouts[id].xp = xpForLevel(level); promote(p, id, job.id); equipSkill(p, id, cls === 'healer' ? 1 : 0, job.index);
    for (const slot of ['weapon', 'armor', 'charm']) { const g = GEAR.filter(g => g.slot === slot && (!g.classId || g.classId === cls) && (g.minLevel ?? 1) <= level).sort((a, b) => b.cost - a.cost)[0]; if (g) equipGear(p, id, g.id); }
    for (const talent of ['vigor', 'focus', 'mastery']) buyTalent(p, id, talent);
  });
  p.ledger.raids = 3; p.bestFloor = 7;
  p.journey = { ...p.journey, depth: 3, pendingRecruitScenes: undefined, pendingChapterScenes: undefined };
  while (claimStarChest(p));
  for (let more = true; more;) { more = false; for (const q of QUESTS) if (!p.claimedQuests.includes(q.id) && questProgress(p, q).ready && claimQuest(p, q.id, p.storyActive[0])) more = true; }
  p.gold = p.economy.gold = 2480; p.economy.commanderCrystal = 640;
  localStorage.setItem('gridbound.v3', JSON.stringify(p));
})()`;

async function capture(send, file, clip) {
  const shot = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { x: 0, y: 0, ...clip, scale: 1 } } : {}) });
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, Buffer.from(shot.data, 'base64'));
  report.push(file.replace(root, ''));
}

/** Cover and banner: scripts/itch/cover.html at its exact size, one CSS pixel per image pixel. */
async function storeArt(url, kind, width, height) {
  await withBrowser(async ({ send, wait }) => {
    await send('Page.navigate', { url: `${url}scripts/itch/cover.html?kind=${kind}` });
    await wait('window.itchReady === true', 30000);
    await pause(300);
    await capture(send, join(out, `${kind}.png`), { width, height });
  }, { width, height });
}

async function screenshots(url, lang) {
  const dir = join(out, 'screenshots', ...(lang === 'en' ? [] : [lang]));
  await withBrowser(async ({ send, evaluate, wait, click, errors }) => {
    if (dpr !== 2) await send('Emulation.setDeviceMetricsOverride', { ...PHONE, deviceScaleFactor: dpr, mobile: true });
    const camp = 'Boolean(window.gridbound && document.querySelector(".camp-scene"))';
    await send('Page.navigate', { url });
    await wait(camp, 30000);
    await evaluate(SEED(lang));
    await send('Page.reload');
    await wait(camp, 30000);
    await wait('window.gridbound.profile().cleared.length === 9 && document.documentElement.lang === ' + JSON.stringify(lang));
    await pause(800);

    // 01 · Title screen (automation skips it at boot; the dev hook shows it without the intro animation).
    await evaluate('window.gridbound.showTitle(false)');
    await wait('!document.querySelector("#title-screen").hidden');
    await evaluate('document.activeElement?.blur()');
    await pause(800);
    await capture(send, join(dir, '01-title.png'));

    // 02 · Emberhollow, the camp.
    await evaluate('window.gridbound.hideTitle()');
    await wait('document.querySelector("#title-screen").hidden');
    await pause(800);
    await capture(send, join(dir, '02-camp.png'));

    // 03 · Battle: Chapter 10 against a telegraphed ground attack that marks hero tiles (the fight is frozen once the warning banner fades).
    await click.nav('campaign');
    await click('[data-zone="9"]');
    await wait('Boolean(document.querySelector("[data-depart=adventure]"))');
    await click('[data-depart="adventure"]');
    await wait('!window.gridbound.inTown && window.gridbound.battle.status === "ready"');
    await pause(500);
    await click('#start');
    await wait('window.gridbound.battle.status === "fighting"');
    const marked = '(() => { const b = window.gridbound.battle, tiles = b.heroes.filter(h => h.hp > 0).map(h => h.slot); return b.threats.some(t => ["front", "meteor", "breath", "target"].includes(t.type) && t.left > 1.6 && t.slots.some(s => tiles.includes(s))); })()';
    for (let i = 0; i < 160 && !(i > 20 && await evaluate(marked)); i++) {
      const ids = await evaluate('window.gridbound.battle.heroes.filter(h => h.hp > 0).map(h => h.id)');
      await click(`[data-tap="${ids[i % ids.length]}"]`).catch(() => {});
      await pause(120);
    }
    await evaluate('window.gridbound.scene.timeScale = 0');
    await wait('!document.querySelector("#banner").classList.contains("visible")', 4000).catch(() => {});
    await pause(200);
    await capture(send, join(dir, '03-battle.png'));
    await evaluate('window.gridbound.scene.timeScale = 1');
    await click.retreat();
    await wait('Boolean(document.querySelector("#modal")?.open && document.querySelector("#modal #abandon-run"))');
    await click('#abandon-run');
    await wait('window.gridbound.inTown', 15000);

    // 04 · The Act III overworld with the next chapter's summary.
    await click.nav('campaign');
    await wait('Boolean(document.querySelector(".map-node-pin"))');
    await pause(600);
    await capture(send, join(dir, '04-world-map.png'));

    // 05 · The Undercroft: a fresh Depth 4 run (its map seed is pinned so every run draws the same rooms).
    await click.nav('dungeon');
    await wait('Boolean(document.querySelector(".dungeon-scene [data-dungeon-start]"))');
    await evaluate('window.__random = Math.random; Math.random = () => 0.4242');
    await click('[data-dungeon-start="4"]');
    await wait('Boolean(document.querySelector("[data-dungeon-node]"))');
    await evaluate('Math.random = window.__random');
    await pause(600);
    await capture(send, join(dir, '05-undercroft.png'));

    if (errors.length) console.warn(`[${lang}] console errors:`, errors.map(e => e.text ?? e.exception?.description ?? JSON.stringify(e)).join('\n'));
  }, { ...PHONE, mobile: true });
}

let server;
try {
  let url = process.env.GRIDBOUND_URL;
  if (!url) {
    // A private dev server (its own dependency cache, node_modules allowed even when it is a symlink): the seed imports /src modules.
    const { createServer } = await import('vite');
    const port = Number(process.env.ITCH_PORT) || 5187;
    server = await createServer({ root, configFile: join(root, 'vite.config.ts'), cacheDir: join(root, 'node_modules', '.vite-itch'), logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root, realpathSync(join(root, 'node_modules'))] } } });
    await server.listen();
    url = `http://127.0.0.1:${port}/`;
  }
  if (!url.endsWith('/')) url += '/';
  if (only.includes('cover')) await storeArt(url, 'cover', 630, 500);
  if (only.includes('banner')) await storeArt(url, 'banner', 960, 240);
  if (only.includes('shots')) for (const lang of langs) await screenshots(url, lang);
  console.log(`itch assets written:\n${report.map(file => `  ${file}`).join('\n')}`);
} finally {
  await server?.close();
}
