import { partyPower, powerVerdict, recommendedPower } from '../game/power';
import { MAX_STARS, STARS_PER_CHEST, STAR_PAR_SECONDS, claimableChests, heroicReward, totalStars } from '../game/journey';
import { CAMPAIGN, ENEMIES } from '../game/world';
import { canEnterZone, type Profile } from '../game/profile';
import { ROSTER } from '../game/content';
import { monsterCanvas } from '../art/monsters';
import { overworldCanvas } from '../art/overworld';
import { expeditionModes, type TownState } from './town';
import { t, type StringKey } from '../i18n';

export type ActId = 0 | 1 | 2 | 3;
export const ACTS: { id: ActId; roman: string; biomeClass: string; zones: number[] }[] = [0, 1, 2, 3].map(id => ({ id: id as ActId, roman: ['I', 'II', 'III', 'IV'][id], biomeClass: `biome-act-${id + 1}`, zones: [id * 4, id * 4 + 1, id * 4 + 2, id * 4 + 3] }));

/** Node positions in percent of the overworld image. */
const NODES = [{ x: 16, y: 66 }, { x: 38, y: 30 }, { x: 63, y: 70 }, { x: 86, y: 36 }];

const images = new Map<string, string>();
const cached = (key: string, draw: () => HTMLCanvasElement) => { if (!images.has(key)) images.set(key, draw().toDataURL()); return images.get(key)!; };
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

/** Cached pixel overworld for an act, also used as the chapter-intro backdrop. */
export const actArt = (act: number) => cached(`act-${act}`, () => overworldCanvas(act, NODES));

const starRow = (n: number) => `<span class="star-row" aria-label="${t('stars.total', { n, max: 3 })}">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`;
const matLabel = (pouch: { materials: Record<string, number> }) => Object.entries(pouch.materials).map(([id, n]) => `${t(`material.${id}` as StringKey)} ×${n}`).join(', ');

export function renderWorldMap(p: Profile, state: TownState): string {
  const power = partyPower(p), rec = recommendedPower(state.zone), verdict = powerVerdict(power, rec);
  const stars = p.journey.stars[state.zone] ?? 0, chests = claimableChests(p.journey), total = totalStars(p.journey);
  const heroicOpen = p.cleared.includes(state.zone), heroic = heroicOpen && state.heroic === true, heroicDone = p.journey.heroic.includes(state.zone);
  const powerLine = `<p class="power-line power-${verdict}"><b>${t('power.party', { n: power })}</b> · ${t('power.rec', { n: rec })} <em>${t(`power.verdict.${verdict}` as StringKey)}</em></p>`;
  const actId = Math.min(3, Math.max(0, Math.floor(state.zone / 4))) as ActId;
  const act = ACTS[actId];
  const zone = CAMPAIGN[state.zone];
  const canEnter = canEnterZone(p, state.zone);
  const finalStage = zone.stages[zone.stages.length - 1];
  const boss = ENEMIES[finalStage.enemy];
  const mission = state.tab === 'mission';
  const art = actArt(actId);
  const nodes = act.zones.map((zoneIdx, nodeIdx) => {
    const z = CAMPAIGN[zoneIdx], cleared = p.cleared.includes(zoneIdx), open = canEnterZone(p, zoneIdx), climax = nodeIdx === 3;
    const status = cleared ? 'cleared' : open ? 'active' : 'locked';
    return `<div class="map-node-anchor" style="left:${NODES[nodeIdx].x}%;top:${NODES[nodeIdx].y}%">
      <button class="map-node-pin ${status} ${state.zone === zoneIdx ? 'chosen' : ''} ${climax ? 'climax-node' : ''}" data-zone="${zoneIdx}" title="${escape(z.name)}" ${open ? '' : 'disabled'} aria-label="${escape(t('map.node', { n: zoneIdx + 1, name: z.name }))} (${t(`map.status.${status}` as StringKey)})">
        <span class="map-node-icon" aria-hidden="true"></span><span class="map-node-badge">${zoneIdx + 1}</span>
      </button>
      <span class="map-node-plate">${escape(z.name)}</span>${cleared ? `<span class="map-node-stars">${starRow(p.journey.stars[zoneIdx] ?? 1)}${p.journey.heroic.includes(zoneIdx) ? '<i class="heroic-mark">H</i>' : ''}</span>` : ''}
    </div>`;
  }).join('');
  const acts = ACTS.map(a => {
    const unlocked = a.id === 0 || p.cleared.includes(a.zones[0] - 1);
    const done = a.zones.filter(z => p.cleared.includes(z)).length;
    return `<button class="map-act-tab ${a.id === actId ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-act="${a.id}" ${unlocked ? '' : 'disabled'} aria-current="${a.id === actId}"><span class="act-tab-roman">${t('map.act', { n: a.roman })}</span><b class="act-tab-name">${t(`act.${a.id}.name` as StringKey)}</b><small class="act-tab-badge">${done}/4</small></button>`;
  }).join('');
  const dossier = `<article class="win mission-brief world-map-dossier" aria-label="${t('map.dossier')}">
    <header class="dossier-header"><small>${escape(zone.speaker)}</small><h3>${escape(zone.name)}</h3><p class="zone-subtitle">${escape(zone.subtitle)}</p></header>
    <div class="dossier-boss-card"><div class="boss-avatar-frame"><img src="${cached(`m-${finalStage.enemy}`, () => monsterCanvas(finalStage.enemy))}" alt="${escape(boss.name)}"/></div>
      <div class="boss-intel"><small>${t('map.boss')}</small><h4>${escape(boss.name)}</h4><small class="dossier-boss-title">${escape(boss.title)}</small>
        <div class="intent-row">${boss.patterns.map((intent, i) => `<span class="intent-chip intent-${intent}">${i + 1}. ${t(`intent.${intent}` as StringKey)}</span>`).join('')}</div></div></div>
    ${heroicOpen ? `<nav class="tabs heroic-toggle" aria-label="${t('heroic.heroic')}"><button data-heroic="0" aria-pressed="${!heroic}">${t('heroic.normal')}</button><button data-heroic="1" aria-pressed="${heroic}">${t('heroic.heroic')}${heroicDone ? ' ✓' : ''}</button></nav>` : ''}
    ${heroic ? `<p class="heroic-note"><b>${t('heroic.badge')}</b> ${t('heroic.desc')} ${heroicDone ? t('heroic.cleared') : t('heroic.reward', { gold: heroicReward(state.zone).gold, mat: matLabel(heroicReward(state.zone)) })}</p>` : ''}
    ${powerLine}
    <div class="star-goals">${starRow(stars)}<ul><li class="${stars >= 1 ? 'met' : ''}">${t('stars.goal.clear')}</li><li class="${stars >= 2 ? 'met' : ''}">${t('stars.goal.standing')}</li><li class="${stars >= 3 ? 'met' : ''}">${t('stars.goal.par', { s: STAR_PAR_SECONDS })}</li></ul></div>
    <dl class="stat-table mission-facts"><div><dt>${t('map.waves')}</dt><dd>${zone.stages.length}</dd></div><div><dt>${t('map.reward')}</dt><dd>${zone.reward}G</dd></div><div><dt>${t('map.potions')}</dt><dd>${heroic ? 1 : 2}</dd></div>${zone.recruit.length ? `<div><dt>${t('map.recruit')}</dt><dd>${zone.recruit.map(id => ROSTER[id].name).join(', ')}</dd></div>` : ''}</dl>
    <p class="counter-strategy"><b>${t('bestiary.counter')}</b> ${escape(boss.counter)}</p>
    <details class="dossier-lore-accordion"><summary>${t('map.story')}</summary><p class="zone-narrative-intro">${escape(zone.intro).replace(/\n/g, '<br>')}</p>
      <ol class="stage-route">${zone.stages.map((s, idx) => `<li><small>${idx === zone.stages.length - 1 ? t('map.finalboss') : t('map.wave', { n: idx + 1 })}</small> <b>${escape(s.name)}</b></li>`).join('')}</ol>
      <p class="hint mission-warning">${t('map.attrition')}</p></details>
    <div class="departure-actions"><button class="btn primary ${heroic ? 'heroic-depart' : ''}" data-depart="adventure" ${canEnter ? '' : 'disabled'}>${heroic ? `${t('heroic.badge')} · ` : ''}${t('map.depart', { name: escape(zone.name) })} ▶</button><button class="btn" data-facility="party">${t('map.prepare')}</button></div>
  </article>`;
  return `<div class="world-map-wrapper ${act.biomeClass} ${mission ? 'mission-view' : 'map-view'}" aria-label="${t('route.campaign')}">
    ${expeditionModes('campaign')}
    ${mission ? `<button class="btn mission-map-return" data-facility="campaign">◀ ${t('map.back')}</button>` : `
    <div class="win map-top-bar"><div class="map-title-block"><small>${t('map.act', { n: act.roman })} · ${t(`act.${actId}.territory` as StringKey)}</small><h2>${t(`act.${actId}.title` as StringKey)}</h2></div>
      <div class="map-stepper-wrap"><button class="btn map-stepper-btn" data-campaign-page="-1" ${state.zone <= 0 ? 'disabled' : ''} aria-label="${t('map.prevch')}">◀</button><span class="chapter-counter">CH ${state.zone + 1}/${CAMPAIGN.length}</span><button class="btn map-stepper-btn" data-campaign-page="1" ${state.zone >= CAMPAIGN.length - 1 ? 'disabled' : ''} aria-label="${t('map.nextch')}">▶</button></div></div>
    <div class="win star-bar"><span>${t('stars.total', { n: total, max: MAX_STARS })}</span>${chests ? `<button class="btn primary" data-star-chest>${t('stars.chest.open')}</button>` : `<small>${t('stars.next', { n: STARS_PER_CHEST - total % STARS_PER_CHEST })}</small>`}</div>
    <nav class="map-act-nav" aria-label="${t('map.acts')}">${acts}</nav>
    <section class="world-map-canvas-card" aria-label="${t('map.title')}"><div class="map-chart-viewport"><img class="overworld-art" src="${art}" alt=""/><div class="map-nodes-layer">${nodes}</div></div></section>
    <article class="msg-window mission-brief map-selected"><small>CH ${state.zone + 1} · ${escape(zone.subtitle)}</small><h3>${escape(zone.name)}</h3>${powerLine}<p class="map-hint">${t('map.hint')}</p>${canEnter ? `<button class="btn primary" data-mission="${state.zone}">${t('map.view')} ▶</button>` : ''}</article>`}
    ${mission ? dossier : ''}
  </div>`;
}
