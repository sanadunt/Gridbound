/**
 * Runtime localisation of game content (EN / ID).
 *
 * The content modules (src/game/*, src/economy/challenge.ts) are the source of
 * truth for data/database.json and must not change, so localisation is applied
 * in place at runtime: `localizeContent(lang)` writes the strings from
 * CONTENT_TEXT into the live content objects. The first call snapshots the
 * original values so switching languages is lossless, and `restoreContent()`
 * puts the source text back.
 *
 * `eventText()` translates strings emitted at runtime by src/game/simulation.ts
 * (banners, floating texts, threat names and counters) plus a few other
 * runtime-composed strings (talent/gear lock reasons, the epilogue lead line).
 */
import { KITS, UPGRADES } from '../game/content';
import { CHARACTERS } from '../game/characters';
import { JOBS, GEAR, GEAR_SETS } from '../game/jobs';
import { TALENTS } from '../game/talents';
import { QUESTS } from '../game/quests';
import { ENEMIES, CAMPAIGN, BOONS } from '../game/world';
import { STORY_CHOICES } from '../game/narrative';
import { D8_ADVANCED_PATHS, D8_THIRD_PATHS, D8_ULTRAS } from '../game/d8-content';
import { CHALLENGE_SHOP, BANK_SHOP, RAID_MODIFIERS, type RaidModifier } from '../economy/challenge';
import { CONTENT_TEXT, type ContentText } from './content-text';

export type ContentLang = 'en' | 'id';
export { CONTENT_TEXT };

type Holder = Record<string | number, unknown>;
type Slot = { owner: Holder; prop: string | number };

const ROOTS: Record<string, unknown> = {
  kit: KITS,
  character: CHARACTERS,
  job: JOBS,
  gear: GEAR,
  gearSet: GEAR_SETS,
  talent: TALENTS,
  quest: QUESTS,
  enemy: ENEMIES,
  campaign: CAMPAIGN,
  boon: BOONS,
  choice: STORY_CHOICES,
  upgrade: UPGRADES,
  d8path: [...D8_ADVANCED_PATHS, ...D8_THIRD_PATHS],
  d8ultra: D8_ULTRAS,
  challengeShop: CHALLENGE_SHOP,
  bankShop: BANK_SHOP,
  raidModifier: RAID_MODIFIERS,
};

const isIndex = (segment: string) => /^\d+$/.test(segment);
function child(node: unknown, segment: string): unknown {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    return isIndex(segment) ? node[Number(segment)] : node.find(item => item && typeof item === 'object' && String((item as { id?: unknown }).id) === segment);
  }
  return Object.hasOwn(node, segment) ? (node as Holder)[segment] : undefined;
}

/**
 * Resolve a CONTENT_TEXT key to the object and property holding its string.
 * A numeric segment indexes an array; any other segment on an array selects the
 * element with that `id`. Returns undefined when the path is not a string field.
 */
export function resolveContentKey(key: string): Slot | undefined {
  const segments = key.split('.');
  if (segments.length < 2) return undefined;
  let node: unknown = ROOTS[segments[0]];
  for (const segment of segments.slice(1, -1)) node = child(node, segment);
  if (!node || typeof node !== 'object') return undefined;
  const last = segments[segments.length - 1];
  const prop = Array.isArray(node) ? (isIndex(last) ? Number(last) : undefined) : last;
  if (prop === undefined || !Object.hasOwn(node, prop) || typeof (node as Holder)[prop] !== 'string') return undefined;
  return { owner: node as Holder, prop };
}

const slots = new Map<string, Slot | null>();
function slotFor(key: string): Slot | undefined {
  if (!slots.has(key)) slots.set(key, resolveContentKey(key) ?? null);
  return slots.get(key) ?? undefined;
}

let originals: Map<string, string> | undefined;
let active: ContentLang | undefined;

function snapshot(): Map<string, string> {
  if (!originals) {
    originals = new Map();
    for (const key of Object.keys(CONTENT_TEXT)) {
      const slot = slotFor(key);
      if (slot) originals.set(key, slot.owner[slot.prop] as string);
    }
  }
  return originals;
}

function write(slot: Slot, value: string) {
  // RAID_MODIFIERS entries are frozen; use contentText()/localizedRaidModifier() for them.
  if (Object.isFrozen(slot.owner) || slot.owner[slot.prop] === value) return;
  slot.owner[slot.prop] = value;
}

/** Write the strings for `lang` into the live content objects. Idempotent. */
export function localizeContent(lang: ContentLang): void {
  snapshot();
  for (const [key, text] of Object.entries(CONTENT_TEXT)) {
    const slot = slotFor(key);
    if (slot) write(slot, text[lang]);
  }
  active = lang;
}

/** Put back the source text captured by the first localizeContent() call. */
export function restoreContent(): void {
  if (!originals) return;
  for (const [key, value] of originals) {
    const slot = slotFor(key);
    if (slot) write(slot, value);
  }
  active = undefined;
}

/** The language last applied by localizeContent(), or undefined for source text. */
export const contentLang = (): ContentLang | undefined => active;

/** Localised text for a CONTENT_TEXT key; falls back to the source value. */
export function contentText(key: string, lang: ContentLang): string | undefined {
  const text = CONTENT_TEXT[key];
  if (text) return text[lang];
  if (originals?.has(key)) return originals.get(key);
  const slot = slotFor(key);
  return slot ? slot.owner[slot.prop] as string : undefined;
}

/** RAID_MODIFIERS are frozen, so they cannot be localised in place. */
export function localizedRaidModifier(modifier: RaidModifier, lang: ContentLang): RaidModifier {
  return {
    ...modifier,
    name: contentText(`raidModifier.${modifier.id}.name`, lang) ?? modifier.name,
    description: contentText(`raidModifier.${modifier.id}.description`, lang) ?? modifier.description,
  };
}

// ---------------------------------------------------------------------------
// Runtime event text (simulation.ts banners, floating texts, threats).

const EVENT_TEXT: ContentText[] = [
  // Threat names (Battle.telegraph). EMERALD CATACLYSM is Vharok's named attack and stays as is.
  { en: 'HUNT THE WOUNDED', id: 'BURU YANG TERLUKA' },
  { en: 'BREAK THE STRONG', id: 'PATAHKAN YANG KUAT' },
  { en: 'CRUSHING FRONT', id: 'HANTAMAN GARIS DEPAN' },
  { en: 'LANE ERUPTION', id: 'ERUPSI LANE' },
  { en: 'WORLDLESS RITUAL', id: 'RITUAL TANPA DUNIA' },
  { en: 'VENOM WEB', id: 'JARING BISA' },
  { en: 'FALLING SHARDS', id: 'HUJAN SERPIHAN' },
  { en: 'AFTERSHOCK', id: 'GEMPA SUSULAN' },
  // Item and party banners.
  { en: 'MENDING MIST', id: 'KABUT PEMULIH' },
  { en: 'NINEFOLD DAWN', id: 'FAJAR SEMBILAN' },
  { en: 'SYNC!', id: 'SINKRON!' },
  // Threat counters.
  { en: 'MARKED: follows the hero. Heal the target, ready a shield or Party Guard.', id: 'MARKED: mengikuti hero. Heal target, siapkan shield atau Party Guard.' },
  { en: 'GROUND: leave the marked row once the telegraph appears.', id: 'GROUND: keluar dari row yang ditandai setelah telegraph muncul.' },
  { en: 'GROUND: move to another lane. The impact zone does not follow heroes.', id: 'GROUND: pindah ke lane lain. Lokasi impact tidak mengikuti hero.' },
  { en: "ALL GRID: Guard just before impact (G) or cast an interrupt skill. Changing tiles won't help.", id: 'ALL GRID: Guard menjelang impact (G) atau cast skill interrupt. Pindah tile tidak membantu.' },
  { en: 'GROUND: move heroes to safe tiles. The markers stay on the ground.', id: 'GROUND: pindahkan hero ke tile aman. Tanda tetap di tanah.' },
  { en: "GROUND: a delayed second blast. Don't rush back onto this tile.", id: 'GROUND: ledakan kedua tertunda. Jangan buru-buru kembali ke tile ini.' },
  // Banners and floating texts.
  { en: 'FORMATION', id: 'FORMASI' },
  { en: 'PARTY GUARD · 65% REDUCTION', id: 'PARTY GUARD · REDUKSI 65%' },
  { en: 'REINFORCEMENTS', id: 'BALA BANTUAN' },
  { en: 'RITUAL INTERRUPTED', id: 'RITUAL TERPUTUS' },
  { en: 'ARMOR BREAK · +60% DMG', id: 'ZIRAH HANCUR · +60% DMG' },
  { en: 'BLOCK', id: 'TANGKIS' },
  { en: 'NOT YET', id: 'BELUM SAATNYA' },
  // Battle.stageName outside the campaign (shown raw and upper-cased as the start banner).
  { en: 'Practice arena · no Crystal', id: 'Arena latihan · tanpa Crystal' },
  { en: 'Raid contract', id: 'Kontrak raid' },
  // narrative.ts epilogue() lead line.
  { en: 'The machine stops. Vharok is free. Eda chooses a name of their own. The town builds its protection together; they do not get back everything that was lost.', id: 'Mesin berhenti. Vharok bebas. Eda memilih namanya sendiri. Kota membangun perlindungan bersama; mereka tidak mendapatkan kembali semua yang hilang.' },
  // profile.ts talentReason() / gearReason().
  { en: 'Hero not yet recruited', id: 'Hero belum direkrut' },
  { en: 'Already learned', id: 'Sudah dipelajari' },
  { en: 'Restricted to another class', id: 'Khusus class lain' },
  { en: 'Requires both previous branches', id: 'Perlu kedua cabang sebelumnya' },
  { en: 'Another keystone is already chosen', id: 'Keystone lain dipilih' },
  { en: 'Not enough skill points', id: 'Skill point belum cukup' },
  { en: 'Not enough Gold', id: 'Gold belum cukup' },
  { en: 'Item unavailable', id: 'Item tidak tersedia' },
  { en: 'Quest reward', id: 'Hadiah quest' },
];

type EventPattern = { en: RegExp; id: RegExp; text: Record<ContentLang, (...groups: string[]) => string> };
const EVENT_PATTERNS: EventPattern[] = [
  { en: /^(.+) · PHASE (\d+)$/i, id: /^(.+) · FASE (\d+)$/i, text: { en: (name, n) => `${name} · PHASE ${n}`, id: (name, n) => `${name} · FASE ${n}` } },
  { en: /^Descent (\d+)$/i, id: /^Kedalaman (\d+)$/i, text: { en: n => `Descent ${n}`, id: n => `Kedalaman ${n}` } },
  { en: /^Recruit (\d+)$/i, id: /^Rekrutan (\d+)$/i, text: { en: n => `Recruit ${n}`, id: n => `Rekrutan ${n}` } },
  { en: /^Requires hero Lv\.(\d+)$/, id: /^Perlu hero Lv\.(\d+)$/, text: { en: n => `Requires hero Lv.${n}`, id: n => `Perlu hero Lv.${n}` } },
  { en: /^Requires (.+)$/, id: /^Perlu (.+)$/, text: { en: name => `Requires ${name}`, id: name => `Perlu ${name}` } },
  {
    en: /^Commander storage failed \((.*)\)\. Session-only mode is active; do not treat autosave as permanent\.$/,
    id: /^Penyimpanan Commander gagal \((.*)\)\. Mode session-only aktif; jangan anggap autosave permanen\.$/,
    text: {
      en: detail => `Commander storage failed (${detail}). Session-only mode is active; do not treat autosave as permanent.`,
      id: detail => `Penyimpanan Commander gagal (${detail}). Mode session-only aktif; jangan anggap autosave permanen.`,
    },
  },
];

// Content strings that also surface through the simulation (stage name banner,
// enemy title) or composed runtime text (epilogue choice lines).
const EVENT_CONTENT_KEY = /^(campaign\.[^.]+\.stages\.\d+\.name|enemy\.[^.]+\.title|choice\.[^.]+\.(title|options\.[^.]+\.outcome))$/;

let exact: Map<string, ContentText> | undefined;
let upper: Map<string, ContentText> | undefined;
function lookups() {
  if (!exact || !upper) {
    exact = new Map();
    upper = new Map();
    const pairs = [...EVENT_TEXT, ...Object.entries(CONTENT_TEXT).filter(([key]) => EVENT_CONTENT_KEY.test(key)).map(([, text]) => text)];
    for (const pair of pairs) {
      for (const text of [pair.en, pair.id]) {
        if (!exact.has(text)) exact.set(text, pair);
        if (!upper.has(text.toUpperCase())) upper.set(text.toUpperCase(), pair);
      }
    }
  }
  return { exact, upper };
}

const isUpper = (text: string) => text === text.toUpperCase() && text !== text.toLowerCase();

/**
 * Translate a runtime string emitted by the simulation (or another runtime
 * text source listed above) into `lang`. Accepts text in either language;
 * unknown text is returned unchanged.
 */
export function eventText(text: string, lang: ContentLang): string {
  if (typeof text !== 'string' || !text) return text;
  const { exact, upper } = lookups();
  const direct = exact.get(text);
  if (direct) return direct[lang];
  if (isUpper(text)) {
    const shouted = upper.get(text);
    if (shouted) return shouted[lang].toUpperCase();
  }
  for (const pattern of EVENT_PATTERNS) {
    const match = pattern.en.exec(text) ?? pattern.id.exec(text);
    if (!match) continue;
    const result = pattern.text[lang](...match.slice(1));
    return isUpper(text) ? result.toUpperCase() : result;
  }
  // Epilogue choice cards: `${choice.title}: ${option.outcome}`.
  const split = text.indexOf(': ');
  if (split > 0) {
    const title = exact.get(text.slice(0, split));
    const outcome = exact.get(text.slice(split + 2));
    if (title && outcome) return `${title[lang]}: ${outcome[lang]}`;
  }
  return text;
}
