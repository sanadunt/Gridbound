import { EN } from './en';
import { ID } from './id';
import type { LockReason } from '../game/profile';

export type Lang = 'en' | 'id';
export type StringKey = keyof typeof EN;
export const LANG_KEY = 'gridbound.lang';
const TABLES: Record<Lang, Record<StringKey, string>> = { en: EN, id: ID };
const listeners = new Set<(lang: Lang) => void>();

function detect(): Lang {
  try { const stored = localStorage.getItem(LANG_KEY); if (stored === 'en' || stored === 'id') return stored; } catch { /* storage blocked */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en';
}
let current: Lang = typeof window === 'undefined' ? 'en' : detect();

export const lang = () => current;
export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  try { localStorage.setItem(LANG_KEY, next); } catch { /* session only */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach(listener => listener(next));
}
export const onLangChange = (listener: (lang: Lang) => void) => { listeners.add(listener); return () => listeners.delete(listener); };

// Numbers follow the chosen game language, never the browser locale: EN 3,000 · 4.2 — ID 3.000 · 4,2.
const locale = () => current === 'id' ? 'id-ID' : 'en-US';
const formats = new Map<string, Intl.NumberFormat>();
const numberFormat = (min: number, max: number) => {
  const key = `${locale()}:${min}:${max}`;
  let format = formats.get(key);
  if (!format) formats.set(key, format = new Intl.NumberFormat(locale(), { minimumFractionDigits: min, maximumFractionDigits: max }));
  return format;
};
/** A whole number with the language's digit grouping (rounded). */
export const fmtInt = (n: number) => numberFormat(0, 0).format(Math.round(n));
/** A number with exactly `digits` decimals and the language's decimal mark. */
export const fmtDec = (n: number, digits = 1) => numberFormat(digits, digits).format(n);
/** Seconds with the language's unit: EN '4.2s', ID '4,2d'. */
export const fmtSec = (n: number, digits = 1) => `${fmtDec(n, digits)}${TABLES[current]['unit.s']}`;
/** Names joined in the language's style: EN 'Lyra and Rowan' · ID 'Lyra dan Rowan'. */
export const fmtList = (items: string[]) => new Intl.ListFormat(locale(), { type: 'conjunction' }).format(items);
/** A date and time in the language's style. */
export const fmtDateTime = (ms: number) => new Date(ms).toLocaleString(locale());
/** A number as t() prints it: grouped, up to two decimals. */
const fmtNum = (n: number) => numberFormat(0, 2).format(n);

const plurals = new Map<string, Intl.PluralRules>();
const pluralRules = () => { let rules = plurals.get(locale()); if (!rules) plurals.set(locale(), rules = new Intl.PluralRules(locale())); return rules; };

/**
 * Translate a UI string. `{name}` placeholders are replaced from `vars` (numbers are formatted for the language).
 * `{n|chapter|chapters}` picks the word form for the number in `n` (Intl.PluralRules: 'one' takes the first form);
 * Indonesian has no plural forms, so id.ts simply writes the base word.
 */
export function t(key: StringKey, vars: Record<string, string | number> = {}) {
  const text = TABLES[current][key] ?? EN[key] ?? key;
  return text.replace(/\{(\w+)((?:\|[^|{}]*)+)?\}/g, (whole, name: string, forms?: string) => {
    if (!(name in vars)) return whole;
    const value = vars[name];
    if (forms) { const [one, other = one] = forms.slice(1).split('|'); return pluralRules().select(Number(value)) === 'one' ? one : other; }
    return typeof value === 'number' ? fmtNum(value) : value;
  });
}

/** Player-facing text for a failure from a game module: its stable code (an Error's `code`, or the code itself) maps to `error.<code>`; anything else is the generic `error.unknown`. Raw messages belong in console logs only. */
export function errorText(error: unknown) {
  const code = typeof error === 'string' ? error : error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : '';
  const key = `error.${code}`;
  return code && key in EN ? t(key as StringKey) : t('error.unknown');
}

/** Why a talent or gear piece is locked (profile.ts talentReason/gearReason). */
export const lockText = (reason: LockReason) => t(`lock.${reason.code}` as StringKey, { n: reason.n ?? '', name: reason.name ?? '' });
