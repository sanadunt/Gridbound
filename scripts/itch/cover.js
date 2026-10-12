// Store art for itch.io, drawn from the game's own art modules (served by the Vite dev server: scripts/itch-assets.mjs).
// ?kind=cover → 630×500 cover image, ?kind=banner → 960×240 page banner. Sets window.itchReady once fonts and art are in.
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/space-grotesk/latin-600.css';
import { townSceneCanvas } from '/src/art/town-scene.ts';
import { heroCanvas, dragon } from '/src/art/pixels.ts';
import { ROSTER } from '/src/game/content.ts';

const kind = new URLSearchParams(location.search).get('kind') === 'banner' ? 'banner' : 'cover';
const art = document.getElementById('art');
const px = (w, h) => { const el = document.createElement('canvas'); el.width = w; el.height = h; const c = el.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = false; return { el, c }; };
const hero = id => heroCanvas(ROSTER[id].classId, 0, id);
/** One logical pixel canvas, shown at an integer scale. */
function stage(w, h, scale) {
  art.style.width = `${w * scale}px`; art.style.height = `${h * scale}px`;
  const { el, c } = px(w, h); el.style.width = `${w * scale}px`; el.style.height = `${h * scale}px`; art.append(el); return c;
}
const shadow = (c, x, y, w) => { c.fillStyle = '#05100c99'; c.beginPath(); c.ellipse(x, y, w, 2.5, 0, 0, Math.PI * 2); c.fill(); };
function overlay(css) { const el = document.createElement('div'); el.className = 'shade'; el.style.background = css; art.append(el); }
function brand({ left, top, width, eyebrow, logo, sub, gap }) {
  const el = document.createElement('div'); el.className = 'brand'; Object.assign(el.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, gap: `${gap}px` });
  el.innerHTML = `<span class="eyebrow" style="font-size:${eyebrow}px">A Tactical Pixel RPG</span><h1 class="logo" style="font-size:${logo}px;margin:0">GRIDBOUND</h1><div class="sub" style="font-size:${sub}px"><span class="flourish" style="width:${sub * 4}px"></span><span>ASHES OF THE BELL</span><span class="flourish right" style="width:${sub * 4}px"></span></div>`;
  art.append(el);
}

/** A seeded LCG like the game's art (no Math.random: the same image every run). */
const seeded = seed => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
const poly = (c, points, color) => { c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };

if (kind === 'cover') {
  // 630×500 = 210×167 art pixels at 3×: the gate and the lit bell tower under the night sky, the nine classes in front.
  const c = stage(210, 167, 3), town = townSceneCanvas();
  c.drawImage(town, 3, 0, 210, 167, 0, 0, 210, 167);
  overlay('linear-gradient(180deg, #08110fcc 0%, #08110f55 18%, #08110f33 30%, #08110faa 52%, #08110f22 66%, #08110f00 76%, #08110f66 100%)');
  const heroes = stage(210, 167, 3);
  const back = [9, 10, 11, 12], front = [3, 2, 0, 4, 7]; // bard, hexer, engineer, monk · archer, rogue, warrior, healer, wizard
  back.forEach((id, i) => { shadow(heroes, 45 + i * 40, 149, 9); heroes.drawImage(hero(id), 25 + i * 40, 107); });
  front.forEach((id, i) => { shadow(heroes, 25 + i * 40, 160, 10); heroes.drawImage(hero(id), 5 + i * 40, 118); });
  brand({ left: 0, top: 44, width: 630, eyebrow: 15, logo: 56, sub: 16, gap: 18 });
} else {
  // 960×240 = 480×120 art pixels at 2×: a night drawn with the battle backdrop's palette and shapes (sky, moon, hills, pines,
  // flagstones; pixels.ts background() is too narrow for a banner), the nine classes on the left, Vharok on the right, the logo between.
  const W = 480, H = 120, c = stage(W, H, 2), rnd = seeded(1849);
  for (let y = 0; y < H; y += 4) rect(c, 0, y, W, 4, `rgb(${17 + y * .08},${34 + y * .2},${36 + y * .15})`);
  for (let i = 0; i < 90; i++) rect(c, rnd() * W, rnd() * 70, 1, 1, rnd() > .8 ? '#c8d9b0' : '#71998a');
  c.fillStyle = '#d5bb7b'; c.beginPath(); c.arc(392, 40, 30, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#eedaa0'; c.beginPath(); c.arc(389, 37, 24, 0, Math.PI * 2); c.fill();
  const hills = (base, amp, step, color) => { const pts = [[0, H]]; for (let x = 0; x <= W + step; x += step) pts.push([x, base - amp * (.4 + rnd() * .6)]); pts.push([W, H]); poly(c, pts, color); };
  hills(78, 34, 28, '#294b45'); hills(90, 26, 22, '#203d36');
  for (let i = 0; i < 34; i++) { const x = i * 15 - 10, h = 18 + rnd() * 22, y = 96 + rnd() * 4; rect(c, x + 5, y - h, 3, h, '#172f2d'); for (let k = 0; k < 3; k++) poly(c, [[x + 7, y - h + k * 7], [x - 5 - k, y - h + 18 + k * 7], [x + 18 + k, y - h + 18 + k * 7]], '#19352e'); }
  rect(c, 0, 96, W, H - 96, '#1d322c');
  for (let y = 98; y < H; y += 12) for (let x = -20; x < W + 10; x += 28) { const xx = x + (y % 24 ? 14 : 0); rect(c, xx, y, 26, 10, rnd() > .55 ? '#2e4437' : '#293f34'); rect(c, xx + 1, y, 24, 1, '#3b5140'); }
  rect(c, 0, 95, W, 2, '#52684e');
  c.drawImage(dragon(0), 306, 2);
  const back = [9, 10, 11, 12], front = [3, 2, 0, 4, 7];
  back.forEach((id, i) => { shadow(c, 28 + i * 26, 102, 8); c.drawImage(hero(id), 8 + i * 26, 60); });
  front.forEach((id, i) => { shadow(c, 20 + i * 26, 114, 9); c.drawImage(hero(id), i * 26, 72); });
  overlay('radial-gradient(ellipse 34% 70% at 47% 46%, #08110fcc 0%, #08110f66 60%, #08110f00 100%)');
  brand({ left: 270, top: 46, width: 400, eyebrow: 12, logo: 40, sub: 12, gap: 14 });
}
await document.fonts.ready;
await Promise.all([document.fonts.load('56px "Press Start 2P"'), document.fonts.load('600 15px "Space Grotesk"')]);
window.itchReady = true;
