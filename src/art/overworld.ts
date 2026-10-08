type C = CanvasRenderingContext2D;
const rect = (c: C, x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
/** Small deterministic PRNG so every act map is identical between sessions. */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

type Biome = { ground: string[]; tree: string[]; accent: string; water: string; path: string; pathEdge: string };
const BIOMES: Biome[] = [
  { ground: ['#2f5a3a', '#35643f', '#2a5034'], tree: ['#14301f', '#1f4a2c', '#2f6b3c'], accent: '#7bd38f', water: '#2f6f86', path: '#c9a66b', pathEdge: '#7a5a35' },
  { ground: ['#4a3a34', '#55423a', '#3f322d'], tree: ['#231816', '#3a2620', '#6a3a2a'], accent: '#e3874f', water: '#6b4f8f', path: '#b9a28a', pathEdge: '#5a4638' },
  { ground: ['#b9cad8', '#c9d8e4', '#a9bccc'], tree: ['#2a3f52', '#3d5a70', '#e9f2f8'], accent: '#7fc7ee', water: '#4f86b8', path: '#8a9cb0', pathEdge: '#5b6b80' },
  { ground: ['#6b5a2f', '#7a6836', '#5e4f2a'], tree: ['#3a2e14', '#5a4a1e', '#e8c45a'], accent: '#ffd75e', water: '#3f7f8f', path: '#f0d9a0', pathEdge: '#8a6a30' },
];

export const MAP_W = 200, MAP_H = 120;

/** Pixel overworld for one act; nodes are given in percent so the HTML pins line up. */
export function overworldCanvas(act: number, nodes: { x: number; y: number }[]) {
  const el = document.createElement('canvas'); el.width = MAP_W; el.height = MAP_H;
  const c = el.getContext('2d')!; c.imageSmoothingEnabled = false;
  const b = BIOMES[act] ?? BIOMES[0], random = rng(97 + act * 131);
  for (let y = 0; y < MAP_H; y += 4) for (let x = 0; x < MAP_W; x += 4) rect(c, x, y, 4, 4, b.ground[Math.floor(random() * b.ground.length)]);
  // River across the map.
  for (let x = 0; x < MAP_W; x++) { const y = Math.round(MAP_H * .82 + Math.sin(x / 17 + act) * 6); rect(c, x, y, 1, 5, b.water); rect(c, x, y, 1, 1, '#ffffff33'); }
  const points = nodes.map(n => ({ x: Math.round(n.x / 100 * MAP_W), y: Math.round(n.y / 100 * MAP_H) }));
  const nearPath = (x: number, y: number) => points.some(p => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 10);
  // Forest clumps, avoiding node clearings.
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(random() * MAP_W), y = Math.floor(random() * MAP_H * .78);
    if (nearPath(x, y)) continue;
    rect(c, x - 2, y + 1, 5, 3, b.tree[0]); rect(c, x - 1, y - 2, 3, 4, b.tree[1]); rect(c, x, y - 3, 1, 2, b.tree[2]);
  }
  // Mountains along the top edge.
  for (let x = -6; x < MAP_W; x += 14) { const h = 8 + Math.floor(random() * 8); for (let row = 0; row < h; row++) rect(c, x + row / 2, row, 14 - row, 1, row < 3 ? b.tree[2] : b.tree[0]); }
  // Stepped road between nodes.
  for (let i = 0; i + 1 < points.length; i++) {
    let { x, y } = points[i]; const to = points[i + 1];
    while (x !== to.x || y !== to.y) {
      rect(c, x - 1, y - 1, 3, 3, b.pathEdge); rect(c, x, y, 2, 2, b.path);
      if (x !== to.x && (y === to.y || random() > .45)) x += Math.sign(to.x - x); else y += Math.sign(to.y - y);
    }
  }
  // Scattered accent flowers / embers.
  for (let i = 0; i < 40; i++) rect(c, Math.floor(random() * MAP_W), Math.floor(random() * MAP_H), 1, 1, b.accent);
  return el;
}
