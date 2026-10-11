/**
 * Indonesian glossary: one word per game term, so the ID text reads as one voice.
 * The glossary test in tests/i18n-ui.test.ts scans id.ts, CONTENT_TEXT.id and the runtime EVENT_TEXT.id for the banned variants.
 *
 * - Act → Babak; the act and chapter NAMES themselves stay English (policy, see content-text.ts).
 * - Potion → Ramuan (one word: buttons, logs, floating text).
 * - Ninefold Dawn → Fajar Sembilan (the ultimate).
 * - Battle → pertarungan in prose ('pertempuran' is not used; the battle tab is 'Arena'). 'Battle Hymn' is a skill name.
 * - Tile → petak, row → baris, Click → Ketuk. 'lane' stays English like the other game terms below.
 * - Threat families: DITANDAI, TANAH, SELURUH GRID, RAPALAN (the counter tags and map/bestiary chips).
 * - The commander is addressed as kamu/-mu. 'kalian' is only for heroes speaking to the party (letters, join lines, scenes).
 */
export type GlossaryRule = { term: string; use: string; banned: RegExp; /** Content/UI keys where the banned form is allowed. */ allow?: RegExp };

export const ID_GLOSSARY: GlossaryRule[] = [
  { term: 'Act', use: 'Babak', banned: /\bacts?\b/i },
  { term: 'Potion', use: 'Ramuan', banned: /\bpotions?\b/i },
  { term: 'Ninefold Dawn', use: 'Fajar Sembilan', banned: /ninefold dawn/i },
  { term: 'Battle', use: 'pertarungan', banned: /\bbattle\b(?! hymn)|\bpertempuran\b|\bfight\b/i },
  { term: 'Tile', use: 'petak', banned: /\btiles?\b/i },
  { term: 'Row', use: 'baris', banned: /\brows?\b/i },
  { term: 'Lane', use: 'lane', banned: /\blajur\b/i },
  { term: 'Chapter', use: 'chapter', banned: /\bbab\b/i },
  { term: 'Click / tap', use: 'ketuk', banned: /\bklik\b/i },
  { term: 'All grid', use: 'seluruh grid', banned: /\ball[- ]grid\b/i },
  { term: 'Marked / ground / channel', use: 'ditandai / tanah / rapalan', banned: /\b(marked|ground|channel)\b/i },
  { term: 'you (the commander)', use: 'kamu / -mu', banned: /\b(kalian|anda)\b/i, allow: /^(dungeon\.letter\.|character\.\d+\.(joinLine|fateLine)$|campaign\.[^.]+\.(intro|outro)$)/ },
];

/** Game terms that stay English in Indonesian text (they appear in buttons, tags and skill texts). */
export const ID_KEEP_ENGLISH = ['skill', 'party', 'cooldown', 'run', 'boss', 'hero', 'lane', 'Guard', 'interrupt', 'shield', 'barrier', 'damage', 'gold', 'Crystal', 'chapter', 'raid', 'build'];
