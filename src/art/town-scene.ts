// Emberhollow — the full-screen pixel-art town hub.
// Everything is drawn with integer fillRects (no anti-aliased arcs/lines) and a seeded PRNG,
// so the scene is deterministic and stays crisp under `image-rendering: pixelated`.
// Light comes from the upper left (moon); warm pools come from the campfire, windows and lanterns.

export const TOWN_W = 216;
export const TOWN_H = 384;
/** Suggested letterbox color: matches the scene's darkened edges. */
export const TOWN_BG = '#0d1418';
/** Native size of the smokeCanvas() sprite. */
export const SMOKE_SIZE = { w: 16, h: 32 };

type C = CanvasRenderingContext2D;
type RGB = [number, number, number];
type Light = { x: number; y: number; rx: number; ry: number; rgb: RGB; k: number };
type Target = { facility: string } | { action: string };
export type TownHotspot = { id: string; target: Target; x: number; y: number; w: number; h: number; signX: number; signY: number };

// ---------------------------------------------------------------- palette
const ink = '#111d25';
const G = ['#13252a', '#182e2e', '#1e3833', '#26443a', '#325240', '#46684a'];        // grass, dark → light
const D = ['#2b2722', '#3f362c', '#544635', '#6a573f', '#85704f'];                   // dirt path
const S = ['#20282e', '#36434a', '#4f5d61', '#6c7a77', '#8f9b8d', '#b4bba4'];        // stone
const Wd = ['#271c18', '#3d2b22', '#563c2b', '#704f35', '#8f6942', '#ae8653'];        // wood
const Pl = ['#5f5848', '#776d57', '#91856a', '#aa9c7b'];                              // plaster
const L = ['#7a3d1c', '#c46e2a', '#f0a443', '#ffd27a', '#fff3c8'];                   // warm window light
const T = ['#123a3c', '#1b6d68', '#2fae9c', '#73ecd2', '#d6fff4'];                   // teal well glow
const B = ['#5e3f18', '#a3722a', '#dcab44', '#ffd978', '#fff8dc'];                   // bell gold
const F = ['#16282c', '#1b3233', '#223d3a', '#2c4c43', '#3b5f4c'];                   // forest canopy

// ---------------------------------------------------------------- primitives
function mk(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  const c = el.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  return { el, c };
}
const r = (c: C, x: number, y: number, w: number, h: number, col: string) => {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
const p = (c: C, x: number, y: number, col: string) => r(c, x, y, 1, 1, col);
/** Filled ellipse built from horizontal spans. */
function oval(c: C, cx: number, cy: number, rx: number, ry: number, col: string) {
  if (ry <= 0) { r(c, cx - rx, cy, rx * 2 + 1, 1, col); return; }
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    r(c, cx - hw, cy + dy, hw * 2 + 1, 1, col);
  }
}
/** Symmetric stepped triangle (spires, gables, cones). */
function spire(c: C, cx: number, top: number, bottom: number, hw: number, col: string) {
  for (let y = top; y <= bottom; y++) {
    const w = Math.round(hw * (y - top) / Math.max(1, bottom - top));
    r(c, cx - w, y, w * 2 + 1, 1, col);
  }
}
/** Trapezoid from a top span to a bottom span. */
function trap(c: C, tx0: number, tx1: number, y0: number, bx0: number, bx1: number, y1: number, col: string) {
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const a = Math.round(tx0 + (bx0 - tx0) * t), b = Math.round(tx1 + (bx1 - tx1) * t);
    r(c, a, y, b - a + 1, 1, col);
  }
}
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------------------------------------------------------------- reusable props
function pine(c: C, cx: number, base: number, h: number, pal = F, outline = true) {
  const top = base - h, foot = base - 3, maxw = Math.max(3, Math.round(h * 0.36)), tiers = h > 26 ? 4 : 3;
  const width = (y: number) => {
    const t = (y - top) / Math.max(1, foot - top), tier = (t * tiers) % 1;
    return Math.round(maxw * (0.3 + 0.7 * t) * (0.45 + 0.55 * tier));
  };
  r(c, cx - 1, foot, 3, 3, Wd[1]); p(c, cx - 1, foot, Wd[2]);
  if (outline) { p(c, cx, top - 1, ink); for (let y = top; y <= foot; y++) { const w = width(y) + 1; r(c, cx - w, y, w * 2 + 1, 1, ink); } r(c, cx - width(foot), foot + 1, width(foot) * 2 + 1, 1, ink); }
  for (let y = top; y <= foot; y++) {
    const w = width(y), last = width(y + 1) < w || y === foot;
    r(c, cx - w, y, w * 2 + 1, 1, last ? pal[0] : pal[2]);
    if (!last) { r(c, cx - w, y, Math.max(1, Math.round(w * 0.6)), 1, pal[3]); p(c, cx - w, y, pal[4]); r(c, cx + Math.ceil(w * 0.45), y, Math.ceil(w * 0.55) + 1, 1, pal[1]); }
  }
}
function tree(c: C, cx: number, base: number, rad: number, pal = F) {
  const cy = base - rad - 4;
  r(c, cx - 2, base - 6, 4, 6, ink); r(c, cx - 1, base - 6, 2, 6, Wd[2]); p(c, cx - 1, base - 6, Wd[3]);
  const blobs: [number, number, number][] = [[0, 0, rad], [-rad * 0.55, rad * 0.25, rad * 0.7], [rad * 0.55, rad * 0.3, rad * 0.7], [0, -rad * 0.45, rad * 0.75]];
  for (const [dx, dy, rr] of blobs) oval(c, cx + Math.round(dx), cy + Math.round(dy), Math.round(rr) + 1, Math.round(rr * 0.85) + 1, ink);
  for (const [dx, dy, rr] of blobs) oval(c, cx + Math.round(dx), cy + Math.round(dy), Math.round(rr), Math.round(rr * 0.85), pal[1]);
  for (const [dx, dy, rr] of blobs) oval(c, cx + Math.round(dx - rr * 0.18), cy + Math.round(dy - rr * 0.2), Math.round(rr * 0.72), Math.round(rr * 0.6), pal[2]);
  oval(c, cx - Math.round(rad * 0.35), cy - Math.round(rad * 0.5), Math.round(rad * 0.45), Math.round(rad * 0.32), pal[3]);
  p(c, cx - Math.round(rad * 0.5), cy - Math.round(rad * 0.65), pal[4]); p(c, cx - Math.round(rad * 0.2), cy - Math.round(rad * 0.7), pal[4]);
}
function bush(c: C, cx: number, base: number, w: number) {
  oval(c, cx, base - 3, w + 1, 4, ink); oval(c, cx, base - 3, w, 3, G[3]); oval(c, cx - 1, base - 4, w - 2, 2, G[4]); p(c, cx - w + 2, base - 5, G[5]);
}
function lantern(c: C, x: number, base: number, lights: Light[]) {
  r(c, x - 1, base - 16, 3, 16, ink); r(c, x, base - 15, 1, 15, Wd[3]);
  r(c, x - 3, base - 1, 7, 2, ink); r(c, x - 2, base - 1, 5, 1, S[2]);
  r(c, x - 3, base - 22, 7, 7, ink); r(c, x - 2, base - 21, 5, 5, L[3]); p(c, x - 1, base - 20, L[4]); r(c, x - 2, base - 17, 5, 1, L[1]);
  r(c, x - 3, base - 23, 7, 1, Wd[2]); p(c, x, base - 24, ink);
  lights.push({ x: x + 0.5, y: base - 10, rx: 15, ry: 11, rgb: [255, 176, 90], k: 0.22 });
}
function win(c: C, x: number, y: number, w: number, h: number, lit = true) {
  r(c, x - 1, y - 1, w + 2, h + 2, ink);
  r(c, x, y, w, h, lit ? L[2] : S[1]);
  if (lit) { r(c, x, y, w, Math.ceil(h / 2), L[3]); p(c, x, y, L[4]); r(c, x, y + h - 1, w, 1, L[1]); }
  if (w >= 5) r(c, x + (w >> 1), y, 1, h, Wd[1]);
  if (h >= 5) r(c, x, y + (h >> 1), w, 1, Wd[1]);
  r(c, x - 1, y + h + 1, w + 2, 1, Wd[3]);
}
/** Front-facing roof slope with shingle rows; light from the left. */
function roof(c: C, x: number, y: number, w: number, h: number, pal: string[], inset = 3) {
  trap(c, x + inset - 1, x + w - inset, y - 1, x - 1, x + w, y + h, ink);
  trap(c, x + inset, x + w - inset - 1, y, x, x + w - 1, y + h - 1, pal[1]);
  for (let yy = y + 2; yy < y + h - 1; yy += 3) {
    const t = (yy - y) / h, a = Math.round(x + inset * (1 - t)), b = Math.round(x + w - 1 - inset * (1 - t));
    r(c, a, yy, b - a + 1, 1, pal[0]);
    for (let xx = a + ((yy / 3) & 1 ? 2 : 0); xx < b; xx += 4) p(c, xx, yy + 1, pal[0]);
  }
  trap(c, x + inset, x + inset + 3, y, x, x + 3, y + h - 1, pal[2]);
  r(c, x + inset, y, w - inset * 2, 1, pal[3]);
  r(c, x, y + h - 1, w, 1, pal[0]);
}
function shadow(c: C, x: number, y: number, w: number, h: number) {
  c.globalAlpha = 0.35; r(c, x, y, w, h, '#050b10'); c.globalAlpha = 1;
}

// ---------------------------------------------------------------- scene layers
function sky(c: C, rnd: () => number) {
  const bands = ['#0d1426', '#121a30', '#18213a', '#202845', '#2b2e4c', '#3a3350', '#4d3a52', '#653f4f', '#7d4a4c', '#94574a'];
  for (let y = 0; y < 52; y++) for (let x = 0; x < TOWN_W; x++) {
    const f = Math.min(bands.length - 1, Math.max(0, Math.floor(y / 52 * (bands.length - 1) + bayer(x, y))));
    p(c, x, y, bands[f]);
  }
  for (let i = 0; i < 46; i++) { const x = Math.floor(rnd() * TOWN_W), y = Math.floor(rnd() * 26); p(c, x, y, rnd() > 0.8 ? '#e8ecff' : '#7787ad'); }
  for (const [x, y] of [[62, 6], [118, 10], [196, 16]]) { p(c, x, y, '#ffffff'); p(c, x - 1, y, '#8fa0c8'); p(c, x + 1, y, '#8fa0c8'); p(c, x, y - 1, '#8fa0c8'); p(c, x, y + 1, '#8fa0c8'); }
  // Crescent moon, upper left — the key light for every highlight in the scene.
  for (let y = 5; y <= 21; y++) for (let x = 20; x <= 38; x++) {
    const a = (x - 29) ** 2 + (y - 13) ** 2, b = (x - 33) ** 2 + (y - 11) ** 2;
    if (a <= 49 && b > 42) p(c, x, y, a < 30 && x < 27 ? '#fff4cf' : '#e6d9a8');
  }
}
function mountains(c: C, rnd: () => number) {
  const ridge = (base: number, amp: number, step: number, col: string, rim: string) => {
    let h = base; const hs: number[] = [];
    for (let x = 0; x < TOWN_W; x++) { if (x % step === 0) h = base - Math.floor(rnd() * amp); hs.push(h); }
    for (let x = 0; x < TOWN_W; x++) {
      const k = Math.floor(x / step), t = (x % step) / step, a = hs[k * step], b = hs[Math.min(TOWN_W - 1, (k + 1) * step)];
      const top = Math.round(a + (b - a) * t);
      r(c, x, top, 1, 70 - top, col); if (b > a || t < 0.5) p(c, x, top, rim);
    }
  };
  ridge(40, 16, 18, '#272a45', '#3b3c5c');
  ridge(48, 10, 11, '#1f2a3c', '#2c3a4e');
}
function forestBack(c: C, rnd: () => number) {
  const back = ['#121f27', '#15242b', '#1a2c31', '#1f3436', '#27403e'];
  for (let x = -4; x < TOWN_W + 6; x += 7) pine(c, x + Math.floor(rnd() * 4), 62 + Math.floor(rnd() * 5), 22 + Math.floor(rnd() * 12), back, false);
  for (let x = -2; x < TOWN_W + 6; x += 9) { if (x > 92 && x < 124) continue; pine(c, x + Math.floor(rnd() * 4), 72 + Math.floor(rnd() * 5), 22 + Math.floor(rnd() * 10)); }
}
function ground(c: C, rnd: () => number) {
  r(c, 0, 62, TOWN_W, TOWN_H - 62, G[2]);
  for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * TOWN_W), y = 64 + Math.floor(rnd() * (TOWN_H - 64)); oval(c, x, y, 4 + Math.floor(rnd() * 9), 2 + Math.floor(rnd() * 3), rnd() > 0.5 ? G[1] : G[3]); }
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(rnd() * TOWN_W), y = 66 + Math.floor(rnd() * (TOWN_H - 66)), k = rnd();
    if (k < 0.55) { p(c, x, y, G[4]); p(c, x + 2, y, G[4]); p(c, x + 1, y + 1, G[3]); }
    else if (k < 0.85) p(c, x, y, G[1]);
    else if (k < 0.95) { p(c, x, y, G[5]); }
    else { p(c, x, y, rnd() > 0.5 ? '#c9b6d8' : '#e6d48c'); }
  }
}
type Seg = [number, number, number, number, number];
function paths(c: C, rnd: () => number) {
  const segs: Seg[] = [
    [108, 66, 108, 84, 6], [108, 84, 108, 238, 8],                 // north road out through the gate
    [108, 128, 46, 134, 5], [108, 134, 170, 142, 5],              // archive / chapel lanes
    [108, 206, 44, 210, 5], [108, 206, 172, 212, 5],              // hall / guild lanes
    [80, 268, 40, 286, 5], [136, 268, 176, 288, 5],               // merchant / well
    [108, 286, 108, TOWN_H + 4, 6], [108, 330, 54, 380, 5], [108, 330, 164, 380, 5],
  ];
  const stamp = (pad: number, col: string) => {
    for (const [x0, y0, x1, y1, w] of segs) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i += 2) { const t = i / Math.max(1, n); oval(c, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w + pad, Math.max(2, Math.round((w + pad) * 0.7)), col); }
    }
  };
  stamp(1, D[0]); stamp(0, D[2]);
  // Plaza: worn cobble circle around the campfire.
  oval(c, 108, 264, 41, 27, ink); oval(c, 108, 264, 40, 26, S[2]); oval(c, 108, 264, 38, 24, S[0]);
  for (let y = 240; y < 290; y += 4) for (let x = 64; x < 154; x += 5) {
    const xx = x + ((y >> 2) % 3) * 2, dx = (xx + 2 - 108) / 37, dy = (y + 1 - 264) / 23;
    if (dx * dx + dy * dy > 1) continue;
    const v = rnd(), w = v > 0.7 ? 3 : 4;
    r(c, xx, y, w, 3, v > 0.6 ? S[2] : v > 0.2 ? S[1] : '#3d4446'); r(c, xx, y, w - 1, 1, v > 0.75 ? S[3] : S[2]);
    if (v < 0.12) p(c, xx + 1, y + 1, G[3]);
  }
  for (let i = 0; i < 22; i++) { const a = rnd() * Math.PI * 2, rr = 0.85 + rnd() * 0.2; p(c, Math.round(108 + Math.cos(a) * 39 * rr), Math.round(264 + Math.sin(a) * 25 * rr), G[4]); }
  for (let i = 0; i < 160; i++) {
    const s = segs[Math.floor(rnd() * segs.length)], t = rnd(), x = Math.round(s[0] + (s[2] - s[0]) * t + (rnd() - 0.5) * s[4] * 1.6), y = Math.round(s[1] + (s[3] - s[1]) * t + (rnd() - 0.5) * s[4]);
    const dx = (x - 108) / 40, dy = (y - 264) / 26; if (dx * dx + dy * dy < 1) continue;
    p(c, x, y, rnd() > 0.5 ? D[3] : D[1]); if (rnd() > 0.8) p(c, x + 1, y, D[4]);
  }
}
function stream(c: C, rnd: () => number) {
  // A dark creek crossing the village between the upper and middle rows.
  const ys: number[] = [];
  for (let x = 0; x < TOWN_W; x++) ys.push(Math.round(143 + Math.sin(x / 19) * 3 + Math.sin(x / 7) * 1));
  for (let x = 0; x < TOWN_W; x++) { const y = ys[x]; r(c, x, y - 4, 1, 10, ink); r(c, x, y - 3, 1, 8, '#173640'); r(c, x, y - 3, 1, 1, S[2]); r(c, x, y + 4, 1, 1, '#0e2028'); }
  for (let i = 0; i < 40; i++) { const x = Math.floor(rnd() * (TOWN_W - 6)); const y = ys[x] - 1 + Math.floor(rnd() * 4); r(c, x, y, 2 + Math.floor(rnd() * 4), 1, rnd() > 0.5 ? '#2f6170' : '#4f8c94'); }
  // Wooden footbridge on the main road.
  r(c, 95, 135, 27, 16, ink); r(c, 96, 136, 25, 14, Wd[2]);
  for (let x = 97; x < 121; x += 3) { r(c, x, 136, 2, 14, Wd[3]); p(c, x, 136, Wd[4]); }
  r(c, 94, 133, 2, 19, ink); r(c, 121, 133, 2, 19, ink); r(c, 94, 134, 1, 17, Wd[4]); r(c, 121, 134, 1, 17, Wd[3]);
  for (const x of [93, 120]) { r(c, x, 131, 4, 4, ink); r(c, x + 1, 132, 2, 2, Wd[4]); r(c, x, 148, 4, 4, ink); r(c, x + 1, 149, 2, 2, Wd[3]); }
}
function palisade(c: C) {
  for (let x = 0; x < TOWN_W; x += 4) {
    if (x > 90 && x < 124) continue;
    const top = 62 + ((x / 4) % 3 === 0 ? 0 : 1);
    r(c, x, top, 4, 18, ink); r(c, x + 1, top + 1, 2, 16, Wd[2]); p(c, x + 1, top + 1, Wd[4]); r(c, x + 1, top + 2, 1, 14, Wd[3]);
  }
  for (const y of [67, 74]) { r(c, 0, y, 92, 2, ink); r(c, 124, y, 92, 2, ink); r(c, 0, y, 92, 1, Wd[2]); r(c, 124, y, 92, 1, Wd[2]); }
}

// ---------------------------------------------------------------- buildings
function gate(c: C, lights: Light[]) {
  // North road into the dark wilderness, narrowing as it disappears.
  r(c, 94, 50, 28, 14, '#0f1d22');
  for (let y = 50; y < 66; y++) { const w = Math.round(3 + (y - 50) * 0.3); r(c, 108 - w - 1, y, w * 2 + 3, 1, D[0]); r(c, 108 - w, y, w * 2 + 1, 1, y < 56 ? '#2a2620' : D[1]); }
  for (const [x, y, h] of [[97, 62, 12], [119, 62, 11], [100, 58, 9], [116, 57, 9]] as const) pine(c, x, y, h, ['#0f1d22', '#132428', '#182c2e', '#1d3433', '#25403c'], false);
  for (const x of [80, 120]) {
    shadow(c, x + 16, 70, 4, 14);
    r(c, x - 1, 40, 18, 44, ink); r(c, x, 41, 16, 42, Wd[2]);
    for (let xx = x + 1; xx < x + 16; xx += 3) r(c, xx, 41, 1, 42, Wd[1]);
    r(c, x, 41, 2, 42, Wd[3]); r(c, x, 41, 1, 42, Wd[4]);
    r(c, x - 3, 40, 22, 4, ink); r(c, x - 2, 41, 20, 2, Wd[3]); r(c, x - 2, 41, 20, 1, Wd[4]);
    for (let xx = x - 2; xx < x + 18; xx += 4) { r(c, xx, 34, 3, 7, ink); r(c, xx + 1, 35, 1, 5, Wd[3]); }
    spire(c, x + 8, 20, 33, 12, ink); spire(c, x + 8, 21, 32, 11, '#5b2f28'); spire(c, x + 7, 22, 31, 6, '#7a4232');
    r(c, x - 3, 32, 23, 2, ink);
    r(c, x + 5, 54, 6, 8, ink); r(c, x + 6, 55, 4, 6, L[2]); r(c, x + 6, 55, 4, 2, L[3]);
    r(c, x - 1, 82, 18, 3, ink); r(c, x, 82, 16, 2, S[2]);
    lights.push({ x: x + 8, y: 58, rx: 14, ry: 12, rgb: [255, 170, 80], k: 0.2 });
  }
  // Crossbeam with the village banner.
  r(c, 94, 44, 28, 8, ink); r(c, 95, 45, 26, 6, Wd[3]); r(c, 95, 45, 26, 1, Wd[5]); r(c, 95, 50, 26, 1, Wd[1]);
  r(c, 102, 51, 13, 14, ink); r(c, 103, 51, 11, 12, '#7a2b2b'); r(c, 103, 51, 3, 12, '#9c3a32');
  p(c, 103, 63, ink); p(c, 113, 63, ink); r(c, 104, 63, 9, 1, '#7a2b2b'); r(c, 106, 63, 5, 1, ink);
  r(c, 107, 54, 3, 5, B[2]); p(c, 108, 53, B[3]); p(c, 108, 54, B[4]); r(c, 106, 58, 5, 1, B[1]);
  // Open gate doors swung inward.
  for (const [x, d] of [[96, 1], [114, -1]] as const) { r(c, x, 54, 6, 28, ink); r(c, x + (d > 0 ? 1 : 0), 55, 5, 26, Wd[2]); r(c, x + 1, 60, 4, 1, Wd[0]); r(c, x + 1, 74, 4, 1, Wd[0]); }
  // Braziers on the tower tops.
  for (const x of [88, 128]) { r(c, x - 3, 17, 7, 4, ink); r(c, x - 2, 15, 5, 3, L[2]); p(c, x, 13, L[3]); p(c, x - 1, 14, L[3]); p(c, x, 14, L[4]); lights.push({ x, y: 16, rx: 12, ry: 10, rgb: [255, 150, 60], k: 0.25 }); }
}
function archive(c: C, lights: Light[]) {
  const roofP = ['#2c2843', '#433d63', '#5d5683', '#7a74a3'];
  shadow(c, 68, 108, 6, 22);
  // Annex with a tall book-lined window.
  r(c, 27, 104, 42, 25, ink); r(c, 28, 105, 40, 23, S[2]);
  for (let y = 107; y < 128; y += 4) for (let x = 28 + ((y >> 2) & 1) * 3; x < 67; x += 6) { r(c, x, y, 5, 3, S[3]); p(c, x, y, S[4]); }
  r(c, 28, 105, 40, 2, S[1]);
  roof(c, 26, 92, 44, 13, roofP, 2);
  r(c, 41, 108, 16, 14, ink); r(c, 42, 109, 14, 12, '#2a1d1a');
  for (let y = 109; y < 121; y += 4) { r(c, 42, y + 3, 14, 1, Wd[3]); for (let x = 42; x < 56; x += 2) r(c, x, y, 1 + (x % 3 === 0 ? 1 : 0), 3, ['#a8443a', '#3e6a8c', '#c9a14a', '#5b7a43', '#8a5a9c'][(x + y) % 5]); }
  r(c, 42, 109, 14, 1, L[1]); r(c, 41, 122, 16, 1, Wd[3]);
  // Door + candle sign.
  r(c, 59, 113, 7, 15, ink); r(c, 60, 114, 5, 14, Wd[2]); r(c, 60, 114, 5, 1, Wd[4]); p(c, 63, 121, B[3]);
  // Round tower with conical roof.
  r(c, 7, 92, 24, 37, ink);
  for (let x = 8; x < 30; x++) { const t = (x - 8) / 21; r(c, x, 93, 1, 35, t < 0.25 ? S[4] : t < 0.5 ? S[3] : t < 0.8 ? S[2] : S[1]); }
  for (let y = 97; y < 128; y += 5) r(c, 8, y, 22, 1, S[1]);
  for (let y = 99; y < 128; y += 10) for (let x = 12; x < 30; x += 7) p(c, x, y, S[1]);
  r(c, 15, 102, 7, 10, ink); r(c, 16, 103, 5, 8, L[2]); r(c, 16, 103, 5, 3, L[3]); r(c, 18, 103, 1, 8, Wd[1]);
  p(c, 15, 102, S[2]); p(c, 21, 102, S[2]);
  spire(c, 19, 66, 94, 15, ink); spire(c, 19, 67, 93, 14, roofP[1]);
  for (let y = 72; y < 93; y += 3) { const w = Math.round(14 * (y - 67) / 26); r(c, 19 - w, y, w * 2 + 1, 1, roofP[0]); }
  spire(c, 16, 69, 92, 6, roofP[2]); spire(c, 15, 72, 90, 3, roofP[3]);
  r(c, 4, 93, 31, 2, ink);
  r(c, 18, 60, 3, 7, ink); p(c, 19, 61, B[3]); p(c, 19, 59, B[4]);
  // Scroll crates & lectern out front.
  r(c, 33, 126, 10, 6, ink); r(c, 34, 127, 8, 4, Wd[3]); for (let x = 34; x < 42; x += 2) { p(c, x, 126, '#e7dcb8'); p(c, x, 125, '#cbbf99'); }
  lights.push({ x: 49, y: 120, rx: 18, ry: 12, rgb: [255, 180, 100], k: 0.18 });
  lights.push({ x: 18, y: 108, rx: 12, ry: 12, rgb: [255, 180, 100], k: 0.14 });
}
function chapel(c: C, lights: Light[]) {
  const slate = ['#1f2a3a', '#2f3d52', '#43566e', '#5e7590'];
  shadow(c, 208, 112, 6, 28);
  // Nave.
  r(c, 175, 102, 34, 37, ink); r(c, 176, 103, 32, 35, S[2]);
  for (let y = 106; y < 138; y += 4) for (let x = 176 + ((y >> 2) & 1) * 3; x < 207; x += 6) { r(c, x, y, 5, 3, S[3]); p(c, x, y, S[4]); }
  roof(c, 173, 86, 38, 17, slate, 4);
  for (const x of [184, 197]) {
    r(c, x - 1, 110, 7, 18, ink); r(c, x, 112, 5, 16, '#8a3a3e'); r(c, x + 1, 111, 3, 1, '#8a3a3e');
    r(c, x, 114, 5, 5, L[3]); r(c, x + 2, 112, 1, 16, B[1]); r(c, x, 121, 5, 2, '#4d7aa4'); p(c, x + 2, 117, L[4]);
  }
  // Bell tower — the tallest landmark.
  r(c, 155, 38, 26, 103, ink); r(c, 156, 39, 24, 101, S[2]);
  for (let y = 60; y < 140; y += 5) for (let x = 156 + ((y / 5) & 1) * 4; x < 179; x += 8) { r(c, x, y, 7, 4, S[3]); r(c, x, y, 7, 1, S[4]); }
  r(c, 156, 39, 2, 101, S[4]); r(c, 177, 39, 3, 101, S[1]);
  r(c, 153, 56, 30, 4, ink); r(c, 154, 57, 28, 2, S[4]); r(c, 153, 34, 30, 5, ink); r(c, 154, 35, 28, 3, S[3]); r(c, 154, 35, 28, 1, S[5]);
  // Belfry with the last burning bell.
  r(c, 160, 39, 16, 17, ink); r(c, 161, 40, 14, 16, '#2a1a12');
  r(c, 161, 40, 14, 2, B[0]);
  p(c, 168, 41, B[1]); r(c, 165, 43, 7, 2, ink); r(c, 164, 44, 9, 1, B[1]);
  for (let y = 45; y < 53; y++) { const w = 4 + Math.floor((y - 45) / 3); r(c, 168 - w, y, w * 2 + 1, 1, ink); r(c, 168 - w + 1, y, w * 2 - 1, 1, B[2]); r(c, 168 - w + 1, y, 2, 1, B[3]); }
  r(c, 162, 53, 13, 2, ink); r(c, 163, 53, 11, 1, B[1]); p(c, 165, 46, B[4]); p(c, 165, 47, B[4]); r(c, 167, 55, 3, 1, B[3]);
  r(c, 160, 39, 2, 17, S[3]); r(c, 174, 39, 2, 17, S[1]);
  // Spire.
  spire(c, 168, 4, 34, 16, ink); spire(c, 168, 5, 33, 15, slate[1]);
  for (let y = 10; y < 33; y += 3) { const w = Math.round(15 * (y - 5) / 28); r(c, 168 - w, y, w * 2 + 1, 1, slate[0]); }
  spire(c, 165, 7, 32, 7, slate[2]); spire(c, 164, 10, 30, 3, slate[3]);
  r(c, 167, 0, 3, 5, ink); p(c, 168, 1, B[3]); p(c, 168, 2, B[2]); p(c, 168, 0, B[4]);
  // Arched doorway with candlelight.
  r(c, 162, 120, 12, 21, ink); r(c, 163, 123, 10, 18, L[1]); r(c, 164, 121, 8, 2, L[1]); r(c, 164, 124, 8, 8, L[2]); r(c, 165, 124, 2, 4, L[3]);
  r(c, 168, 123, 1, 18, Wd[1]); r(c, 160, 140, 16, 2, ink); r(c, 161, 140, 14, 1, S[4]);
  r(c, 166, 64, 4, 9, ink); r(c, 167, 65, 2, 7, L[2]); r(c, 166, 86, 4, 9, ink); r(c, 167, 87, 2, 7, L[1]);
  lights.push({ x: 168, y: 47, rx: 30, ry: 26, rgb: [255, 200, 90], k: 0.42 });
  lights.push({ x: 168, y: 140, rx: 18, ry: 10, rgb: [255, 170, 80], k: 0.25 });
  lights.push({ x: 192, y: 122, rx: 18, ry: 14, rgb: [255, 150, 110], k: 0.15 });
}
function hall(c: C, lights: Light[]) {
  const roofP = ['#4a2220', '#6b3229', '#8a4634', '#a86046'];
  shadow(c, 62, 176, 6, 30);
  r(c, 5, 172, 57, 34, ink); r(c, 6, 173, 55, 32, Pl[1]);
  r(c, 6, 173, 55, 2, Pl[0]); r(c, 6, 175, 1, 30, Pl[3]);
  for (const x of [6, 20, 47, 59]) r(c, x, 173, 2, 32, Wd[1]);
  r(c, 6, 186, 55, 2, Wd[1]); r(c, 6, 203, 55, 2, S[1]);
  for (const x of [10, 50]) win(c, x, 177, 7, 7);
  roof(c, 3, 152, 61, 21, roofP, 4);
  r(c, 46, 146, 6, 9, ink); r(c, 47, 147, 4, 8, S[2]); r(c, 47, 147, 1, 8, S[4]); r(c, 46, 145, 6, 2, S[1]);
  // Double door with crossed-swords shield.
  r(c, 26, 188, 16, 18, ink); r(c, 27, 189, 14, 17, Wd[2]); r(c, 33, 189, 1, 17, Wd[0]); r(c, 27, 189, 14, 1, Wd[4]); p(c, 31, 197, B[2]); p(c, 35, 197, B[2]);
  r(c, 28, 175, 11, 11, ink); r(c, 29, 176, 9, 8, '#7a2b2b'); r(c, 30, 184, 7, 1, '#7a2b2b'); r(c, 32, 185, 3, 1, '#7a2b2b'); r(c, 29, 176, 9, 1, B[2]);
  for (let i = 0; i < 7; i++) { p(c, 30 + i, 177 + i, S[5]); p(c, 36 - i, 177 + i, S[5]); }
  // Training yard: weapon rack with spear, sword and axe, and a shield leaning on it.
  const steel = S[5], steelD = S[3];
  r(c, 65, 182, 2, 24, ink); r(c, 80, 182, 2, 24, ink); r(c, 65, 183, 1, 22, Wd[4]); r(c, 80, 183, 1, 22, Wd[3]);
  r(c, 64, 186, 19, 3, ink); r(c, 65, 187, 17, 1, Wd[4]);
  // spear
  r(c, 68, 174, 3, 31, ink); r(c, 69, 180, 1, 25, Wd[4]); r(c, 68, 170, 3, 6, ink); p(c, 69, 169, ink); r(c, 69, 170, 1, 5, steel); p(c, 68, 172, steelD); r(c, 68, 179, 3, 1, '#a8403a');
  // sword
  r(c, 72, 175, 4, 22, ink); r(c, 73, 176, 2, 19, steel); r(c, 74, 176, 1, 19, steelD); r(c, 71, 195, 6, 3, ink); r(c, 72, 196, 4, 1, B[2]); r(c, 73, 198, 2, 5, ink); p(c, 73, 199, Wd[3]); p(c, 73, 203, B[2]);
  // axe
  r(c, 77, 180, 2, 25, ink); p(c, 77, 181, Wd[4]); r(c, 77, 182, 1, 22, Wd[3]);
  r(c, 78, 178, 4, 8, ink); r(c, 78, 179, 3, 6, steelD); r(c, 80, 179, 1, 6, steel); p(c, 82, 180, ink); p(c, 82, 184, ink);
  // shield
  oval(c, 72, 204, 6, 5, ink); oval(c, 72, 204, 5, 4, '#7a2b2b'); oval(c, 71, 203, 3, 2, '#9c3a32'); r(c, 71, 203, 3, 3, B[2]); p(c, 71, 203, B[4]);
  lights.push({ x: 34, y: 196, rx: 22, ry: 12, rgb: [255, 170, 80], k: 0.2 });
}
function guild(c: C, lights: Light[]) {
  const roofP = ['#173f48', '#24596a', '#357489', '#4f93a6'];
  shadow(c, 210, 170, 5, 36);
  r(c, 157, 164, 52, 42, ink); r(c, 158, 165, 50, 40, Pl[2]);
  r(c, 158, 184, 50, 2, Wd[1]); r(c, 158, 165, 50, 1, Pl[1]); r(c, 158, 166, 1, 39, Pl[3]);
  for (const x of [158, 182, 206]) r(c, x, 165, 2, 40, Wd[1]);
  for (let i = 0; i < 10; i++) { p(c, 160 + i * 2, 166 + i * 2, Wd[1]); p(c, 204 - i * 2, 166 + i * 2, Wd[1]); }
  r(c, 158, 202, 50, 3, S[1]);
  for (const x of [165, 194]) win(c, x, 170, 7, 8);
  win(c, 196, 189, 7, 8);
  roof(c, 155, 144, 56, 21, roofP, 6);
  // Dormer.
  r(c, 177, 140, 13, 12, ink); r(c, 178, 144, 11, 7, Pl[2]); spire(c, 183, 137, 144, 7, ink); spire(c, 183, 138, 143, 6, roofP[2]); win(c, 181, 145, 5, 5);
  // Door + hanging guild banner.
  r(c, 169, 187, 12, 19, ink); r(c, 170, 188, 10, 18, Wd[3]); r(c, 170, 188, 10, 2, Wd[4]); r(c, 175, 188, 1, 18, Wd[1]); p(c, 178, 197, B[3]);
  r(c, 185, 186, 2, 2, ink);
  r(c, 186, 186, 9, 14, ink); r(c, 187, 187, 7, 11, '#2f5a8a'); r(c, 187, 187, 2, 11, '#4473a8'); r(c, 189, 189, 3, 3, B[2]); p(c, 190, 192, B[2]); r(c, 187, 198, 3, 1, '#2f5a8a'); r(c, 191, 198, 3, 1, '#2f5a8a');
  // Quest notice board.
  r(c, 139, 180, 18, 2, ink); r(c, 138, 179, 20, 2, ink); r(c, 139, 179, 18, 1, Wd[4]);
  r(c, 140, 182, 16, 13, ink); r(c, 141, 183, 14, 11, Wd[2]);
  r(c, 141, 194, 2, 12, ink); r(c, 153, 194, 2, 12, ink); r(c, 141, 195, 1, 10, Wd[3]); r(c, 153, 195, 1, 10, Wd[3]);
  for (const [x, y, w, h, col] of [[142, 184, 5, 6, '#e8dcb5'], [148, 185, 6, 4, '#d8c99c'], [143, 191, 4, 3, '#cdbd8e'], [148, 190, 5, 4, '#efe3c0']] as const) { r(c, x, y, w, h, col); r(c, x, y + 1, w - 1, 1, '#9a8c6c'); }
  p(c, 144, 184, '#b83a32'); p(c, 150, 185, '#b83a32'); p(c, 150, 191, '#b83a32');
  lights.push({ x: 175, y: 200, rx: 20, ry: 12, rgb: [255, 170, 80], k: 0.2 });
}
function merchant(c: C, lights: Light[]) {
  // Back wall of the stall cart.
  r(c, 9, 252, 46, 26, ink); r(c, 10, 253, 44, 24, Wd[2]);
  for (let x = 12; x < 54; x += 4) r(c, x, 253, 1, 24, Wd[1]);
  // Shelf goods.
  r(c, 11, 258, 42, 1, Wd[4]);
  for (let x = 12; x < 52; x += 4) { const col = ['#c44a4a', '#4a8ac4', '#5fb05a', '#d9a63a', '#a05ac4'][(x >> 2) % 5]; r(c, x, 254, 3, 4, ink); r(c, x + 1, 254, 1, 4, col); p(c, x + 1, 254, '#ffffff'); }
  // Counter.
  r(c, 7, 266, 50, 14, ink); r(c, 8, 267, 48, 12, Wd[3]); r(c, 8, 267, 48, 2, Wd[5]); r(c, 8, 277, 48, 2, Wd[1]);
  for (let x = 10; x < 54; x += 8) r(c, x, 269, 1, 8, Wd[2]);
  for (const [x, col, hi] of [[12, '#b8443a', '#e06a50'], [18, '#d8a63a', '#ffd06a'], [26, '#5fa04a', '#8fd06a']] as const) { oval(c, x, 265, 3, 2, ink); oval(c, x, 265, 2, 1, col); p(c, x - 1, 264, hi); p(c, x + 2, 265, col); }
  r(c, 32, 261, 8, 5, ink); r(c, 33, 262, 6, 4, '#7a5ac4'); r(c, 33, 262, 6, 1, '#a88ae8');
  r(c, 44, 260, 5, 6, ink); r(c, 45, 261, 3, 5, T[3]); p(c, 46, 259, ink); p(c, 45, 261, T[4]);
  // Posts and striped awning.
  r(c, 6, 242, 3, 38, ink); r(c, 55, 242, 3, 38, ink); r(c, 7, 243, 1, 37, Wd[4]); r(c, 56, 243, 1, 37, Wd[3]);
  trap(c, 8, 56, 236, 3, 61, 250, ink);
  for (let y = 237; y < 250; y++) { const t = (y - 237) / 13, a = Math.round(9 - 5 * t), b = Math.round(55 + 5 * t); for (let x = a; x <= b; x++) p(c, x, y, Math.floor((x - 108 + 400 - (y - 237) * 0) / 6) % 2 ? '#d9c9a0' : '#a8403a'); }
  r(c, 9, 237, 46, 1, '#efe2bc');
  for (let x = 4; x < 61; x += 6) { const red = Math.floor((x - 4) / 6) % 2 === 0; r(c, x, 250, 6, 2, ink); r(c, x + 1, 250, 4, 1, red ? '#a8403a' : '#d9c9a0'); oval(c, x + 3, 252, 2, 1, ink); r(c, x + 2, 252, 3, 1, red ? '#7a2c2a' : '#b0a07a'); }
  // Hanging lantern.
  r(c, 58, 252, 1, 4, ink); r(c, 57, 256, 3, 4, ink); p(c, 58, 257, L[3]); p(c, 58, 258, L[2]);
  // Crates and barrel.
  for (const [x, y] of [[59, 274], [61, 266], [3, 280]] as const) { r(c, x, y, 10, 9, ink); r(c, x + 1, y + 1, 8, 7, Wd[3]); r(c, x + 1, y + 1, 8, 1, Wd[5]); for (let i = 0; i < 6; i++) p(c, x + 2 + i, y + 2 + i, Wd[1]); r(c, x + 1, y + 7, 8, 1, Wd[1]); }
  oval(c, 15, 286, 5, 3, ink); oval(c, 15, 285, 4, 2, '#a89a6a'); p(c, 13, 284, '#d0c290');
  oval(c, 25, 287, 5, 3, ink); oval(c, 25, 286, 4, 2, '#9c8e60');
  lights.push({ x: 32, y: 262, rx: 26, ry: 18, rgb: [255, 180, 90], k: 0.22 });
}
function well(c: C, lights: Light[]) {
  const cx = 178;
  // Rune stones circling the well.
  for (const [x, y] of [[154, 270], [202, 271], [158, 285], [199, 286]] as const) {
    r(c, x - 3, y - 9, 7, 10, ink); r(c, x - 2, y - 8, 5, 9, S[2]); r(c, x - 2, y - 8, 2, 9, S[3]); r(c, x - 2, y - 8, 5, 1, S[4]);
    p(c, x, y - 6, T[3]); p(c, x, y - 4, T[2]); p(c, x - 1, y - 5, T[2]); p(c, x + 1, y - 5, T[2]);
  }
  // Wooden frame (behind the shaft).
  r(c, cx - 17, 244, 4, 30, ink); r(c, cx + 13, 244, 4, 30, ink); r(c, cx - 16, 245, 2, 29, Wd[3]); r(c, cx + 14, 245, 2, 29, Wd[2]);
  r(c, cx - 21, 236, 43, 3, ink);
  for (let y = 233; y < 245; y++) { const w = Math.round(9 + (y - 233) * 1.1); r(c, cx - w - 1, y, w * 2 + 3, 1, ink); }
  for (let y = 234; y < 244; y++) { const w = Math.round(8 + (y - 234) * 1.1); r(c, cx - w, y, w * 2 + 1, 1, '#2a3a2c'); r(c, cx - w, y, Math.max(2, w - 2), 1, '#3c5238'); if (y % 3 === 0) r(c, cx - w, y, w * 2 + 1, 1, '#1d2a22'); }
  r(c, cx - 19, 244, 39, 1, ink);
  // Moss drips.
  for (const x of [cx - 12, cx - 4, cx + 7, cx + 15]) { r(c, x, 245, 1, 2 + (x % 3), '#3c5238'); }
  // Crank, rope and bucket.
  r(c, cx - 13, 251, 26, 2, ink); r(c, cx - 12, 251, 24, 1, Wd[4]); r(c, cx + 13, 250, 2, 6, ink); p(c, cx + 14, 254, Wd[3]);
  r(c, cx - 1, 253, 1, 9, '#a08a5e');
  r(c, cx - 4, 259, 7, 5, ink); r(c, cx - 3, 260, 5, 3, Wd[3]); r(c, cx - 3, 260, 5, 1, S[4]);
  // Stone shaft.
  oval(c, cx, 278, 16, 7, ink);
  r(c, cx - 16, 266, 33, 12, ink); r(c, cx - 15, 266, 31, 12, S[2]);
  for (let y = 268; y < 280; y += 4) for (let x = cx - 15 + ((y >> 2) & 1) * 3; x < cx + 15; x += 6) { r(c, x, y, 5, 3, S[3]); p(c, x, y, S[4]); r(c, x + 1, y + 2, 4, 1, S[1]); }
  oval(c, cx, 278, 15, 6, S[2]);
  for (let x = cx - 14; x < cx + 14; x += 6) { r(c, x, 277, 5, 3, S[3]); r(c, x, 280, 5, 1, S[1]); }
  r(c, cx - 15, 268, 2, 10, S[4]); r(c, cx + 13, 268, 3, 10, S[1]);
  r(c, cx - 3, 271, 1, 4, ink); p(c, cx - 2, 275, ink); p(c, cx + 6, 280, ink); p(c, cx + 7, 281, ink);
  // Rim and the teal glow rising from the depths.
  oval(c, cx, 266, 17, 6, ink); oval(c, cx, 266, 16, 5, S[3]); oval(c, cx, 265, 15, 4, S[4]);
  oval(c, cx, 266, 13, 4, ink); oval(c, cx, 266, 12, 3, T[1]); oval(c, cx, 267, 9, 2, T[2]); oval(c, cx, 267, 5, 1, T[3]); r(c, cx - 1, 267, 3, 1, T[4]);
  for (const [x, y] of [[cx - 6, 258], [cx + 5, 255], [cx + 10, 261], [cx - 11, 262], [cx + 1, 249]] as const) { p(c, x, y, T[3]); p(c, x, y - 1, T[2]); }
  lights.push({ x: cx, y: 266, rx: 32, ry: 24, rgb: [70, 230, 200], k: 0.38 });
}
function inn(c: C, lights: Light[]) {
  const roofP = ['#4f2a1a', '#7a4426', '#9a5c32', '#bf7c44'];
  shadow(c, 98, 334, 6, 44);
  // Ground floor stone, upper floor timber.
  r(c, 7, 328, 90, 51, ink); r(c, 8, 329, 88, 49, Pl[2]);
  r(c, 8, 329, 88, 1, Pl[1]); r(c, 8, 330, 1, 48, Pl[3]);
  for (const x of [8, 30, 52, 74, 94]) r(c, x, 329, 2, 21, Wd[1]);
  r(c, 8, 348, 88, 3, Wd[1]); r(c, 8, 348, 88, 1, Wd[3]);
  r(c, 8, 351, 88, 27, S[2]);
  for (let y = 352; y < 378; y += 4) for (let x = 8 + ((y >> 2) & 1) * 3; x < 95; x += 6) { r(c, x, y, 5, 3, S[3]); p(c, x, y, S[4]); r(c, x + 1, y + 2, 4, 1, S[1]); }
  for (const x of [15, 37, 59, 81]) win(c, x, 334, 8, 9);
  for (const x of [13, 66, 82]) { win(c, x, 357, 9, 9); r(c, x - 1, 367, 11, 3, ink); r(c, x, 367, 9, 2, Wd[3]); p(c, x + 1, 366, '#d84a5a'); p(c, x + 4, 366, '#e8c84a'); p(c, x + 7, 366, '#d84a5a'); p(c, x + 2, 366, G[4]); p(c, x + 5, 366, G[4]); }
  roof(c, 4, 300, 96, 29, roofP, 6);
  // Dormers.
  for (const x of [28, 66]) { r(c, x - 7, 305, 15, 13, ink); r(c, x - 6, 309, 13, 8, Pl[2]); spire(c, x, 301, 309, 8, ink); spire(c, x, 302, 308, 7, roofP[2]); spire(c, x - 1, 303, 308, 3, roofP[3]); win(c, x - 3, 310, 6, 6); }
  // Chimney.
  r(c, 82, 290, 9, 14, ink); r(c, 83, 291, 7, 13, S[2]); r(c, 83, 291, 2, 13, S[4]); r(c, 82, 289, 9, 3, ink); r(c, 83, 290, 7, 1, S[3]);
  // Door with warm interior.
  r(c, 37, 355, 16, 24, ink); r(c, 38, 357, 14, 22, L[1]); r(c, 39, 358, 12, 10, L[2]); r(c, 40, 359, 5, 6, L[3]);
  r(c, 37, 354, 16, 3, Wd[3]); r(c, 37, 354, 16, 1, Wd[5]);
  r(c, 51, 359, 2, 20, Wd[2]);
  // Bed sign on a bracket.
  r(c, 96, 336, 10, 2, ink); r(c, 97, 336, 8, 1, Wd[4]); r(c, 98, 338, 1, 3, ink); r(c, 104, 338, 1, 3, ink);
  r(c, 94, 340, 15, 11, ink); r(c, 95, 341, 13, 9, Wd[4]); r(c, 95, 341, 13, 1, Wd[5]);
  r(c, 96, 345, 11, 3, '#b8443a'); r(c, 96, 344, 4, 2, '#f2ead0'); r(c, 96, 348, 1, 2, Wd[1]); r(c, 106, 345, 1, 5, Wd[1]); r(c, 100, 345, 7, 1, '#d8604e');
  // Bench + barrel.
  r(c, 58, 372, 16, 3, ink); r(c, 59, 372, 14, 1, Wd[4]); r(c, 59, 375, 2, 3, ink); r(c, 71, 375, 2, 3, ink);
  oval(c, 102, 370, 5, 7, ink); oval(c, 102, 370, 4, 6, Wd[3]); r(c, 98, 367, 9, 1, S[1]); r(c, 98, 373, 9, 1, S[1]); r(c, 99, 365, 2, 9, Wd[4]);
  lights.push({ x: 45, y: 378, rx: 30, ry: 16, rgb: [255, 170, 80], k: 0.3 });
  lights.push({ x: 52, y: 352, rx: 52, ry: 22, rgb: [255, 170, 80], k: 0.12 });
}
function lodge(c: C, lights: Light[]) {
  const thatch = ['#2f3620', '#4a5430', '#64703e', '#828c50'];
  shadow(c, 206, 340, 6, 38);
  // Log walls.
  r(c, 123, 336, 83, 43, ink);
  for (let y = 337; y < 378; y += 4) { r(c, 124, y, 81, 4, Wd[3]); r(c, 124, y, 81, 1, Wd[4]); r(c, 124, y + 3, 81, 1, Wd[1]); }
  for (const x of [122, 202]) for (let y = 337; y < 378; y += 4) { r(c, x, y, 5, 4, ink); r(c, x + 1, y, 3, 3, '#c49a62'); p(c, x + 2, y + 1, Wd[3]); }
  for (const x of [133, 186]) win(c, x, 345, 9, 8);
  // Thatch roof with ragged eaves.
  trap(c, 132, 196, 312, 117, 211, 338, ink);
  trap(c, 133, 195, 313, 118, 210, 336, thatch[1]);
  for (let y = 315; y < 336; y += 3) { const t = (y - 313) / 23, a = Math.round(133 - 15 * t), b = Math.round(195 + 15 * t); for (let x = a; x <= b; x += 2) p(c, x + ((y / 3) & 1), y, thatch[0]); }
  trap(c, 133, 140, 313, 118, 128, 336, thatch[2]);
  r(c, 133, 313, 63, 1, thatch[3]);
  for (let x = 118; x < 211; x += 3) { r(c, x, 336, 2, 2 + (x % 4 === 0 ? 1 : 0), thatch[1]); p(c, x, 338 + (x % 4 === 0 ? 1 : 0), ink); }
  // Stone chimney.
  r(c, 186, 300, 10, 18, ink); r(c, 187, 301, 8, 17, S[2]); r(c, 187, 301, 2, 17, S[4]); r(c, 187, 306, 8, 1, S[1]); r(c, 187, 311, 8, 1, S[1]); r(c, 186, 299, 10, 3, ink); r(c, 187, 300, 8, 1, S[3]);
  // Door and antler trophy.
  r(c, 156, 352, 16, 27, ink); r(c, 157, 353, 14, 26, Wd[1]); for (let x = 158; x < 171; x += 3) r(c, x, 353, 1, 26, Wd[0]); r(c, 157, 353, 14, 1, Wd[3]); p(c, 168, 366, B[2]);
  r(c, 160, 341, 8, 8, ink); r(c, 161, 342, 6, 6, '#c49a62'); r(c, 162, 346, 4, 2, '#e4d2a8'); p(c, 162, 344, ink); p(c, 165, 344, ink);
  const bone = '#e4d8b4';
  for (const d of [-1, 1]) {
    const bx = d < 0 ? 160 : 167;
    for (let i = 0; i < 9; i++) { p(c, bx + d * i, 341 - Math.floor(i * 0.9), bone); p(c, bx + d * i, 342 - Math.floor(i * 0.9), ink); }
    for (const [ox, len] of [[3, 3], [6, 4], [8, 3]]) for (let j = 0; j < len; j++) p(c, bx + d * ox, 340 - Math.floor(ox * 0.9) - j - 1, bone);
  }
  // Pelt drying rack.
  r(c, 207, 344, 1, 32, ink); r(c, 213, 344, 1, 32, ink); r(c, 206, 344, 9, 2, ink); r(c, 207, 344, 7, 1, Wd[4]);
  r(c, 207, 346, 7, 14, ink); r(c, 208, 347, 5, 12, '#8a5e3a'); r(c, 208, 347, 2, 12, '#a87a4e'); p(c, 207, 360, ink); p(c, 213, 360, ink);
  // Firewood stack + axe in the stump.
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) { const x = 136 + i * 5 + row * 2, y = 372 - row * 4; r(c, x, y, 5, 4, ink); r(c, x + 1, y + 1, 3, 2, '#c49a62'); p(c, x + 2, y + 1, Wd[3]); }
  oval(c, 185, 375, 5, 2, ink); r(c, 181, 371, 9, 4, Wd[2]); oval(c, 185, 371, 4, 1, '#c49a62'); r(c, 186, 364, 1, 7, Wd[4]); r(c, 186, 363, 4, 3, ink); r(c, 187, 364, 2, 1, S[5]);
  lights.push({ x: 164, y: 378, rx: 24, ry: 12, rgb: [255, 170, 80], k: 0.16 });
  lights.push({ x: 164, y: 350, rx: 46, ry: 18, rgb: [255, 170, 80], k: 0.08 });
}
function campfireBase(c: C, lights: Light[]) {
  // Log benches around the fire (the flames are an animated overlay).
  r(c, 82, 247, 16, 5, ink); r(c, 83, 248, 14, 3, Wd[3]); r(c, 83, 248, 14, 1, Wd[4]); r(c, 82, 248, 2, 3, '#c49a62');
  r(c, 118, 247, 16, 5, ink); r(c, 119, 248, 14, 3, Wd[3]); r(c, 119, 248, 14, 1, Wd[4]); r(c, 132, 248, 2, 3, '#c49a62');
  oval(c, 108, 258, 10, 4, ink);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = Math.round(108 + Math.cos(a) * 9), y = Math.round(258 + Math.sin(a) * 3.5); r(c, x - 1, y - 1, 3, 2, i < 6 ? S[3] : S[4]); p(c, x - 1, y - 1, S[5]); }
  oval(c, 108, 258, 6, 2, '#2a1a12'); r(c, 103, 257, 11, 2, Wd[1]); r(c, 104, 257, 9, 1, Wd[3]); oval(c, 108, 258, 3, 1, L[1]);
  lights.push({ x: 108, y: 254, rx: 52, ry: 36, rgb: [255, 150, 60], k: 0.42 });
}

// ---------------------------------------------------------------- lighting
function shade(c: C, lights: Light[]) {
  const img = c.getImageData(0, 0, TOWN_W, TOWN_H), d = img.data;
  // Night falloff toward the frame edges (bands, ordered-dithered).
  for (let y = 0; y < TOWN_H; y++) for (let x = 0; x < TOWN_W; x++) {
    const dx = (x - TOWN_W / 2) / (TOWN_W * 0.62), dy = (y - TOWN_H * 0.55) / (TOWN_H * 0.62), dist = Math.sqrt(dx * dx + dy * dy);
    const q = Math.floor(Math.max(0, dist - 0.55) * 8 + bayer(x, y)) / 8;
    if (q <= 0 || y < 52) continue;
    const i = (y * TOWN_W + x) * 4, k = 1 - Math.min(0.55, q * 0.9);
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k * 1.03;
  }
  for (const lt of lights) {
    const x0 = Math.max(0, Math.floor(lt.x - lt.rx)), x1 = Math.min(TOWN_W - 1, Math.ceil(lt.x + lt.rx));
    const y0 = Math.max(0, Math.floor(lt.y - lt.ry)), y1 = Math.min(TOWN_H - 1, Math.ceil(lt.y + lt.ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - lt.x) / lt.rx, dy = (y + 0.5 - lt.y) / lt.ry, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= 1) continue;
      const q = Math.floor((1 - dist) * 4 + bayer(x, y)) / 4;
      if (q <= 0) continue;
      const a = q * lt.k, i = (y * TOWN_W + x) * 4;
      for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.min(255, d[i + ch] * (1 + a * 1.4 * lt.rgb[ch] / 255) + lt.rgb[ch] * a * 0.35);
    }
  }
  c.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- public API
export function townSceneCanvas(): HTMLCanvasElement {
  const { el, c } = mk(TOWN_W, TOWN_H);
  const rnd = seeded(0xe4b3);
  const lights: Light[] = [];
  sky(c, rnd); mountains(c, rnd); forestBack(c, rnd);
  ground(c, rnd); stream(c, rnd); paths(c, rnd); palisade(c);
  // Depth-sorted props and buildings (by footprint y).
  const ops: [number, () => void][] = [
    [84, () => gate(c, lights)], [128, () => archive(c, lights)], [141, () => chapel(c, lights)],
    [206, () => hall(c, lights)], [206, () => guild(c, lights)], [258, () => campfireBase(c, lights)],
    [288, () => merchant(c, lights)], [288, () => well(c, lights)], [379, () => inn(c, lights)], [379, () => lodge(c, lights)],
    [100, () => lantern(c, 94, 100, lights)], [100, () => lantern(c, 123, 100, lights)],
    [190, () => lantern(c, 94, 190, lights)], [190, () => lantern(c, 123, 190, lights)],
    [300, () => lantern(c, 70, 300, lights)], [300, () => lantern(c, 147, 300, lights)],
  ];
  const frame: [number, number, number, 'pine' | 'tree'][] = [
    [74, 90, 22, 'pine'], [142, 92, 20, 'pine'], [4, 150, 20, 'pine'], [212, 152, 18, 'pine'],
    [86, 160, 9, 'tree'], [132, 166, 8, 'tree'], [4, 228, 9, 'tree'], [212, 230, 10, 'tree'],
    [80, 222, 7, 'tree'], [140, 226, 7, 'tree'], [0, 310, 18, 'pine'], [214, 306, 18, 'pine'],
  ];
  for (const [x, y, s, kind] of frame) ops.push([y, () => kind === 'pine' ? pine(c, x, y, s) : tree(c, x, y, s)]);
  for (const [x, y, w] of [[60, 140, 5], [150, 128, 4], [84, 214, 5], [130, 214, 5], [64, 296, 4], [150, 296, 4], [132, 118, 3]] as const) ops.push([y, () => bush(c, x, y, w)]);
  ops.sort((a, b) => a[0] - b[0]).forEach(([, draw]) => draw());
  // Fireflies drifting over the grass.
  for (const [x, y] of [[58, 92], [44, 148], [140, 124], [88, 228], [134, 232], [22, 222], [198, 222], [64, 302], [150, 104], [30, 216], [196, 142], [126, 292], [6, 196]] as const) {
    p(c, x, y, '#e8f7a0'); lights.push({ x: x + 0.5, y: y + 0.5, rx: 4, ry: 4, rgb: [190, 255, 120], k: 0.25 });
  }
  shade(c, lights);
  return el;
}

/** Animated flames for the plaza campfire: 16×24, transparent, frame % 4. */
export function campfireCanvas(frame: number): HTMLCanvasElement {
  const { el, c } = mk(16, 24);
  const f = ((frame % 4) + 4) % 4;
  const heights = [[9, 17, 11], [12, 15, 9], [8, 19, 12], [11, 16, 8]][f], sway = [0, 1, 0, -1][f];
  const base = 22;
  const tongue = (cx: number, h: number, hw: number, col: string, lean: number) => {
    for (let y = base - h; y <= base; y++) {
      const t = (y - (base - h)) / h, w = Math.max(0, Math.round(hw * Math.min(1, t * 1.6)) - (t > 0.85 ? 1 : 0));
      const off = Math.round(lean * (1 - t) * 2);
      r(c, cx - w + off, y, w * 2 + 1, 1, col);
    }
  };
  const layers: [string, number, number][] = [['#7a1e18', 0, 0], [L[1], 1, 2], [L[2], 2, 4], [L[3], 3, 7]];
  for (const [col, shrink, cut] of layers) {
    tongue(4, heights[0] - cut, 3 - shrink + (shrink > 2 ? 1 : 0), col, -sway - 1);
    tongue(8, heights[1] - cut, 4 - shrink, col, sway);
    tongue(11, heights[2] - cut, 3 - shrink + (shrink > 2 ? 1 : 0), col, sway + 1);
  }
  r(c, 5, 20, 7, 2, L[3]); r(c, 6, 21, 5, 1, L[4]); p(c, 8, 19, L[4]);
  const sparks = [[[2, 6], [13, 3], [9, 1]], [[12, 5], [4, 2], [7, 0]], [[3, 3], [11, 7], [10, 1]], [[13, 4], [5, 5], [6, 1]]][f];
  for (const [x, y] of sparks) p(c, x, y, y < 3 ? L[2] : L[3]);
  return el;
}

/** Chimney smoke puffs: 16×32, transparent, frame % 4 (seamless loop — each frame rises 2px, puffs are 8px apart). */
export function smokeCanvas(frame: number): HTMLCanvasElement {
  const { el, c } = mk(SMOKE_SIZE.w, SMOKE_SIZE.h);
  const f = ((frame % 4) + 4) % 4;
  for (let i = 0; i < 4; i++) {
    const rise = i * 8 + f * 2, y = 28 - rise, t = rise / 32, rad = 2 + Math.round(t * 3), x = 6 + Math.round(t * 3 + Math.sin(rise / 5));
    c.globalAlpha = 0.85 * (1 - t);
    oval(c, x, y, rad, rad - 1, '#5f6979'); oval(c, x - 1, y - 1, rad - 1, Math.max(1, rad - 2), '#8d98a6'); p(c, x - rad + 1, y - rad + 2, '#b3bcc7');
  }
  c.globalAlpha = 1;
  return el;
}

const pct = (v: number, of: number) => Math.round(v / of * 1000) / 10;
const box = (id: string, target: Target, x0: number, y0: number, x1: number, y1: number, sx: number, sy: number): TownHotspot =>
  ({ id, target, x: pct(x0, TOWN_W), y: pct(y0, TOWN_H), w: pct(x1 - x0, TOWN_W), h: pct(y1 - y0, TOWN_H), signX: pct(sx, TOWN_W), signY: pct(sy, TOWN_H) });

/** Tappable building rectangles (percent of the scene) and their name-plate anchors (percent, sign center). */
export const TOWN_HOTSPOTS: ReadonlyArray<TownHotspot> = [
  box('gate', { facility: 'campaign' }, 76, 12, 140, 86, 108, 92),
  box('chapel', { action: 'journal' }, 150, 0, 212, 142, 190, 74),
  box('archive', { facility: 'bestiary' }, 4, 60, 72, 134, 38, 140),
  box('hall', { facility: 'party' }, 2, 148, 84, 212, 40, 218),
  box('guild', { facility: 'quests' }, 136, 146, 214, 212, 176, 218),
  box('merchant', { facility: 'challenge-shop' }, 2, 232, 72, 292, 36, 298),
  box('well', { facility: 'endless' }, 146, 232, 212, 292, 180, 298),
  box('inn', { action: 'profiles' }, 2, 294, 104, 384, 50, 322),
  box('lodge', { facility: 'raid' }, 114, 296, 214, 384, 164, 326),
];

/** Where the party stands (percent): the open plaza just in front of the campfire. */
export const PLAZA = { x: 50, y: pct(272, TOWN_H) };
/** Campfire overlay anchor (percent, bottom-center of the 16×24 flame sprite). */
export const CAMPFIRE = { x: pct(108, TOWN_W), y: pct(259, TOWN_H), w: 16, h: 24 };
/** Chimney smoke overlay anchors (percent, bottom-center of the SMOKE_SIZE smoke sprite). */
export const CHIMNEYS: ReadonlyArray<{ x: number; y: number }> = [
  { x: pct(86.5, TOWN_W), y: pct(290, TOWN_H) },
  { x: pct(191, TOWN_W), y: pct(300, TOWN_H) },
  { x: pct(49, TOWN_W), y: pct(146, TOWN_H) },
];
