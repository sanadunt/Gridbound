// 12×12 pixel glyphs for Undercroft rooms and materials (no emoji: the game ships its own fonts only).
import type { DungeonNodeKind } from '../game/dungeon';

const SHAPES: Record<DungeonNodeKind | 'ember-shard' | 'bell-bronze' | 'frost-glass', { rows: string[]; colors: Record<string, string> }> = {
  battle: { colors: { a: '#e8e2c8', b: '#9a7a4a' }, rows: ['a..........a', '.a........a.', '..a......a..', '...a....a...', '....a..a....', '.....aa.....', '.....aa.....', '....a..a....', '..bba..abb..', '..bb....bb..', '.b........b.', 'b..........b'] },
  elite: { colors: { a: '#e8dcc0', b: '#2a1a1a', c: '#d65a4a' }, rows: ['...aaaaaa...', '..aaaaaaaa..', '.aaaaaaaaaa.', '.abbaaaabba.', '.abbaaaabba.', '.aaaaccaaaa.', '..aaaaaaaa..', '...abababa..', '...aaaaaa...', '....a.a.a...', '............', '............'] },
  event: { colors: { a: '#9fd7ff', b: '#3a6a9a' }, rows: ['...aaaaa....', '..aa...aa...', '.aa.....aa..', '.......aa...', '......aa....', '.....aa.....', '.....aa.....', '.....bb.....', '............', '.....aa.....', '.....aa.....', '............'] },
  treasure: { colors: { a: '#e5c687', b: '#7e5a2a', c: '#fff3c0' }, rows: ['............', '..bbbbbbbb..', '.baaaaaaaab.', '.baaaaaaaab.', '.bbbbccbbbb.', '.baaaccaaab.', '.baaaaaaaab.', '.baaaaaaaab.', '.bbbbbbbbbb.', '............', '............', '............'] },
  camp: { colors: { a: '#ffb347', b: '#ffe08a', c: '#7a5232' }, rows: ['.....a......', '....aa......', '....aba.....', '...abbaa....', '...abbba....', '..aabbbaa...', '..abbbbba...', '...aaaaa....', '.cc.....cc..', '..ccc.ccc...', '....ccc.....', '..ccc.ccc...'] },
  guardian: { colors: { a: '#e5c687', b: '#d65a4a', c: '#7e6734' }, rows: ['............', 'a....a....a.', 'aa..aaa..aa.', 'aaa.aaa.aaa.', 'aaaaaaaaaaa.', 'aaaaabaaaaa.', 'aaaabbbaaaa.', 'aaaaabaaaaa.', 'ccccccccccc.', 'ccccccccccc.', '............', '............'] },
  'ember-shard': { colors: { a: '#ff9a5a', b: '#ffd9a0', c: '#9a3a20' }, rows: ['.....c......', '....cac.....', '....cac.....', '...cabac....', '...cabac....', '..cabbbac...', '..caabaac...', '..caaaaac...', '...caaac....', '....cac.....', '.....c......', '............'] },
  'bell-bronze': { colors: { a: '#c08a3e', b: '#ffe0a0', c: '#5a3a18' }, rows: ['.....cc.....', '.....cc.....', '....cccc....', '...caaaac...', '...cabaac...', '..caabaaac..', '..caaaaaac..', '.caaaaaaaac.', '.cccccccccc.', '.....cc.....', '.....cc.....', '............'] },
  'frost-glass': { colors: { a: '#9fe0ff', b: '#e8f8ff', c: '#3a7aa8' }, rows: ['.....c......', '....cbc.....', '...cbac.....', '..cbaaac....', '.cbaaaaac...', 'cbaaaaaaac..', '.caaaaaac...', '..caaaac....', '...caac.....', '....cc......', '............', '............'] },
};
const cache = new Map<string, string>();
export function dungeonIcon(kind: keyof typeof SHAPES): string {
  const hit = cache.get(kind);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = 12; canvas.height = 12;
  const c = canvas.getContext('2d')!;
  const { rows, colors } = SHAPES[kind];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (colors[ch]) { c.fillStyle = colors[ch]; c.fillRect(x, y, 1, 1); } }));
  const url = canvas.toDataURL();
  cache.set(kind, url);
  return url;
}
