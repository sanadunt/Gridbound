// The Undercroft screen: depth picker, the room map of a run in progress, and the current room's choices.
import { KITS, ROSTER } from '../game/content';
import { ENEMIES } from '../game/world';
import { DEPTHS, DUNGEON_EVENTS, DUNGEON_ROWS, depthDef, reachable, unlockedDepth, type DungeonNode, type DungeonRun } from '../game/dungeon';
import type { Profile } from '../game/profile';
import { normalizeStoryParty } from '../game/story-party';
import { partyPower, powerVerdict, recommendedPower } from '../game/power';
import { dungeonIcon } from '../art/dungeon-icons';
import { heroCanvas } from '../art/pixels';
import { t, type StringKey } from '../i18n';

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const faces = new Map<string, string>();
const face = (classId: keyof typeof KITS) => { if (!faces.has(classId)) faces.set(classId, heroCanvas(classId, 0).toDataURL()); return faces.get(classId)!; };
const materialName = (id: string) => t(`material.${id}` as StringKey);
const pouchLine = (pouch: { gold: number; materials: Record<string, number> }) => [`<span class="pouch-gold">${pouch.gold}G</span>`, ...Object.entries(pouch.materials).filter(([, n]) => n > 0).map(([id, n]) => `<span class="pouch-mat"><img src="${dungeonIcon(id as 'ember-shard')}" alt=""/>${escape(materialName(id))} ×${n}</span>`)].join(' ');

export function dungeonScene(p: Profile, outcome?: string, modes = ''): string {
  const run = p.journey.run;
  return `<section class="dungeon-scene" aria-labelledby="dungeon-title"><h1 id="dungeon-title" class="sr-only">${t('route.dungeon')}</h1>${run?.status === 'active' ? '' : modes}${run ? run.status === 'active' ? activeRun(p, run, outcome) : finishedRun(run) : depthPicker(p)}</section>`;
}

function depthPicker(p: Profile): string {
  const open = unlockedDepth(p.cleared, p.journey.depth), power = partyPower(p);
  const party = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  const cards = DEPTHS.map(d => {
    const locked = d.id > open, rec = recommendedPower(d.unlock), verdict = powerVerdict(power, rec), beaten = p.journey.depth >= d.id;
    const why = !p.cleared.includes(d.unlock - 1) ? t('dungeon.lock.chapter', { n: d.unlock }) : t('dungeon.lock.depth', { n: d.id - 1 });
    return `<button class="depth-card ${locked ? 'locked' : ''} ${beaten ? 'beaten' : ''}" data-dungeon-start="${d.id}" ${locked ? 'disabled' : ''}>
      <span class="depth-num">${d.id}</span>
      <span class="depth-body"><b>${t(`dungeon.depth.${d.id}` as StringKey)}</b><small>${locked ? escape(why) : `${t('dungeon.guardian')}: ${escape(ENEMIES[d.guardian].name)}`}</small></span>
      <span class="depth-meta">${locked ? '' : `<em class="power-${verdict}">${t('power.rec.short', { n: rec })}</em>`}<img src="${dungeonIcon(d.material as 'ember-shard')}" alt="${escape(materialName(d.material))}"/>${beaten ? '<i>✓</i>' : ''}</span>
    </button>`;
  }).join('');
  return `<article class="win dungeon-intro"><small>${t('dungeon.kicker')}</small><h2>${t('route.dungeon')}</h2><p>${t('dungeon.intro')}</p>
    <div class="dungeon-party">${party.map(id => `<img src="${face(ROSTER[id].classId)}" alt="${escape(ROSTER[id].name)}" title="${escape(ROSTER[id].name)}"/>`).join('')}<span>${t('power.party', { n: power })}</span></div></article>
    ${open ? `<div class="depth-list">${cards}</div>` : `<p class="win hint">${t('dungeon.locked')}</p>`}
    <div class="win dungeon-rules"><p><b>${t('dungeon.rule.map.title')}</b> ${t('dungeon.rule.map')}</p><p><b>${t('dungeon.rule.hp.title')}</b> ${t('dungeon.rule.hp')}</p><p><b>${t('dungeon.rule.pouch.title')}</b> ${t('dungeon.rule.pouch')}</p></div>`;
}

function finishedRun(run: DungeonRun): string {
  const kind = run.status === 'cleared' ? 'cleared' : run.status === 'extracted' ? 'extracted' : 'wiped';
  return `<article class="win dungeon-result ${kind}"><p class="result-banner">${t(`dungeon.end.${kind}.banner` as StringKey)}</p><h2>${t(`dungeon.depth.${run.depth}` as StringKey)}</h2><p>${t(`dungeon.end.${kind}` as StringKey)}</p>
    ${kind === 'wiped' ? '' : `<p class="dungeon-pouch">${t('dungeon.banked')}: ${pouchLine(run.pouch)}</p>`}
    ${kind === 'cleared' ? `<blockquote class="dungeon-lore"><small>${t('dungeon.lore.title')}</small><p>${t(`dungeon.lore.${run.depth}` as StringKey)}</p></blockquote>` : ''}
    <button class="btn primary" data-dungeon-close>${t('dungeon.close')}</button></article>`;
}

function nodeLabel(node: DungeonNode): string {
  if (node.enemy) return `${t(`dungeon.kind.${node.kind}` as StringKey)}: ${ENEMIES[node.enemy]?.name ?? node.enemy}`;
  return t(`dungeon.kind.${node.kind}` as StringKey);
}

function mapView(run: DungeonRun): string {
  const open = new Set(reachable(run));
  const rows = Array.from({ length: DUNGEON_ROWS }, (_, row) => run.nodes.filter(n => n.row === row));
  // Rows climb from the entrance (bottom) to the guardian (top).
  const pos = (n: DungeonNode) => ({ x: (n.col + .5) / rows[n.row].length * 100, y: (DUNGEON_ROWS - 1 - n.row + .5) / DUNGEON_ROWS * 100 });
  const lines = run.nodes.flatMap(n => n.next.map(id => { const a = pos(n), b = pos(run.nodes[id]); const walked = run.visited.includes(n.id) && run.visited.includes(id); return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? 'walked' : ''}"/>`; })).join('');
  const nodes = run.nodes.map(n => {
    const { x, y } = pos(n), state = n.id === run.at ? 'current' : open.has(n.id) ? 'open' : run.visited.includes(n.id) ? 'visited' : 'closed';
    return `<button class="room room-${n.kind} ${state}" style="left:${x}%;top:${y}%" data-dungeon-node="${n.id}" aria-label="${escape(nodeLabel(n))}" title="${escape(nodeLabel(n))}" ${state === 'open' ? '' : 'tabindex="-1" aria-disabled="true"'}><img src="${dungeonIcon(n.kind)}" alt=""/></button>`;
  }).join('');
  return `<div class="dungeon-map" style="--rows:${DUNGEON_ROWS}"><svg class="dungeon-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}</div>`;
}

function roomPanel(run: DungeonRun, outcome?: string): string {
  const node = run.at >= 0 ? run.nodes[run.at] : undefined;
  if (run.pendingFight) {
    const enemy = ENEMIES[run.pendingFight.enemy];
    return `<small>${t(`dungeon.kind.${run.pendingFight.kind}` as StringKey)}</small><h3>${escape(enemy.name)} <span>${escape(enemy.title)}</span></h3><p>${escape(enemy.counter)}</p><button class="btn primary" data-dungeon-fight>${t('dungeon.fight')}</button>`;
  }
  if (!node) return `<h3>${t('dungeon.entrance')}</h3><p>${t('dungeon.pick')}</p>`;
  const done = outcome ? `<p class="room-outcome" role="status">${escape(outcome)}</p>` : '';
  if (node.kind === 'event' && node.event) {
    const id = node.event;
    return `<small>${t('dungeon.kind.event')}</small><h3>${t(`dungeon.event.${id}.title` as StringKey)}</h3><p>${t(`dungeon.event.${id}.body` as StringKey)}</p>${node.done ? done || `<p class="hint">${t('dungeon.pick')}</p>` : `<div class="event-choices">${DUNGEON_EVENTS[id].map(choice => `<button class="btn" data-dungeon-choice="${choice}">${t(`dungeon.event.${id}.${choice}` as StringKey)}</button>`).join('')}</div>`}`;
  }
  if (node.kind === 'treasure') return `<small>${t('dungeon.kind.treasure')}</small><h3>${t('dungeon.treasure.title')}</h3>${node.done ? done || `<p class="hint">${t('dungeon.pick')}</p>` : `<p>${t('dungeon.treasure.body')}</p><button class="btn primary" data-dungeon-open>${t('dungeon.treasure.open')}</button>`}`;
  if (node.kind === 'camp') return `<small>${t('dungeon.kind.camp')}</small><h3>${t('dungeon.camp.title')}</h3>${node.done ? done || `<p class="hint">${t('dungeon.pick')}</p>` : `<p>${t('dungeon.camp.body')}</p><div class="event-choices"><button class="btn primary" data-dungeon-camp="rest">${t('dungeon.camp.rest')}</button><button class="btn" data-dungeon-camp="extract">${t('dungeon.camp.extract')}</button></div>`}`;
  return `<small>${t(`dungeon.kind.${node.kind}` as StringKey)}</small><h3>${t('dungeon.cleared.room')}</h3>${done}<p class="hint">${t('dungeon.pick')}</p>`;
}

function activeRun(p: Profile, run: DungeonRun, outcome?: string): string {
  const def = depthDef(run.depth);
  const party = run.party.filter(id => ROSTER[id]).map(id => {
    const ratio = run.hp[id] ?? 0;
    return `<span class="dungeon-hero ${ratio <= 0 ? 'down' : ratio < .35 ? 'low' : ''}" title="${escape(ROSTER[id].name)}"><img src="${face(ROSTER[id].classId)}" alt="${escape(ROSTER[id].name)}"/><span class="gauge"><i style="width:${Math.round(ratio * 100)}%"></i></span></span>`;
  }).join('');
  const blessing = run.blessing.power > 1 || run.blessing.vitality > 1 ? `<span class="dungeon-blessing">${t('dungeon.blessing', { p: Math.round((run.blessing.power - 1) * 100), v: Math.round((run.blessing.vitality - 1) * 100) })}</span>` : '';
  return `<header class="win dungeon-hud"><div><small>${t('route.dungeon')} · ${t('dungeon.depth.label', { n: run.depth })}</small><h2>${t(`dungeon.depth.${run.depth}` as StringKey)}</h2></div>
      <div class="dungeon-pouch"><small>${t('dungeon.pouch')}</small> ${pouchLine(run.pouch)} <span class="pouch-potions">${t('dungeon.potions', { n: run.potions })}</span>${blessing}</div>
      <div class="dungeon-party">${party}</div></header>
    ${mapView(run)}
    <section class="win room-panel" aria-live="polite">${roomPanel(run, outcome)}</section>
    <div class="departure-actions"><button class="btn danger" data-dungeon-leave>${t('dungeon.leave')}</button><small class="hint">${t('dungeon.material.hint', { name: materialName(def.material) })}</small></div>`;
}
