import { EN } from './en';
import { ID } from './id';

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

/** Translate a UI string. `{name}` placeholders are replaced from `vars`. */
export function t(key: StringKey, vars: Record<string, string | number> = {}) {
  const text = TABLES[current][key] ?? EN[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => name in vars ? String(vars[name]) : `{${name}}`);
}

/** Strings produced by game modules (validation reasons, storage warnings) are authored in Indonesian; map them to the active language. */
const GAME_TEXT: Record<string, string> = {
  'Gold belum cukup': 'Not enough Gold',
  'Hadiah quest': 'Quest reward',
  'Hero belum direkrut': 'Hero not recruited',
  'Item tidak tersedia': 'Item unavailable',
  'Keystone lain dipilih': 'Another keystone chosen',
  'Khusus class lain': 'Other class only',
  'Perlu kedua cabang sebelumnya': 'Needs both previous branches',
  'Skill point belum cukup': 'Not enough skill points',
  'Sudah dipelajari': 'Already learned',
  'Storage browser tidak tersedia. Progress hanya di tab ini.': 'Browser storage is unavailable. Progress lives only in this tab.',
  'Save v3 rusak. File asli tidak ditimpa; gunakan backup sebelum melanjutkan.': 'The v3 save is corrupted. The original was not overwritten; use a backup before continuing.',
  'Save v3 tidak lengkap atau tidak didukung. Save asli dilindungi dari penimpaan.': 'The v3 save is incomplete or unsupported. The original is protected from overwriting.',
  'Save lama dimigrasikan. Salinan v2 tetap disimpan untuk rollback.': 'Old save migrated. The v2 copy is kept for rollback.',
  'IndexedDB tidak tersedia. Mode session-only aktif; progress tidak bertahan setelah tab ditutup.': 'IndexedDB is unavailable. Session-only mode: progress is lost when the tab closes.',
};
export function gameText(text: string) {
  if (!text || current === 'id') return text;
  if (text in GAME_TEXT) return GAME_TEXT[text];
  const level = /^Perlu hero Lv\.(\d+)$/.exec(text);
  if (level) return `Needs hero LV ${level[1]}`;
  const needs = /^Perlu (.+)$/.exec(text);
  if (needs) return `Requires ${needs[1]}`;
  return text;
}
