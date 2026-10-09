// Procedural 16×16 pixel icons for equipment slots, tinted by rarity.
export type ItemSlot = 'weapon' | 'armor' | 'charm';
export const RARITY_COLORS: Record<string, string> = { common: '#c9d3c0', uncommon: '#84e0a0', rare: '#87c5e8', epic: '#c7a2f0' };
const SHAPES: Record<ItemSlot, string[]> = {
  weapon: [
    '.............hh.',
    '............hmh.',
    '...........hmh..',
    '..........hmh...',
    '.........hmh....',
    '........hmh.....',
    '.......hmh......',
    '..g...hmh.......',
    '..gg.hmh........',
    '...gghh.........',
    '....gg..........',
    '...gwgg.........',
    '..gw..gg........',
    '.ww....g........',
    '.w..............',
    '................',
  ],
  armor: [
    '................',
    '..hh........hh..',
    '.hmmh......hmmh.',
    '.hmmmhhhhhhmmmh.',
    '.hmmmmmmmmmmmmh.',
    '..hmmmmggmmmmh..',
    '...hmmmggmmmh...',
    '...hmmmmmmmmh...',
    '...hmmmggmmmh...',
    '...hmmmggmmmh...',
    '...hmmmmmmmmh...',
    '...hwwwwwwwwh...',
    '...hmmmmmmmmh...',
    '....hhhhhhhh....',
    '................',
    '................',
  ],
  charm: [
    '.....w....w.....',
    '....w......w....',
    '...w........w...',
    '...w........w...',
    '....w......w....',
    '.....w....w.....',
    '......gggg......',
    '.....gmmmmg.....',
    '....gmhhmmmg....',
    '....gmhmmmmg....',
    '....gmmmmmmg....',
    '....gmmmmmmg....',
    '.....gmmmmg.....',
    '......gggg......',
    '................',
    '................',
  ],
};
const cache = new Map<string, string>();
export function itemIcon(slot: ItemSlot, rarity = 'common', empty = false): string {
  const key = `${slot}-${rarity}-${empty}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const c = canvas.getContext('2d')!;
  const main = empty ? '#3d5648' : RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
  const palette: Record<string, string> = empty
    ? { h: '#4e6650', m: '#2d4538', g: '#3d5648', w: '#4e6650' }
    : { h: '#fff8e0', m: main, g: '#e5c687', w: '#9c824c' };
  SHAPES[slot].forEach((row, y) => [...row].forEach((ch, x) => { if (palette[ch]) { c.fillStyle = palette[ch]; c.fillRect(x, y, 1, 1); } }));
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
