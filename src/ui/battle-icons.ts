// Battle HUD icons (P2): small inline SVGs drawn with currentColor, so the tray, the view tabs and the threat panel read at a glance
// (Hades-style: big icons, little text). Pure strings, no asset files; every button that shows one keeps its name in aria-label/title.
const svg = (body: string, size = 24) => `<svg class="hud-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICONS = {
  /** Party Guard: a kite shield. */
  guard: svg('<path d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5z" fill="currentColor" fill-opacity=".22"/><path d="M12 7v10M8 11h8"/>'),
  /** Potion: a round flask. */
  potion: svg('<path d="M9 2h6M10 2v5L5.5 14.5a5 5 0 0 0 4.3 7.5h4.4a5 5 0 0 0 4.3-7.5L14 7V2"/><path d="M7 15h10" /><path d="M7.4 15.5a5 5 0 0 0 4.6 5.5 5 5 0 0 0 4.6-5.5z" fill="currentColor" fill-opacity=".35" stroke="none"/>'),
  /** Ninefold Dawn: a rising sun with nine rays. */
  dawn: svg(`<circle cx="12" cy="14" r="4" fill="currentColor" fill-opacity=".3"/><path d="M2 20h20"/>${Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (i / 8), x1 = 12 - Math.cos(a) * 6.5, y1 = 14 - Math.sin(a) * 6.5, x2 = 12 - Math.cos(a) * 9.5, y2 = 14 - Math.sin(a) * 9.5; return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`; }).join('')}`),
  /** The arena view: crossed swords. */
  arena: svg('<path d="m4 4 10 10M4 4v4M4 4h4M20 4 10 14M20 4v4M20 4h-4M8 16l-3 3M16 16l3 3M7 13l4 4M17 13l-4 4"/>', 22),
  /** The Status view: a hero bust with a heart. */
  status: svg('<circle cx="9" cy="7" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M17.5 10.5c-1-1-2.6-.4-2.6 1 0 1.6 2.6 3 2.6 3s2.6-1.4 2.6-3c0-1.4-1.6-2-2.6-1z" fill="currentColor"/>', 22),
  /** The Log view: a scroll. */
  log: svg('<path d="M6 3h11a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-1h11v1a3 3 0 0 0 3 3"/><path d="M8 8h7M8 12h7"/>', 22),
  /** Threat panel: watching (an eye), ground (feet off a tile), all-grid (a shield), a mark (a reticle), a channel (a swirl), Guard up. */
  watch: svg('<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>', 20),
  ground: svg('<rect x="3" y="13" width="9" height="8" rx="1" fill="currentColor" fill-opacity=".3"/><path d="M14 9l4-4m0 0h-3.5M18 5v3.5M16 15h5m0 0-2-2m2 2-2 2"/>', 20),
  all: svg('<path d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5z"/><path d="M8 12l3 3 5-6"/>', 20),
  marked: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>', 20),
  channel: svg('<path d="M12 12a3 3 0 1 1 3 3 6 6 0 1 1-6-6 9 9 0 1 1 9 9"/>', 20),
  guarding: svg('<path d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5z" fill="currentColor" fill-opacity=".35"/>', 20),
} as const;
/** The threat panel's counter family for a live telegraph: what the HUD's three words and icon say to do. */
export const threatFamily = (type: string): 'marked' | 'ground' | 'all' | 'channel' => type === 'all' ? 'all' : type === 'target' ? 'marked' : type === 'channel' ? 'channel' : 'ground';
