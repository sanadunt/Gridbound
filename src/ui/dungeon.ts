// The Undercroft screen: depth picker (a depth opens its dossier first), the room map of a run in progress, and the current room's choices.
import { KITS, ROSTER } from '../game/content';
import { ENEMIES } from '../game/world';
import { CAMP_REST, DEPTHS, DUNGEON_EVENTS, DUNGEON_ROWS, EVENT_COST, EVENT_EFFECTS, LEAVE_HEAL, choiceNeed, depthDef, reachable, unlockedDepth, type DungeonNode, type DungeonNodeKind, type DungeonRun } from '../game/dungeon';
import type { Profile } from '../game/profile';
import { normalizeStoryParty } from '../game/story-party';
import { partyPower, powerVerdict, recommendedPower } from '../game/power';
import { dungeonIcon } from '../art/dungeon-icons';
import { monsterDataURL, monsterShadowDataURL } from '../art/monsters';
import { heroCanvas, heroKey } from '../art/pixels';
import { t, fmtInt, type StringKey } from '../i18n';

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const faces = new Map<string, string>();
const face = (classId: keyof typeof KITS, hero?: number) => { const key = heroKey(classId, hero); if (!faces.has(key)) faces.set(key, heroCanvas(classId, 0, hero).toDataURL()); return faces.get(key)!; };
const materialName = (id: string) => t(`material.${id}` as StringKey);
const pct = (share = 0) => Math.round(share * 100);
/** The numbers an event choice text shows, read from the table chooseEvent applies. */
const eventVars = (id: string, choice: string) => { const fx = EVENT_EFFECTS[`${id}:${choice}`] ?? {}; return { heal: pct(fx.heal ?? (choice === 'leave' ? LEAVE_HEAL : 0)), hurt: pct(fx.hurt), power: pct(fx.power), vitality: pct(fx.vitality), gold: EVENT_COST[`${id}:${choice}`] ?? 0 }; };
const pouchLine = (pouch: { gold: number; materials: Record<string, number> }) => [`<span class="pouch-gold">${fmtInt(pouch.gold)}G</span>`, ...Object.entries(pouch.materials).filter(([, n]) => n > 0).map(([id, n]) => `<span class="pouch-mat"><img src="${dungeonIcon(id as 'ember-shard')}" alt=""/>${escape(materialName(id))} ×${n}</span>`)].join(' ');

/** A foe the Bestiary has not met yet keeps its secret here as on the raid setup: a silhouette and '???' (read as 'Unknown enemy'). */
const known = (p: Profile, id: string) => (p.ledger.enemies[ENEMIES[id]?.archetype ?? id] ?? 0) > 0;
const foeName = (p: Profile, id: string) => known(p, id) ? escape(ENEMIES[id]?.name ?? id) : `<span aria-hidden="true">???</span><span class="sr-only">${t('bestiary.unknown')}</span>`;

/** What a cleared depth says about the next stair: open now, behind a chapter, or none (the deepest depth). The run's map and the
 *  guardian's result both read it, so they never disagree. */
export function clearedText(p: Profile, depth: number): string {
  const next = DEPTHS.find(d => d.id === depth + 1);
  return !next ? t('dungeon.end.cleared.last') : p.cleared.includes(next.unlock - 1) ? t('dungeon.end.cleared') : t('dungeon.end.cleared.wait', { n: next.unlock });
}

const KINDS: DungeonNodeKind[] = ['battle', 'elite', 'event', 'treasure', 'camp', 'guardian'];

/** `outcome`: what the last choice did; `letter`: a letter id found by a lore choice (`dungeon.letter.<id>`). */
export function dungeonScene(p: Profile, outcome?: string, modes = '', letter?: string): string {
  const run = p.journey.run;
  return `<section class="dungeon-scene" aria-labelledby="dungeon-title"><h1 id="dungeon-title" class="sr-only">${t('route.dungeon')}</h1>${modes}${run ? run.status === 'active' ? activeRun(run, outcome, letter) : finishedRun(p, run) : depthPicker(p)}</section>`;
}

function depthPicker(p: Profile): string {
  const open = unlockedDepth(p.cleared, p.journey.depth), power = partyPower(p);
  const party = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  const cards = DEPTHS.map(d => {
    const locked = d.id > open, rec = recommendedPower(d.unlock), verdict = powerVerdict(power, rec), beaten = p.journey.depth >= d.id;
    const why = !p.cleared.includes(d.unlock - 1) ? t('dungeon.lock.chapter', { n: d.unlock }) : t('dungeon.lock.depth', { n: d.id - 1 });
    // A tap opens the depth's dossier; only its Descend starts a run (and locks the story party).
    return `<button class="depth-card ${locked ? 'locked' : ''} ${beaten ? 'beaten' : ''}" data-dungeon-pick="${d.id}" ${locked ? 'disabled' : ''}>
      <span class="depth-num">${d.id}</span>
      <span class="depth-body"><b>${t(`dungeon.depth.${d.id}` as StringKey)}</b><small>${locked ? escape(why) : `${t('dungeon.guardian')}: ${foeName(p, d.guardian)}`}</small></span>
      <span class="depth-meta">${locked ? '' : `<em class="power-${verdict}">${t('power.rec.short', { n: rec })}</em>`}<img src="${dungeonIcon(d.material as 'ember-shard')}" alt="${escape(materialName(d.material))}"/>${beaten ? '<i>✓</i>' : ''}</span>
    </button>`;
  }).join('');
  // The rules come before the depths (open until the first guardian falls), so nobody descends without knowing a wipe loses the pouch.
  return `<article class="win dungeon-intro"><small>${t('dungeon.kicker')}</small><h2>${t('route.dungeon')}</h2><p>${t('dungeon.intro')}</p>
    <div class="dungeon-party">${party.map(id => `<img src="${face(ROSTER[id].classId, id)}" alt="${escape(ROSTER[id].name)}" title="${escape(ROSTER[id].name)}"/>`).join('')}<span>${t('power.party', { n: power })}</span></div></article>
    <details class="win dungeon-rules" ${p.journey.depth ? '' : 'open'}><summary>${t('dungeon.howto')}</summary><p><b>${t('dungeon.rule.map.title')}</b> ${t('dungeon.rule.map')}</p><p><b>${t('dungeon.rule.hp.title')}</b> ${t('dungeon.rule.hp')}</p><p><b>${t('dungeon.rule.pouch.title')}</b> ${t('dungeon.rule.pouch')}</p>${legend()}</details>
    ${open ? `<div class="depth-list">${cards}</div>` : `<p class="win hint">${t('dungeon.locked')}</p>`}`;
}

/** The depth's dossier in the modal, before a descent: nothing starts and the story party stays free until Descend. It names the foes
 *  (silhouettes until the Bestiary met them), the material, the party that would go with its power against the depth's recommendation,
 *  the rules that bite (wounds carry over, the pouch), and that the party is locked to the run. Back (focused) closes it. */
export function depthDossier(p: Profile, depth: number): string {
  const d = depthDef(depth), party = normalizeStoryParty(p.storyActive, p.roster, p.cleared), power = partyPower(p), rec = recommendedPower(d.unlock), verdict = powerVerdict(power, rec);
  const foe = (id: string, kind?: 'elite') => `<li class="dossier-foe ${known(p, id) ? '' : 'unseen'}"><img src="${known(p, id) ? monsterDataURL(id) : monsterShadowDataURL(id)}" alt=""/><span>${kind ? `<small>${t('dungeon.kind.elite')}</small>` : ''}<b>${foeName(p, id)}</b></span></li>`;
  return `<div class="depth-dossier" data-depth-dossier="${d.id}"><small class="dossier-kicker">${t('route.dungeon')} · ${t('dungeon.depth.label', { n: d.id })}</small><h2 id="modal-title">${t(`dungeon.depth.${d.id}` as StringKey)}</h2>
    <h3 class="subheading">${t('dungeon.guardian')}</h3><ul class="dossier-foes guardian">${foe(d.guardian)}</ul>
    <h3 class="subheading">${t('dungeon.dossier.rooms')}</h3><ul class="dossier-foes">${d.enemies.map(id => foe(id)).join('')}${d.elite.map(id => foe(id, 'elite')).join('')}</ul>
    <p class="dossier-material"><img src="${dungeonIcon(d.material as 'ember-shard')}" alt=""/>${t('dungeon.material.hint', { name: materialName(d.material) })}</p>
    <div class="dungeon-party dossier-party">${party.map(id => `<img src="${face(ROSTER[id].classId, id)}" alt="${escape(ROSTER[id].name)}" title="${escape(ROSTER[id].name)}"/>`).join('')}<span>${t('power.party', { n: power })}</span><em class="power-${verdict}">${t('power.rec.short', { n: rec })} · ${t(`power.verdict.${verdict}` as StringKey)}</em></div>
    <p class="dossier-rules"><b>${t('dungeon.rule.hp.title')}</b> ${t('dungeon.rule.hp')} <b>${t('dungeon.rule.pouch.title')}</b> ${t('dungeon.rule.pouch')}</p>
    <p class="dossier-warn">${t('dungeon.lock.warn')}</p></div>
    <button class="btn primary" data-dungeon-start="${d.id}">${t('dungeon.descend')} ▶</button><button class="btn" data-close data-nav-exit="close" data-autofocus>◀ ${t('common.back')}</button>`;
}

function legend(): string {
  return `<ul class="dungeon-legend" aria-label="${t('dungeon.legend')}">${KINDS.map(kind => `<li><img src="${dungeonIcon(kind)}" alt=""/>${t(`dungeon.kind.${kind}` as StringKey)}</li>`).join('')}</ul>`;
}

function finishedRun(p: Profile, run: DungeonRun): string {
  const kind = run.status === 'cleared' ? 'cleared' : run.status === 'extracted' ? 'extracted' : 'wiped';
  // A cleared depth says what its result said: the next stair is open, waits behind a chapter, or there is none.
  return `<article class="win dungeon-result ${kind}"><p class="result-banner">${t(`dungeon.end.${kind}.banner` as StringKey)}</p><h2>${t(`dungeon.depth.${run.depth}` as StringKey)}</h2><p class="dungeon-end-text">${kind === 'cleared' ? clearedText(p, run.depth) : t(`dungeon.end.${kind}` as StringKey)}</p>
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

function roomPanel(run: DungeonRun, outcome?: string, letter?: string): string {
  const node = run.at >= 0 ? run.nodes[run.at] : undefined;
  // What the last choice did stays readable, also when it ends in an ambush (or a fled fight still waits).
  const done = `${outcome ? `<p class="room-outcome" role="status">${escape(outcome)}</p>` : ''}${letter ? `<blockquote class="dungeon-letter"><small>${t('dungeon.letter.title')}</small><p>${escape(t(`dungeon.letter.${letter}` as StringKey))}</p></blockquote>` : ''}`;
  if (run.pendingFight) {
    const enemy = ENEMIES[run.pendingFight.enemy];
    return `${done}<small>${t(`dungeon.kind.${run.pendingFight.kind}` as StringKey)}</small><h3>${escape(enemy?.name ?? run.pendingFight.enemy)} <span>${escape(enemy?.title ?? '')}</span></h3><p>${escape(enemy?.counter ?? '')}</p><button class="btn primary" data-dungeon-fight>${t('dungeon.fight')}</button>`;
  }
  if (!node) return `<h3>${t('dungeon.entrance')}</h3><p>${t('dungeon.pick')}</p>`;
  if (node.kind === 'event' && node.event) {
    const id = node.event;
    // A choice the pouch cannot pay for (or a full potion belt) is shown disabled with the reason.
    const choices = DUNGEON_EVENTS[id].map(choice => { const need = choiceNeed(run, id, choice), why = need === undefined ? '' : need === 'potions' ? t('dungeon.need.potions') : t('dungeon.need.gold', { n: need }); return `<button class="btn" data-dungeon-choice="${choice}" ${why ? 'disabled' : ''}>${t(`dungeon.event.${id}.${choice}` as StringKey, eventVars(id, choice))}${why ? ` <em class="choice-need">${escape(why)}</em>` : ''}</button>`; }).join('');
    return `<small>${t('dungeon.kind.event')}</small><h3>${t(`dungeon.event.${id}.title` as StringKey)}</h3><p>${t(`dungeon.event.${id}.body` as StringKey, { gold: EVENT_COST[`${id}:buy`] ?? 0 })}</p>${node.done ? done || `<p class="hint">${t('dungeon.pick')}</p>` : `<div class="event-choices">${choices}</div>`}`;
  }
  if (node.kind === 'treasure') return `<small>${t('dungeon.kind.treasure')}</small><h3>${t('dungeon.treasure.title')}</h3>${node.done ? done || `<p class="hint">${t('dungeon.pick')}</p>` : `<p>${t('dungeon.treasure.body')}</p><button class="btn primary" data-dungeon-open>${t('dungeon.treasure.open')}</button>`}`;
  // The fire serves one choice: Rest closes the way out until the guardian falls, Extract ends the run with the pouch. Both say so.
  if (node.kind === 'camp') return `<small>${t('dungeon.kind.camp')}</small><h3>${t('dungeon.camp.title')}</h3>${node.done ? done || `<p class="hint">${t('dungeon.pick')}</p>` : `<p>${t('dungeon.camp.body')}</p><div class="event-choices"><button class="btn primary" data-dungeon-camp="rest">${t('dungeon.camp.rest', { n: pct(CAMP_REST) })}</button><button class="btn" data-dungeon-camp="extract">${t('dungeon.camp.extract')}</button></div>`}`;
  return `<small>${t(`dungeon.kind.${node.kind}` as StringKey)}</small><h3>${t('dungeon.cleared.room')}</h3>${done}<p class="hint">${t('dungeon.pick')}</p>`;
}

function activeRun(run: DungeonRun, outcome?: string, letter?: string): string {
  const def = depthDef(run.depth);
  const party = run.party.filter(id => ROSTER[id]).map(id => {
    const ratio = run.hp[id] ?? 0;
    return `<span class="dungeon-hero ${ratio <= 0 ? 'down' : ratio < .35 ? 'low' : ''}" title="${escape(ROSTER[id].name)}"><img src="${face(ROSTER[id].classId, id)}" alt="${escape(ROSTER[id].name)}"/><span class="gauge"><i style="width:${Math.round(ratio * 100)}%"></i></span></span>`;
  }).join('');
  const blessing = run.blessing.power > 1 || run.blessing.vitality > 1 ? `<span class="dungeon-blessing">${t('dungeon.blessing', { p: Math.round((run.blessing.power - 1) * 100), v: Math.round((run.blessing.vitality - 1) * 100) })}</span>` : '';
  // The free way out comes first, above the map: the run waits, saved, and the Bell Tower picks it up again ('Abandon run' is the costly exit).
  return `<div class="dungeon-run-exit"><button class="btn" data-facility="camp" data-nav-exit="back">◀ ${t('dungeon.toCamp')}</button></div><header class="win dungeon-hud"><div><small>${t('route.dungeon')} · ${t('dungeon.depth.label', { n: run.depth })}</small><h2>${t(`dungeon.depth.${run.depth}` as StringKey)}</h2></div>
      <div class="dungeon-pouch"><small>${t('dungeon.pouch')}</small> ${pouchLine(run.pouch)} <span class="pouch-potions">${t('dungeon.potions', { n: run.potions })}</span>${blessing}</div>
      <div class="dungeon-party">${party}</div></header>
    ${mapView(run)}
    ${legend()}
    <section class="win room-panel" aria-live="polite">${roomPanel(run, outcome, letter)}</section>
    <div class="departure-actions dungeon-run-actions"><button class="btn danger" data-dungeon-leave>${t('dungeon.leave')}</button><small class="hint">${t('dungeon.material.hint', { name: materialName(def.material) })}</small></div>`;
}
