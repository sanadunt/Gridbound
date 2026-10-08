import { KITS, ROSTER } from '../game/content';
import { CAMPAIGN, ENEMIES } from '../game/world';
import { TALENTS, canEnterZone, talentReason, availablePoints, gearReason, profileModifiers, type Profile } from '../game/profile';
import { JOBS, GEAR, GEAR_SETS } from '../game/jobs';
import { heroProgress } from '../game/levels';
import { storyPartyCap } from '../game/story-party';
import { BASIC_JOBS, createRogueBuild, type RogueBuild } from '../game/roguelike-build';
import { Battle } from '../game/simulation';
import { BANK_SHOP, CHALLENGE_SHOP, RAID_MODIFIERS, getRaidContractForEnemy, raidReward, type RaidModifierId, type RaidSandbox, type RaidTier } from '../economy/challenge';
import { createRaidBuild, validRaidBuild, type RaidBuild } from '../game/raid-build';
import { QUESTS, questProgress } from '../game/quests';
import { questBoard } from './quests';
import { heroCanvas } from '../art/pixels';
import { monsterCanvas } from '../art/monsters';
import { townSceneCanvas, campfireCanvas, smokeCanvas, TOWN_HOTSPOTS, TOWN_W, TOWN_H, PLAZA, CAMPFIRE, CHIMNEYS, SMOKE_SIZE } from '../art/town-scene';
import { renderWorldMap } from './world-map';
import { t, gameText, lang, type StringKey } from '../i18n';
import { localizedRaidModifier } from '../i18n/content';

export type TownTab = 'camp' | 'campaign' | 'mission' | 'party' | 'party-advanced' | 'more' | 'bestiary' | 'quests' | 'raid' | 'endless' | 'challenge-shop';
export type TrainingTab = 'overview'|'skills'|'jobs'|'talents'|'gear'|'formation';
export type PendingGear = { hero: number; slot: 'weapon'|'armor'|'charm'; gearId: string };
export type TownState = {
  tab: TownTab;
  hero: number;
  zone: number;
  raid: string;
  raidTier: RaidTier;
  raidModifiers: RaidModifierId[];
  raidBuild?: RaidBuild;
  raidSandbox?: RaidSandbox;
  questFilter?: 'available'|'all'|'claimed';
  notice: string;
  trainingTab: TrainingTab;
  campaignPage: number;
  questPage: number;
  bestiaryPage: number;
  talentBranch?: string;
  selectedTalent?: string;
  pendingGear?: PendingGear;
  rogueSetup?: RogueBuild;
};

const portraits = new Map<string, string>();
let townImage = '', fireStrip = '', smokeStrip = '';
export function portrait(classId: keyof typeof KITS, frame = 0) {
  const key = `${classId}-${frame}`;
  if (!portraits.has(key)) portraits.set(key, heroCanvas(classId, frame).toDataURL());
  return portraits.get(key)!;
}
function monster(id: string) {
  const key = `enemy-${id}`;
  if (!portraits.has(key)) portraits.set(key, monsterCanvas(id).toDataURL());
  return portraits.get(key)!;
}
function strip(frames: HTMLCanvasElement[]) {
  const out = document.createElement('canvas');
  out.width = frames[0].width * frames.length; out.height = frames[0].height;
  const c = out.getContext('2d')!; c.imageSmoothingEnabled = false;
  frames.forEach((frame, i) => c.drawImage(frame, i * frame.width, 0));
  return out.toDataURL();
}
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const pager = (kind: 'campaign'|'quest'|'bestiary', page: number, total: number) => total <= 1 ? '' : `<nav class="page-controls" aria-label="${t('common.pages')}"><button class="btn" data-${kind}-page="-1" ${page <= 0 ? 'disabled' : ''}>◀ ${t('common.prev')}</button><span>${page + 1} / ${total}</span><button class="btn" data-${kind}-page="1" ${page >= total - 1 ? 'disabled' : ''}>${t('common.next')} ▶</button></nav>`;
const percent = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
const className = (classId: keyof typeof KITS) => KITS[classId].name;

/** Route title shown in the HUD strip. */
export function routeTitle(tab: TownTab) {
  const keys: Record<TownTab, StringKey> = { camp: 'town.name', campaign: 'route.campaign', mission: 'route.campaign', party: 'route.party', 'party-advanced': 'route.progression', more: 'route.menu', bestiary: 'route.bestiary', quests: 'route.quests', raid: 'route.raid', endless: 'route.endless', 'challenge-shop': 'route.shop' };
  return t(keys[tab]);
}

const SPOT_LABELS: Record<string, StringKey> = { gate: 'town.spot.gate', hall: 'town.spot.hall', guild: 'town.spot.guild', archive: 'town.spot.archive', merchant: 'town.spot.merchant', lodge: 'town.spot.lodge', well: 'town.spot.well', inn: 'town.spot.inn', chapel: 'town.spot.chapel' };

function nextObjective(p: Profile) {
  const ready = QUESTS.filter(q => questProgress(p, q).ready).length;
  if (!p.cleared.length) return t('town.msg.first');
  if (ready) return t('town.msg.quests', { n: ready });
  if (p.cleared.length >= CAMPAIGN.length) return t('town.msg.done');
  return t('town.msg.next', { chapter: p.cleared.length + 1, name: CAMPAIGN[Math.min(p.cleared.length, CAMPAIGN.length - 1)].name });
}

function campScene(p: Profile) {
  townImage ||= townSceneCanvas().toDataURL();
  fireStrip ||= strip([0, 1, 2, 3].map(frame => campfireCanvas(frame)));
  smokeStrip ||= strip([0, 1, 2, 3].map(frame => smokeCanvas(frame)));
  const party = (p.storyActive.length ? p.storyActive : p.roster.slice(0, 3)).slice(0, 4);
  const questsReady = QUESTS.filter(q => questProgress(p, q).ready).length;
  const spots = TOWN_HOTSPOTS.map(spot => {
    const target = 'facility' in spot.target ? `data-facility="${spot.target.facility}"` : `data-open-action="${spot.target.action}"`;
    const label = t(SPOT_LABELS[spot.id] ?? 'town.name');
    const flag = spot.id === 'gate' && p.cleared.length < CAMPAIGN.length ? '<i class="spot-flag" aria-hidden="true">!</i>' : spot.id === 'guild' && questsReady ? `<i class="spot-flag" aria-hidden="true">${questsReady}</i>` : '';
    return `<button class="town-spot" data-spot="${spot.id}" ${target} style="left:${spot.x}%;top:${spot.y}%;width:${spot.w}%;height:${spot.h}%" aria-label="${escape(label)}"><span class="town-sign" style="left:${(spot.signX - spot.x) / spot.w * 100}%;top:${(spot.signY - spot.y) / spot.h * 100}%">${escape(label)}</span>${flag}</button>`;
  }).join('');
  const heroes = party.map((id, i) => {
    const offset = (i - (party.length - 1) / 2) * 7;
    return `<img class="plaza-hero" src="${portrait(ROSTER[id].classId)}" alt="" style="left:${PLAZA.x + offset * 1.6}%;top:${PLAZA.y + (i % 2 ? 1.5 : 0)}%;width:${26 / TOWN_W * 100}%;animation-delay:${i * -0.37}s"/>`;
  }).join('');
  return `<section class="camp-scene" aria-labelledby="camp-title">
    <div class="town-map" style="--town-w:${TOWN_W};--town-h:${TOWN_H}">
      <img class="town-map-art camp-art" src="${townImage}" alt="${escape(t('town.alt'))}"/>
      <span class="town-fire" style="left:${CAMPFIRE.x}%;top:${CAMPFIRE.y}%;width:${CAMPFIRE.w / TOWN_W * 100}%;height:${CAMPFIRE.h / TOWN_H * 100}%;background-image:url(${fireStrip})" aria-hidden="true"></span>
      ${CHIMNEYS.slice(1).map((c, i) => `<span class="town-smoke" style="left:${c.x}%;top:${c.y}%;width:${SMOKE_SIZE.w / TOWN_W * 100}%;height:${SMOKE_SIZE.h / TOWN_H * 100}%;background-image:url(${smokeStrip});animation-delay:${i * -0.5}s" aria-hidden="true"></span>`).join('')}
      ${heroes}
      ${spots}
    </div>
    <div class="msg-window camp-copy">
      <h1 id="camp-title">${t('town.name')} <small>${t('town.seals', { n: p.cleared.length, total: CAMPAIGN.length })}</small></h1>
      <p>${escape(nextObjective(p))}</p>
      <span class="msg-caret" aria-hidden="true">▼</span>
    </div>
  </section>`;
}

/** The classic JRPG main menu: party status on top, commands below. */
function moreScene(p: Profile) {
  const items: [string, StringKey, StringKey][] = [
    ['data-facility="party"', 'menu.party', 'menu.party.sub'],
    ['data-facility="party-advanced"', 'menu.progression', 'menu.progression.sub'],
    ['data-facility="quests"', 'menu.quests', 'menu.quests.sub'],
    ['data-facility="bestiary"', 'menu.bestiary', 'menu.bestiary.sub'],
    ['data-facility="challenge-shop"', 'menu.shop', 'menu.shop.sub'],
    ['data-open-action="journal"', 'menu.journal', 'menu.journal.sub'],
    ['data-open-action="profiles"', 'menu.save', 'menu.save.sub'],
    ['data-open-action="settings"', 'menu.settings', 'menu.settings.sub'],
    ['data-open-action="title"', 'menu.title', 'menu.title.sub'],
  ];
  const party = p.storyActive.length ? p.storyActive : p.roster.slice(0, 3);
  return `<section class="more-scene" aria-labelledby="more-title">
    <h1 id="more-title" class="sr-only">${t('route.menu')}</h1>
    <div class="win menu-party">${party.map(id => { const r = ROSTER[id], lv = heroProgress(p.loadouts[id].xp); return `<div class="menu-hero"><img src="${portrait(r.classId)}" alt=""/><div><b>${r.name}</b><small>${escape(JOBS[p.loadouts[id].job ?? '']?.name ?? className(r.classId))}</small></div><div class="menu-hero-stats"><span>LV <b>${lv.level}</b></span><span class="gauge xp" aria-hidden="true"><i style="width:${lv.needed ? lv.current / lv.needed * 100 : 100}%"></i></span></div></div>`; }).join('')}</div>
    <div class="menu-columns">
      <nav class="win menu-list more-grid" aria-label="${t('route.menu')}">${items.map(([attr, title, detail]) => `<button class="menu-item more-card" ${attr}><b>${t(title)}</b><span>${t(detail)}</span></button>`).join('')}</nav>
      <div class="win menu-summary"><dl><div><dt>${t('menu.seals')}</dt><dd>${p.cleared.length}/${CAMPAIGN.length}</dd></div><div><dt>${t('menu.heroes')}</dt><dd>${p.roster.length}/9</dd></div><div><dt>${t('menu.victories')}</dt><dd>${p.wins}</dd></div><div><dt>${t('menu.quests.done')}</dt><dd>${p.claimedQuests.length}/${QUESTS.length}</dd></div><div><dt>${t('menu.bestfloor')}</dt><dd>${p.bestFloor}</dd></div></dl></div>
    </div>
  </section>`;
}

function secondaryScene(p: Profile, state: TownState) {
  const tab = state.tab as 'quests' | 'bestiary' | 'challenge-shop' | 'raid' | 'endless';
  const body = tab === 'quests' ? questBoard(p, state.hero, state.questFilter, state.questPage) : tab === 'bestiary' ? bestiary(state.bestiaryPage) : tab === 'challenge-shop' ? challengeShop(p) : tab === 'raid' ? raids(p, state) : endless(p, state);
  const modeNav = tab === 'raid' || tab === 'endless' ? expeditionModes(tab) : '';
  const deployment = tab === 'raid'
    ? `<div class="deploy-bar secondary-deploy" role="group" aria-label="${t('common.depart')}"><button class="btn primary" data-depart="raid">${t('raid.hunt', { name: escape(ENEMIES[state.raid]?.name ?? '?') })} ▶</button></div>`
    : tab === 'endless'
      ? `<div class="deploy-bar secondary-deploy" role="group" aria-label="${t('common.depart')}"><button class="btn primary" data-depart="endless">${t('endless.descend')} ▶</button></div>`
      : '';
  return `<section class="secondary-scene" aria-labelledby="secondary-title"><h1 id="secondary-title" class="sr-only">${routeTitle(state.tab)}</h1>${modeNav}<div class="secondary-content">${body}</div>${deployment}</section>`;
}

export function expeditionModes(active: 'campaign' | 'raid' | 'endless') {
  return `<nav class="tabs expedition-mode-nav" aria-label="${t('route.campaign')}">${([['campaign', 'mode.campaign'], ['raid', 'mode.raid'], ['endless', 'mode.endless']] as const).map(([id, key]) => `<button data-facility="${id}" ${active === id ? 'aria-current="page"' : ''}>${t(key)}</button>`).join('')}</nav>`;
}

export function renderTown(root: HTMLElement, p: Profile, state: TownState) {
  const content = state.tab === 'camp' ? campScene(p) : state.tab === 'campaign' || state.tab === 'mission' ? renderWorldMap(p, state) : state.tab === 'party' || state.tab === 'party-advanced' ? training(p, state, state.tab === 'party-advanced') : state.tab === 'more' ? moreScene(p) : secondaryScene(p, state);
  root.innerHTML = `<div class="town-game-shell" data-town-route="${state.tab}"><section class="town-scene" aria-label="${escape(routeTitle(state.tab))}"><p id="town-notice" class="town-notice" role="status" ${state.notice ? '' : 'hidden'}>${escape(gameText(state.notice))}</p>${content}</section></div>`;
}

function training(p: Profile, state: TownState, advanced: boolean) {
  const r = ROSTER[state.hero], kit = KITS[r.classId], loadout = p.loadouts[state.hero];
  const progress = heroProgress(loadout.xp);
  const preview = new Battle('raid', 1, profileModifiers(p), { roster: [state.hero], loadouts: p.loadouts }).hero(state.hero)!;
  const tabs: [TrainingTab, StringKey][] = advanced ? [['overview','party.tab.overview'],['jobs','party.tab.jobs'],['talents','party.tab.talents']] : [['formation','party.tab.formation'],['skills','party.tab.skills'],['gear','party.tab.gear']];
  const active = tabs.some(([id]) => id === state.trainingTab) ? state.trainingTab : advanced ? 'overview' : 'formation';
  const panel = active === 'overview' ? trainingOverview(p, state, preview, progress) : active === 'skills' ? skillsPanel(loadout, kit) : active === 'jobs' ? advancement(p, state.hero) : active === 'talents' ? talentsPanel(p, state, r, kit, loadout) : active === 'gear' ? forge(p, state.hero, state) : formation(p, state.hero, r, loadout) + storyPartyPanel(p);
  const zone = CAMPAIGN[state.zone];
  const deployable = zone !== undefined && canEnterZone(p, state.zone);
  return `<section class="party-scene" aria-labelledby="party-title">
    <h1 id="party-title" class="sr-only">${advanced ? t('route.progression') : t('route.party')}</h1>
    <nav class="party-roster" aria-label="${t('party.choose')}">${p.roster.map(id => `<button data-town-hero="${id}" class="${state.hero === id ? 'active' : ''}" aria-pressed="${state.hero === id}"><img src="${portrait(ROSTER[id].classId)}" alt=""/><span>${ROSTER[id].name}</span><small>LV ${heroProgress(p.loadouts[id].xp).level}</small></button>`).join('')}</nav>
    <div class="win training-identity"><img src="${portrait(r.classId)}" alt=""/><div><small>${escape(JOBS[loadout.job??'']?.name ?? kit.name)} · LV ${progress.level}</small><h2>${r.name}</h2><p>${escape(kit.role)}</p><div class="stat-line"><span>HP <b>${preview.maxHp}</b></span><span>${t('party.cd')} <b>${preview.total.toFixed(2)}s</b></span><span>SP <b>${availablePoints(p, state.hero)}</b></span></div></div></div>
    <nav class="tabs training-tabs" aria-label="${t('party.sections')}">${tabs.map(([id,key]) => `<button data-training-tab="${id}" class="${active === id ? 'active' : ''}" aria-current="${active === id ? 'page' : 'false'}">${t(key)}</button>`).join('')}<button class="party-advanced-link" data-facility="${advanced ? 'party' : 'party-advanced'}">${advanced ? `◀ ${t('route.party')}` : `${t('route.progression')} ▶`}</button></nav>
    <section class="win training-panel" data-training-panel="${active}">${panel}</section>
    <div class="deploy-bar party-deploy"><button type="button" class="btn primary party-deploy-button" data-depart="adventure" aria-label="${escape(t('party.deploy', { name: zone?.name ?? '' }))}" ${deployable ? '' : 'disabled'}><span>${escape(t('party.deploy', { name: zone?.name ?? '' }))}</span><small>${deployable ? t('party.deploy.go') : t('party.deploy.locked')}</small></button></div>
  </section>`;
}

function storyPartyPanel(p: Profile) {
  const cap = storyPartyCap(p.cleared);
  return `<details class="story-party"><summary>${t('party.story', { n: p.storyActive.length, cap, total: p.roster.length })}</summary><p class="hint">${t('party.story.hint')}</p><div class="departure-actions">${p.roster.map(id => { const active = p.storyActive.includes(id); return `<button class="btn ${active ? 'on' : ''}" data-story-toggle="${id}" aria-pressed="${active}" ${active ? p.storyActive.length === 1 ? 'disabled' : '' : p.storyActive.length >= cap ? 'disabled' : ''}>${ROSTER[id].name}: ${active ? t('party.story.active') : t('party.story.bench')}</button>`; }).join('')}</div></details>`;
}

function trainingOverview(p: Profile, state: TownState, preview: ReturnType<Battle['hero']> & {}, progress: ReturnType<typeof heroProgress>) {
  const h = p.loadouts[state.hero];
  return `<section class="hero-progression" data-hero-level="${progress.level}"><label>EXP <span>${progress.needed ? t('party.xp.next', { current: progress.current, needed: progress.needed, level: progress.level + 1 }) : t('party.xp.cap')}</span><span class="gauge xp" aria-hidden="true"><i style="width:${progress.needed ? progress.current / progress.needed * 100 : 100}%"></i></span></label><dl class="stat-table"><div><dt>${t('party.maxhp')}</dt><dd>${preview.maxHp}</dd></div><div><dt>${t('party.opening')}</dt><dd>${preview.total.toFixed(2)}s</dd></div><div><dt>${t('party.sp')}</dt><dd data-skill-points>${availablePoints(p, state.hero)}</dd></div><div><dt>${t('party.tab.talents')}</dt><dd>${h.talents.length}</dd></div><div><dt>${t('party.job')}</dt><dd>${escape(h.job ? JOBS[h.job]?.name ?? '' : t('party.basejob'))}</dd></div></dl><p class="hint">${t('party.overview.hint')}</p></section>`;
}

function skillsPanel(loadout: Profile['loadouts'][number], kit: typeof KITS[keyof typeof KITS]) {
  const unlocked = (index: number) => index < 2 || loadout.talents.includes(`active-${index}`) || (index >= 4 && Boolean(loadout.job));
  const skillOptions = (slot: number) => kit.skills.map((s, i) => `<option value="${i}" ${loadout.skills[slot] === i ? 'selected' : ''} ${unlocked(i) ? '' : 'disabled'}>${escape(s.name)}${unlocked(i) ? '' : ` (${t('party.skills.locked')})`}</option>`).join('');
  return `<h3 class="subheading">${t('party.skills.title')} <span>${t('party.skills.sub')}</span></h3><div class="loadout-slots">${[0, 1].map(slot => `<label><span>${t('party.skills.slot', { n: slot + 1 })}${slot === 0 ? ` · ${t('party.skills.opening')}` : ''}</span><select data-equip-slot="${slot}" aria-label="${t('party.skills.slot', { n: slot + 1 })}">${skillOptions(slot)}</select><small>${escape(kit.skills[loadout.skills[slot]].description)}</small></label>`).join('')}</div><p class="hint">${t('party.skills.hint')}</p>`;
}

function talentsPanel(p: Profile, state: TownState, r: typeof ROSTER[number], kit: typeof KITS[keyof typeof KITS], loadout: Profile['loadouts'][number]) {
  const branches = ['foundation', 'assault', 'guard', 'tempo', 'class'];
  const branch = state.talentBranch ?? 'foundation';
  const nodes = TALENTS.filter(talent => (talent.branch ?? 'foundation') === branch && (!talent.classId || talent.classId === r.classId));
  const chosen = nodes.find(talent => talent.id === state.selectedTalent) ?? nodes[0];
  const depth = (node: typeof TALENTS[number], seen = new Set<string>()): number => {
    if (seen.has(node.id)) return 0;
    const requirements = [...new Set([...(node.requires ? [node.requires] : []), ...(node.requiresAll ?? [])])];
    if (!requirements.length) return 0;
    const next = requirements.map(id => nodes.find(candidate => candidate.id === id) ?? TALENTS.find(candidate => candidate.id === id)).filter(Boolean) as typeof TALENTS[number][];
    return 1 + Math.min(3, Math.max(...next.map(candidate => depth(candidate, new Set(seen).add(node.id))), 0));
  };
  const tierLabels: StringKey[] = ['talent.tier.root', 'talent.tier.core', 'talent.tier.spec', 'talent.tier.keystone'];
  const lanes = [0, 1, 2, 3].map(level => nodes.filter(node => depth(node) === level)).filter(lane => lane.length);
  return `<section class="talent-workspace" aria-label="${t('party.tab.talents')}"><div class="talent-workspace-heading"><h3>${t(`talent.branch.${branch}` as StringKey)}</h3><span class="talent-count">${t('talent.learned', { n: nodes.filter(node => loadout.talents.includes(node.id)).length, total: nodes.length })}</span></div><nav class="tabs branch-tabs" aria-label="${t('party.tab.talents')}">${branches.map(b => `<button data-branch="${b}" aria-pressed="${b === branch}">${t(`talent.branch.${b}` as StringKey)}</button>`).join('')}</nav><div class="talent-flow">${lanes.map((lane, index) => `<div class="talent-flow-lane"><div class="talent-flow-label">${t(tierLabels[index])}</div><div class="talent-flow-cards">${lane.map(node => {
    const isLearned = loadout.talents.includes(node.id);
    return `<button data-inspect-talent="${node.id}" class="talent-flow-node ${node.id === chosen?.id ? 'chosen' : ''} ${isLearned ? 'learned' : ''} ${node.exclusive ? 'keystone' : ''}" aria-label="${escape(node.name)}"><b>${escape(node.name)}${isLearned ? ' ✓' : ''}</b><span>${isLearned ? t('talent.learned.short') : `${node.cost}G`}</span></button>`;
  }).join('')}</div></div>`).join('')}</div><div class="talent-inspector-section">${chosen ? talentCard(p, state.hero, kit, loadout)(chosen) : ''}</div></section>`;
}

function talentCard(p: Profile, hero: number, kit: typeof KITS[keyof typeof KITS], loadout: Profile['loadouts'][number]) {
  return (talent: typeof TALENTS[number]) => {
    const owned = loadout.talents.includes(talent.id), reason = talentReason(p, hero, talent);
    const active = talent.id.startsWith('active-'), index = Number(talent.id.slice(-1));
    const name = active ? kit.skills[index]?.name ?? talent.name : talent.name;
    const description = active ? kit.skills[index]?.description ?? talent.description : talent.description;
    const prereqs = [...new Set([...(talent.requires ? [talent.requires] : []), ...(talent.requiresAll ?? [])])];
    const arrows = prereqs.map(req => `<div class="talent-arrow" data-talent-arrow="${req}->${talent.id}" data-from="${req}" data-to="${talent.id}">${t('talent.requires', { name: escape(TALENTS.find(n => n.id === req)?.name ?? req) })}</div>`).join('');
    return `<div class="talent-node-wrap">${arrows}<button class="talent-node ${owned ? 'learned' : ''}" data-talent="${talent.id}" ${reason ? 'disabled' : ''}><small>${talent.exclusive ? t('talent.keystone') : active ? t('talent.active') : t('talent.passive')}${talent.level ? ` · LV ${talent.level}` : ''}</small><b>${escape(name)}</b><span>${escape(description)}</span><strong>${owned ? t('talent.learned.short') : reason ? escape(gameText(reason)) : `${t('talent.learn')} · ${talent.cost}G${talent.points ? ` + ${talent.points} SP` : ''}`}</strong></button></div>`;
  };
}

function advancement(p: Profile, id: number) {
  const h = p.loadouts[id], base = ROSTER[id].classId, level = p.cleared.length + 1;
  const paths = Object.values(JOBS).filter(j => j.base === base && j.tier === 2).map(j => {
    const third = Object.values(JOBS).find(job => job.parent === j.id);
    const jobs = [j, third].filter(Boolean) as typeof JOBS[string][];
    const cards = jobs.map(job => {
      const owned = h.job === job.id || JOBS[h.job ?? '']?.parent === job.id;
      const eligible = job.tier === 2 ? !h.job : h.job === job.parent;
      const disabled = owned || !eligible || level < job.level || p.gold < job.cost;
      const state = owned ? t('talent.learned.short') : !eligible ? t('job.otherpath') : level < job.level ? t('job.rank', { n: job.level }) : `${job.cost}G`;
      return `<button data-promote="${job.id}" class="job-node ${owned ? 'learned' : ''}" ${disabled ? 'disabled' : ''}><small>${job.tier === 2 ? t('job.advanced') : t('job.third')} · ${t('job.rank', { n: job.level })}</small><b>${escape(job.name)}</b><span>${escape(job.description)}</span><em>${t('job.unlock', { name: escape(job.skill.name) })}</em><strong>${state}</strong></button>`;
    });
    return `<section>${cards.join('<span class="job-connector" aria-hidden="true">▼</span>')}</section>`;
  }).join('');
  return `<h3 class="subheading">${t('job.title')} <span>${t('job.sub')}</span></h3><div class="job-paths">${paths}</div><p class="hint">${t('job.hint')}</p><div class="departure-actions"><button class="btn" data-respec ${h.talents.length || h.job ? '' : 'disabled'}>${t('party.respec', { name: ROSTER[id].name })}</button></div>`;
}

function forge(p: Profile, id: number, state: TownState) {
  const h = p.loadouts[id];
  const slots = ['weapon','armor','charm'] as const;
  const optionFor = (slot: typeof slots[number]) => {
    const pending = state.pendingGear?.hero === id && state.pendingGear.slot === slot ? state.pendingGear.gearId : h.gear?.[slot] ?? '';
    return GEAR.filter(g => g.slot === slot && (!g.classId || g.classId === ROSTER[id].classId)).map(g => {
      const owned = h.inventory?.includes(g.id), reason = gearReason(p, id, g.id);
      return `<option value="${g.id}" ${pending === g.id ? 'selected' : ''}>${escape(g.name)} · LV ${g.minLevel ?? 1} · ${owned ? t('gear.owned') : g.source === 'quest' ? t('gear.quest') : g.cost + 'G'}${reason ? ` · ${escape(gameText(reason))}` : ''}</option>`;
    }).join('');
  };
  const pending = state.pendingGear?.hero === id ? state.pendingGear : undefined;
  const selected = pending ? GEAR.find(g => g.id === pending.gearId && g.slot === pending.slot) : undefined;
  const current = selected ? GEAR.find(g => g.id === h.gear?.[selected.slot]) : undefined;
  const reason = selected ? gearReason(p, id, selected.id) : '';
  const comparison = selected ? `<dl class="stat-table gear-comparison"><div><dt>${t('gear.power')}</dt><dd>${percent(selected.power - (current?.power ?? 0))}</dd></div><div><dt>HP</dt><dd>${percent(selected.hp - (current?.hp ?? 0))}</dd></div><div><dt>${t('gear.tempo')}</dt><dd>${percent(selected.tempo - (current?.tempo ?? 0))}</dd></div></dl>` : '';
  return `<h3 class="subheading">${t('gear.title')} <span>${t('gear.sub')}</span></h3><div class="gear-slots">${slots.map(slot => `<label>${t(`gear.slot.${slot}` as StringKey)}<select data-gear-slot="${slot}" aria-label="${t(`gear.slot.${slot}` as StringKey)}"><option value="">${t('gear.choose')}</option>${optionFor(slot)}</select><small>${escape(GEAR.find(g => g.id === h.gear?.[slot])?.description ?? t('gear.none'))}</small></label>`).join('')}</div>${selected ? `<section class="gear-preview" data-gear-preview="${selected.id}" aria-live="polite"><small>${t('gear.inspect')} · ${escape(selected.rarity ?? 'common')}</small><h3>${escape(selected.name)}</h3><p>${escape(selected.description)}</p><p>${t('gear.req')}: ${selected.minLevel ? `LV ${selected.minLevel}` : t('gear.req.none')}${selected.classId ? ` · ${className(selected.classId as keyof typeof KITS)}` : ''}${selected.source === 'quest' ? ` · ${t('gear.quest')}` : ` · ${selected.cost}G`}</p>${comparison}<p class="gear-preview-status">${reason ? escape(gameText(reason)) : current?.id === selected.id ? t('gear.equipped') : t('gear.ready')}</p><div class="gear-preview-actions"><button class="btn primary" data-confirm-gear ${reason || current?.id === selected.id ? 'disabled' : ''}>${t('gear.confirm')}</button><button class="btn" data-cancel-gear>${t('common.cancel')}</button></div></section>` : `<p class="hint gear-preview-empty">${t('gear.hint')}</p>`}<details class="gear-set-status"><summary>${t('gear.sets')}</summary>${GEAR_SETS.map(set => { const count = Object.entries(h.gear ?? {}).filter(([slot, gearId]) => GEAR.some(g => g.id === gearId && g.slot === slot && g.setId === set.id)).length; return `<p><b>${escape(set.name)} · ${count}/3</b><br>${escape(set.description)} ${count >= 3 ? t('gear.set.all') : count >= 2 ? t('gear.set.two') : ''}</p>`; }).join('')}</details>`;
}

function formation(p: Profile, id: number, r: typeof ROSTER[number], loadout: Profile['loadouts'][number]) {
  return `<h3 class="subheading">${t('formation.title')} <span>${t('formation.sub', { name: r.name })}</span></h3><div class="formation-grid" aria-label="${t('formation.title')}">${Array.from({ length: 9 }, (_, slot) => { const hero = p.roster.find(heroId => p.loadouts[heroId].slot === slot); const row = slot < 3 ? t('formation.front') : slot < 6 ? t('formation.mid') : t('formation.back'); return `<button data-formation="${slot}" class="${loadout.slot === slot ? 'chosen' : ''}" aria-label="${t('formation.tile', { n: slot + 1 })}${hero !== undefined ? `, ${ROSTER[hero].name}` : ''}"><small>${row}</small>${hero !== undefined ? `<img src="${portrait(ROSTER[hero].classId)}" alt=""/><span>${ROSTER[hero].name}</span>` : `<span class="empty">${t('formation.empty')}</span>`}</button>`; }).join('')}</div><p class="hint">${t('formation.hint')}</p><div class="departure-actions"><button class="btn" data-respec ${loadout.talents.length || loadout.job ? '' : 'disabled'}>${t('party.respec', { name: r.name })}</button></div>`;
}

function bestiary(pageIndex: number) {
  const records = Object.values(ENEMIES);
  const total = records.length, page = Math.min(Math.max(0, pageIndex), total - 1), e = records[page];
  return `<div class="bestiary-list paged-collection" data-page="${page}"><article class="win"><div class="bestiary-art"><img src="${monster(e.id)}" alt="${escape(e.name)}"/></div><div><small>${escape(e.title)} · ${t('bestiary.tier', { n: e.tier ?? 1 })}</small><h3>${escape(e.name)}</h3><p>${escape(e.description)}</p><p class="intent-row">${e.patterns.map((intent, i) => `<span class="intent-chip intent-${intent}">${i + 1}. ${t(`intent.${intent}` as StringKey)}</span>`).join('')}</p><p class="counter-note"><b>${t('bestiary.counter')}</b> ${escape(e.counter)}</p></div></article>${pager('bestiary', page, total)}<p class="hint">${t('bestiary.hint')}</p></div>`;
}

function raids(p: Profile, state: TownState) {
  const choices = Object.values(ENEMIES).filter(e => e.archetype === e.id).map(e => e.id);
  const selected = ENEMIES[state.raid] ?? ENEMIES.golem;
  const build = state.raidBuild && validRaidBuild(state.raidBuild, p.roster) ? state.raidBuild : createRaidBuild(p.roster, Math.min(3, p.roster.length, 6));
  const contract = state.raidSandbox ? undefined : getRaidContractForEnemy(state.raid, state.raidTier, state.raidModifiers);
  const tiers = (['bronze', 'silver', 'gold'] as const).map(tier => {
    const tierContract = getRaidContractForEnemy(state.raid, tier, state.raidModifiers);
    return `<option value="${tier}" ${state.raidTier === tier ? 'selected' : ''} ${tierContract ? '' : 'disabled'}>${t(`raid.tier.${tier}` as StringKey)} · ${tierContract ? t('raid.tier.reward', { risk: tierContract.riskPoints, n: raidReward(tierContract, state.raid) }) : t('raid.sandbox')}</option>`;
  }).join('');
  const modifiers = RAID_MODIFIERS.map(raw => localizedRaidModifier(raw, lang())).map(modifier => `<label class="raid-modifier"><input type="checkbox" data-raid-modifier="${modifier.id}" ${state.raidModifiers.includes(modifier.id) ? 'checked' : ''}/><span><b>${escape(modifier.name)}</b><small>${escape(modifier.description)}</small></span></label>`).join('');
  const party = build.slots.map((slot, index) => `<label class="raid-party-slot"><span>${index + 1}. ${ROSTER[slot.heroId].name}</span><select data-raid-job="${index}" aria-label="${t('raid.job', { n: index + 1 })}">${['warrior', 'rogue', 'archer', 'healer', 'wizard'].map(job => `<option value="${job}" ${slot.classId === job ? 'selected' : ''}>${KITS[job as keyof typeof KITS].name}</option>`).join('')}</select></label>`).join('');
  const sandbox = state.raidSandbox;
  const status = contract && !sandbox ? t('raid.contract', { n: raidReward(contract, state.raid) }) : t('raid.sandbox.short');
  return `<article class="win mission-brief raid-departure"><img class="brief-art" src="${monster(selected.id)}" alt=""/><div><small>${status}</small><h3>${escape(selected.name)}</h3><p>${escape(selected.title)}</p><p class="counter-note">${escape(selected.counter)}</p></div></article>
  <div class="win raid-pick"><h3 class="subheading">${t('raid.quarry')}</h3><div class="raid-roster">${choices.map(id => `<button data-raid="${id}" class="${state.raid === id ? 'chosen' : ''}" aria-pressed="${state.raid === id}"><img src="${monster(id)}" alt=""/><b>${escape(ENEMIES[id].name)}</b></button>`).join('')}</div>
  <label class="raid-variant">${t('raid.variant')}<select data-raid-variant aria-label="${t('raid.variant')}">${Object.values(ENEMIES).map(e => `<option value="${e.id}" ${state.raid === e.id ? 'selected' : ''}>${escape(e.name)} · T${e.tier}</option>`).join('')}</select></label>
  <label class="raid-tier">${t('raid.reward')}<select data-raid-tier aria-label="${t('raid.reward')}">${tiers}</select></label></div>
  <details class="win" open><summary>${t('raid.party', { n: build.slots.length })}</summary><label class="raid-party-size">${t('raid.size')}<select data-raid-party-size aria-label="${t('raid.size')}">${[1,2,3,4,5,6].map(size => `<option value="${size}" ${build.slots.length === size ? 'selected' : ''} ${size > p.roster.length ? 'disabled' : ''}>${size}</option>`).join('')}</select></label><div class="raid-party-grid">${party}</div><p class="hint">${t('raid.party.hint')}</p></details>
  <details class="win raid-modifiers-box"><summary>${t('raid.modifiers')}</summary><fieldset class="raid-modifiers"><legend class="sr-only">${t('raid.modifiers')}</legend>${modifiers}</fieldset><p class="hint">${t('raid.modifiers.hint')}</p></details>
  <details class="win raid-sandbox"><summary>${t('raid.practice')}</summary><p class="hint">${t('raid.practice.hint')}</p>
    <label>${t('raid.slider.hp')} <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.hpScale ?? 1}" data-raid-sandbox="hpScale"/><output>${(sandbox?.hpScale ?? 1).toFixed(1)}×</output></label>
    <label>${t('raid.slider.damage')} <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.damageScale ?? 1}" data-raid-sandbox="damageScale"/><output>${(sandbox?.damageScale ?? 1).toFixed(1)}×</output></label>
    <label>${t('raid.slider.interval')} <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.intervalScale ?? 1}" data-raid-sandbox="intervalScale"/><output>${(sandbox?.intervalScale ?? 1).toFixed(1)}×</output></label>
  </details>`;
}

function challengeShop(p: Profile) {
  return `<div class="win shop-keeper"><p>${t('shop.greeting')}</p><span class="shop-purse">${t('shop.purse', { n: p.economy.commanderCrystal })}</span></div><section class="challenge-shop-grid"><article class="win"><h3 class="subheading">${t('shop.bank')}</h3>${BANK_SHOP.map(item => { const owned = p.challengeUnlocks.includes(item.id); return `<div class="shop-item"><div><h4>${escape(item.name)}</h4><p>${escape(item.description)}</p></div><button class="btn ${owned ? '' : 'primary'}" data-bank-buy="${item.id}" ${owned || p.economy.commanderCrystal < item.cost ? 'disabled' : ''}>${owned ? t('shop.owned') : `${item.cost} ◆`}</button></div>`; }).join('')}</article><article class="win"><h3 class="subheading">${t('shop.journey')}</h3><p class="hint">${t('shop.journey.hint')}</p>${CHALLENGE_SHOP.map(item => `<div class="shop-item"><div><h4>${escape(item.name)}</h4><p>${escape(item.description)}</p></div><span class="shop-cost">${item.cost} ◇</span></div>`).join('')}</article></section>`;
}

function endless(p: Profile, state: TownState) {
  const build = state.rogueSetup ?? createRogueBuild();
  return `<article class="win mission-brief"><div><small>${t('endless.best', { n: p.bestFloor })}</small><h3>${t('route.endless')}</h3><p>${t('endless.intro')}</p></div></article>
  <fieldset class="win loadout-slots"><legend>${t('endless.recruits')}</legend>${build.recruits.map((r, i) => `<label>${t('endless.recruit', { n: i + 1 })}<select data-rogue-slot="${i}" aria-label="${t('endless.recruit', { n: i + 1 })}">${BASIC_JOBS.map(id => `<option value="${id}" ${r.classId === id ? 'selected' : ''}>${KITS[id].name}</option>`).join('')}</select></label>`).join('')}<p class="hint">${t('endless.recruits.hint')}</p></fieldset>
  <div class="win endless-rules"><p><b>${t('endless.rule1.title')}</b> ${t('endless.rule1')}</p><p><b>${t('endless.rule2.title')}</b> ${t('endless.rule2')}</p><p><b>${t('endless.rule3.title')}</b> ${t('endless.rule3')}</p><p><b>${t('endless.rule4.title')}</b> ${t('endless.rule4')}</p></div>
  <div class="departure-actions"><button class="btn" data-facility="challenge-shop">${t('route.shop')}</button></div>`;
}
