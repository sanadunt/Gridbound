import { KITS, ROSTER } from '../game/content';
import { CAMPAIGN, ENEMIES } from '../game/world';
import { TALENTS, canEnterZone, talentReason, availablePoints, gearReason, profileModifiers, type Profile } from '../game/profile';
import { JOBS, GEAR, GEAR_SETS, MAX_REFINE, REFINE_STEP, gearStats, legalSkill } from '../game/jobs';
import { heroProgress, LEVEL_HP, LEVEL_POWER } from '../game/levels';
import { storyPartyCap, normalizeStoryParty, storyPartyLocked } from '../game/story-party';
import { BASIC_JOBS, createRogueBuild, type RogueBuild } from '../game/roguelike-build';
import { Battle } from '../game/simulation';
import { BANK_SHOP, BELL_TONIC, CHALLENGE_SHOP, RAID_MODIFIERS, RELIC_IDS, bankShopItem, getRaidContractForEnemy, raidModifierAvailable, raidReward, type RaidModifierId, type RaidSandbox, type RaidTier } from '../economy/challenge';
import { RAID_BASIC_JOBS, RAID_QUARRIES, defaultRaidBuild, openRaidQuarry, raidQuarryUnlockAt, raidQuarryUnlocked, validRaidBuild, type RaidBuild } from '../game/raid-build';
import { QUESTS, questProgress } from '../game/quests';
import { questBoard } from './quests';
import { heroCanvas, heroKey } from '../art/pixels';
import { itemIcon, type ItemSlot } from '../art/items';
import { dungeonIcon } from '../art/dungeon-icons';
import { monsterCanvas, monsterDataURL } from '../art/monsters';
import { townSceneDataURL, campfireCanvas, smokeCanvas, TOWN_HOTSPOTS, TOWN_W, TOWN_H, PLAZA, CAMPFIRE, CHIMNEYS, SMOKE_SIZE } from '../art/town-scene';
import { renderWorldMap } from './world-map';
import { dungeonScene } from './dungeon';
import { heroPower, partyPower, powerVerdict, recommendedPower } from '../game/power';
import { claimableChests } from '../game/journey';
import { pendingChoices } from '../game/narrative';
import { DEPTHS, unlockedDepth } from '../game/dungeon';
import { refineCost } from '../game/profile';
import { UNLOCKS, featureOpen, isFeature, isNew, type Feature } from './unlocks';
import { dungeonBadge, heroNeeds, trainingBadge } from './badges';
import { t, lockText, lang, fmtInt, fmtDec, fmtSec, type StringKey } from '../i18n';
import { intentChips } from './intent';
import { localizedRaidModifier } from '../i18n/content';

export type TownTab = 'camp' | 'campaign' | 'mission' | 'dungeon' | 'party' | 'party-advanced' | 'more' | 'bestiary' | 'quests' | 'raid' | 'endless' | 'challenge-shop';
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
  /** Enemy shown in the Bestiary's detail sheet (an archetype or one of its variants). */
  bestiaryPick?: string;
  talentBranch?: string;
  selectedTalent?: string;
  pendingGear?: PendingGear;
  heroic?: boolean;
  dungeonOutcome?: string;
  /** Letter id a lore choice just found (shown under the outcome). */
  dungeonLetter?: string;
  gearSlot?: ItemSlot;
  rogueSetup?: RogueBuild;
  /** Bell Tonic ticked for the next Raid/Roguelike departure (paid with bank Crystal when the run starts). */
  tonic?: boolean;
};

const portraits = new Map<string, string>();
let fireStrip = '', smokeStrip = '';
/** A hero portrait, cached by look: pass the roster id so heroes who share a class keep their own colours. */
export function portrait(classId: keyof typeof KITS, frame = 0, hero?: number) {
  const key = `${heroKey(classId, hero)}-${frame}`;
  if (!portraits.has(key)) portraits.set(key, heroCanvas(classId, frame, hero).toDataURL());
  return portraits.get(key)!;
}
function strip(frames: HTMLCanvasElement[]) {
  const out = document.createElement('canvas');
  out.width = frames[0].width * frames.length; out.height = frames[0].height;
  const c = out.getContext('2d', { willReadFrequently: true })!; c.imageSmoothingEnabled = false;
  frames.forEach((frame, i) => c.drawImage(frame, i * frame.width, 0));
  return out.toDataURL();
}
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const percent = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
const className = (classId: keyof typeof KITS) => KITS[classId].name;

/** Route title shown in the HUD strip. */
export function routeTitle(tab: TownTab) {
  const keys: Record<TownTab, StringKey> = { camp: 'town.name', campaign: 'route.campaign', mission: 'route.campaign', dungeon: 'route.dungeon', party: 'route.party', 'party-advanced': 'route.progression', more: 'route.menu', bestiary: 'route.bestiary', quests: 'route.quests', raid: 'route.raid', endless: 'route.endless', 'challenge-shop': 'route.shop' };
  return t(keys[tab]);
}

const SPOT_LABELS: Record<string, StringKey> = { gate: 'town.spot.gate', hall: 'town.spot.hall', guild: 'town.spot.guild', archive: 'town.spot.archive', merchant: 'town.spot.merchant', lodge: 'town.spot.lodge', well: 'town.spot.well', inn: 'town.spot.inn', chapel: 'town.spot.chapel' };

/** Free story party slots that a benched hero could fill (0 when the party is full or nobody is benched). */
function emptySlots(p: Profile) {
  const party = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  return Math.min(storyPartyCap(p.cleared) - party.length, p.roster.filter(id => !party.includes(id)).length);
}

/** The single most useful next step, with the place it happens. */
function nextObjective(p: Profile): { text: string; facility?: string; tab?: TrainingTab; action?: string; chapter?: number } {
  const ready = QUESTS.filter(q => questProgress(p, q).ready).length;
  if (!p.cleared.length) return { text: t('town.msg.first'), facility: 'campaign', chapter: 0 };
  if (p.journey.run?.status === 'active') return { text: t('guide.run'), facility: 'dungeon' };
  // An empty party slot is the biggest free power gain, so it comes before chests, quests and skill points.
  const empty = emptySlots(p);
  if (empty) return { text: t('guide.emptySlots', { n: empty }), facility: 'party', tab: 'formation' };
  if (claimableChests(p.journey)) return { text: t('guide.chest'), facility: 'campaign' };
  if (ready) return { text: t('town.msg.quests', { n: ready }), facility: 'quests' };
  // A story choice left for later waits in the Journal (below chests and quests, so 'Decide later' never hides them).
  if (pendingChoices(p.narrative ?? {}, p.cleared).length) return { text: t('guide.choice'), action: 'journal' };
  const idle = normalizeStoryParty(p.storyActive, p.roster, p.cleared).find(id => availablePoints(p, id) >= 2);
  if (idle !== undefined) return { text: t('guide.points', { name: ROSTER[idle].name, n: availablePoints(p, idle), place: t('town.spot.hall') }), facility: 'party-advanced' };
  if (p.cleared.length >= CAMPAIGN.length) return { text: t('guide.heroic'), facility: 'campaign' };
  const next = Math.min(p.cleared.length, CAMPAIGN.length - 1), power = partyPower(p), rec = recommendedPower(next);
  if (powerVerdict(power, rec) === 'under') return { text: t('guide.underpowered', { n: power, rec, name: CAMPAIGN[next].name }), facility: unlockedDepth(p.cleared, p.journey.depth) ? 'dungeon' : 'party' };
  if (unlockedDepth(p.cleared, p.journey.depth) > p.journey.depth && p.journey.depth < DEPTHS.length) return { text: t('guide.dungeon'), facility: 'dungeon' };
  return { text: t('town.msg.next', { chapter: next + 1, name: CAMPAIGN[next].name }), facility: 'campaign', chapter: next };
}

/** The chapter the story continues with (undefined once every chapter is cleared). */
export function storyNext(p: Profile) {
  const zone = CAMPAIGN.findIndex((_, i) => !p.cleared.includes(i));
  return zone >= 0 && canEnterZone(p, zone) ? zone : undefined;
}
/** Hotspots that open later in the story (UI unlock table). */
const SPOT_FEATURE: Partial<Record<string, Feature>> = { chapel: 'dungeon', lodge: 'raid', well: 'endless' };

function campScene(p: Profile) {
  const townImage = townSceneDataURL();
  fireStrip ||= strip([0, 1, 2, 3].map(frame => campfireCanvas(frame)));
  smokeStrip ||= strip([0, 1, 2, 3].map(frame => smokeCanvas(frame)));
  const party = (p.storyActive.length ? p.storyActive : p.roster.slice(0, 3)).slice(0, 4);
  const questsReady = QUESTS.filter(q => questProgress(p, q).ready).length, training = trainingBadge(p), below = dungeonBadge(p);
  const spots = TOWN_HOTSPOTS.map(spot => {
    const feature = SPOT_FEATURE[spot.id], locked = feature !== undefined && !featureOpen(p, feature);
    // The sign names the building and, under it, the one name its destination has everywhere (HUD, MENU, gate tabs).
    // It is anchored by its position across the map (--anchor), so edge signs stay inside the map however long the names get;
    // on a narrow map (small phones) only the first line shows (town.css), the destination stays in the button's label.
    const name = t(SPOT_LABELS[spot.id] ?? 'town.name'), dest = 'facility' in spot.target ? routeTitle(spot.target.facility as TownTab) : t('menu.save'), role = locked ? t('unlock.clear', { n: UNLOCKS[feature!] }) : dest;
    const target = locked ? `data-locked="${feature}"` : 'facility' in spot.target ? `data-facility="${spot.target.facility}"` : `data-open-action="${spot.target.action}"`;
    // The flag is drawn for the eye; its meaning goes into the button's label for screen readers.
    const [flag, state] = locked ? ['', '']
      : feature && isNew(p, feature) ? [`<i class="spot-flag spot-new" aria-hidden="true">${t('unlock.new')}</i>`, t('town.spot.state.new')]
      : spot.id === 'gate' && p.cleared.length < CAMPAIGN.length ? ['<i class="spot-flag" aria-hidden="true">!</i>', t('town.spot.state.story')]
      : spot.id === 'guild' && questsReady ? [`<i class="spot-flag" aria-hidden="true">${questsReady}</i>`, t('town.spot.state.quests', { n: questsReady })]
      : spot.id === 'hall' && training ? [`<i class="spot-flag" aria-hidden="true">${training}</i>`, t('town.spot.state.training', { n: training })]
      : spot.id === 'chapel' && below ? ['<i class="spot-flag" aria-hidden="true">!</i>', t('town.spot.state.depth')] : ['', ''];
    return `<button class="town-spot ${locked ? 'locked' : ''}" data-spot="${spot.id}" ${target} style="left:${spot.x}%;top:${spot.y}%;width:${spot.w}%;height:${spot.h}%" aria-label="${escape([name, dest, locked ? role : state].filter(Boolean).join(' · '))}"><span class="town-sign" style="left:${(spot.signX - spot.x) / spot.w * 100}%;top:${(spot.signY - spot.y) / spot.h * 100}%;--anchor:-${Math.min(85, Math.max(15, spot.signX))}%"><b>${locked ? '<i class="spot-lock" aria-hidden="true"></i>' : ''}${escape(name)}${flag}</b><small>${escape(role)}</small></span></button>`;
  }).join('');
  const heroes = party.map((id, i) => {
    const offset = (i - (party.length - 1) / 2) * 7;
    return `<img class="plaza-hero" src="${portrait(ROSTER[id].classId, 0, id)}" alt="" style="left:${PLAZA.x + offset * 1.6}%;top:${PLAZA.y + (i % 2 ? 1.5 : 0)}%;width:${26 / TOWN_W * 100}%;animation-delay:${i * -0.37}s"/>`;
  }).join('');
  const goal = nextObjective(p), next = storyNext(p);
  // One tap from camp to the next chapter's dossier; when the guide's step is that chapter, this button is the guide's Go.
  const go = goal.chapter !== undefined && next !== undefined ? '' : goal.action ? `<button class="btn guide-go" data-open-action="${goal.action}">${t('common.go')} ▶</button>` : goal.facility ? `<button class="btn guide-go" data-facility="${goal.facility}"${goal.tab ? ` data-training-tab="${goal.tab}"` : ''}>${t('common.go')} ▶</button>` : '';
  const story = next !== undefined ? `<button class="btn primary continue-story ${go ? '' : 'guide-go'}" data-continue-story="${next}">${escape(t('town.continue', { n: next + 1, name: CAMPAIGN[next].name }))} ▶</button>` : '';
  return `<section class="camp-scene" aria-labelledby="camp-title">
    <div class="town-map-frame" style="--town-w:${TOWN_W};--town-h:${TOWN_H}"><div class="town-map">
      <img class="town-map-art camp-art" src="${townImage}" alt="${escape(t('town.alt'))}"/>
      <span class="town-fire" style="left:${CAMPFIRE.x}%;top:${CAMPFIRE.y}%;width:${CAMPFIRE.w / TOWN_W * 100}%;height:${CAMPFIRE.h / TOWN_H * 100}%;background-image:url(${fireStrip})" aria-hidden="true"></span>
      ${CHIMNEYS.slice(1).map((c, i) => `<span class="town-smoke" style="left:${c.x}%;top:${c.y}%;width:${SMOKE_SIZE.w / TOWN_W * 100}%;height:${SMOKE_SIZE.h / TOWN_H * 100}%;background-image:url(${smokeStrip});animation-delay:${i * -0.5}s" aria-hidden="true"></span>`).join('')}
      ${heroes}
      ${spots}
    </div></div>
    <div class="msg-window camp-copy">
      <h1 id="camp-title">${t('town.name')} <small>${t('town.seals', { n: p.cleared.length, total: CAMPAIGN.length })}</small></h1>
      <div class="camp-guide"><p><b class="guide-label">${t('guide.title')}:</b> ${escape(goal.text)}</p>${go}</div>
      ${story}
    </div>
  </section>`;
}

/** The classic JRPG main menu: party status and commands (on phones the commands come first and the party is a portrait row). */
function moreScene(p: Profile) {
  const ready = QUESTS.filter(q => questProgress(p, q).ready).length, training = trainingBadge(p);
  const items: [string, StringKey, StringKey, number][] = [
    ['data-facility="party"', 'menu.party', 'menu.party.sub', 0],
    ['data-facility="party-advanced"', 'menu.progression', 'menu.progression.sub', training],
    ['data-facility="quests"', 'menu.quests', 'menu.quests.sub', ready],
    ['data-facility="bestiary"', 'menu.bestiary', 'menu.bestiary.sub', 0],
    ['data-facility="challenge-shop"', 'menu.shop', 'menu.shop.sub', 0],
    ['data-open-action="journal"', 'menu.journal', 'menu.journal.sub', 0],
    ['data-open-action="profiles"', 'menu.save', 'menu.save.sub', 0],
    ['data-open-action="settings"', 'menu.settings', 'menu.settings.sub', 0],
    ['data-open-action="title"', 'menu.title', 'menu.title.sub', 0],
  ];
  const party = p.storyActive.length ? p.storyActive : p.roster.slice(0, 3);
  return `<section class="more-scene" aria-labelledby="more-title">
    <h1 id="more-title" class="sr-only">${t('route.menu')}</h1>
    <div class="win menu-party">${party.map(id => { const r = ROSTER[id], lv = heroProgress(p.loadouts[id].xp); return `<div class="menu-hero" title="${escape(r.name)}"><img src="${portrait(r.classId, 0, id)}" alt=""/><div><b>${r.name}</b><small>${escape(JOBS[p.loadouts[id].job ?? '']?.name ?? className(r.classId))}</small></div><div class="menu-hero-stats"><span>LV <b>${lv.level}</b></span><span class="gauge xp" aria-hidden="true"><i style="width:${lv.needed ? lv.current / lv.needed * 100 : 100}%"></i></span></div></div>`; }).join('')}</div>
    <div class="menu-columns">
      <nav class="win menu-list more-grid" aria-label="${t('route.menu')}">${items.map(([attr, title, detail, badge]) => `<button class="menu-item more-card" ${attr}><b>${t(title)}${badge ? ` <i class="menu-badge" aria-hidden="true">${badge}</i><span class="sr-only">${t('menu.badge', { n: badge })}</span>` : ''}</b><span>${t(detail)}</span></button>`).join('')}</nav>
      <div class="win menu-summary"><dl class="stat-table"><div><dt>${t('menu.seals')}</dt><dd>${p.cleared.length}/${CAMPAIGN.length}</dd></div><div><dt>${t('menu.heroes')}</dt><dd>${p.roster.length}/${ROSTER.length}</dd></div><div><dt>${t('menu.victories')}</dt><dd>${p.wins}</dd></div><div><dt>${t('menu.quests.done')}</dt><dd>${p.claimedQuests.length}/${QUESTS.length}</dd></div><div><dt>${t('menu.bestfloor')}</dt><dd>${p.bestFloor}</dd></div></dl></div>
    </div>
  </section>`;
}
function secondaryScene(p: Profile, state: TownState) {
  const tab = state.tab as 'quests' | 'bestiary' | 'challenge-shop' | 'raid' | 'endless';
  const body = tab === 'quests' ? questBoard(p, state.hero, state.questFilter) : tab === 'bestiary' ? bestiary(p, state.bestiaryPick) : tab === 'challenge-shop' ? challengeShop(p) : tab === 'raid' ? raids(p, state) : endless(p, state);
  const modeNav = tab === 'raid' || tab === 'endless' ? expeditionModes(tab, p) : '';
  const deployment = tab === 'raid'
    ? `<div class="deploy-bar secondary-deploy" role="group" aria-label="${t('common.depart')}">${raidQuarryUnlocked(p, state.raid) ? `<button class="btn primary" data-depart="raid">${t('raid.hunt', { name: escape(ENEMIES[state.raid]?.name ?? '?') })} ▶</button>` : `<button class="btn primary" data-depart="raid" disabled>${t('raid.none')}</button>`}</div>`
    : tab === 'endless'
      ? `<div class="deploy-bar secondary-deploy" role="group" aria-label="${t('common.depart')}"><button class="btn primary" data-depart="endless">${t('endless.descend')} ▶</button></div>`
      : '';
  return `<section class="secondary-scene" aria-labelledby="secondary-title"><h1 id="secondary-title" class="sr-only">${routeTitle(state.tab)}</h1>${modeNav}<div class="secondary-content">${body}</div>${deployment}</section>`;
}

/** The gate's mode tabs; modes the story has not reached yet show a lock and the chapter that opens them. */
export function expeditionModes(active: 'campaign' | 'dungeon' | 'raid' | 'endless', p: Profile) {
  return `<nav class="tabs expedition-mode-nav" aria-label="${t('route.campaign')}">${([['campaign', 'route.campaign'], ['dungeon', 'route.dungeon'], ['raid', 'route.raid'], ['endless', 'route.endless']] as const).map(([id, key]) => {
    const feature = isFeature(id) ? id : undefined;
    if (feature && !featureOpen(p, feature)) return `<button class="locked" data-locked="${feature}" aria-disabled="true" aria-label="${escape(`${t(key)} · ${t('unlock.clear', { n: UNLOCKS[feature] })}`)}"><span><i class="tab-lock" aria-hidden="true"></i>${t(key)}</span><small>${t('unlock.ch', { n: UNLOCKS[feature] })}</small></button>`;
    return `<button data-facility="${id}" ${active === id ? 'aria-current="page"' : ''}>${t(key)}${feature && isNew(p, feature) ? ` <i class="tab-new">${t('unlock.new')}</i>` : ''}</button>`;
  }).join('')}</nav>`;
}

export function renderTown(root: HTMLElement, p: Profile, state: TownState) {
  const content = state.tab === 'camp' ? campScene(p) : state.tab === 'dungeon' ? dungeonScene(p, state.dungeonOutcome, expeditionModes('dungeon', p), state.dungeonLetter) : state.tab === 'campaign' || state.tab === 'mission' ? renderWorldMap(p, state) : state.tab === 'party' || state.tab === 'party-advanced' ? training(p, state, state.tab === 'party-advanced') : state.tab === 'more' ? moreScene(p) : secondaryScene(p, state);
  root.innerHTML = `<div class="town-game-shell" data-town-route="${state.tab}"><section class="town-scene" aria-label="${escape(routeTitle(state.tab))}"><p id="town-notice" class="town-notice" role="status" ${state.notice ? '' : 'hidden'}>${escape(state.notice)}</p>${content}</section></div>`;
}

function training(p: Profile, state: TownState, advanced: boolean) {
  const r = ROSTER[state.hero], kit = KITS[r.classId], loadout = p.loadouts[state.hero];
  const progress = heroProgress(loadout.xp);
  const preview = new Battle('raid', 1, profileModifiers(p), { roster: [state.hero], loadouts: p.loadouts }).hero(state.hero)!;
  const tabs: [TrainingTab, StringKey][] = advanced ? [['overview','party.tab.overview'],['jobs','party.tab.jobs'],['talents','party.tab.talents']] : [['formation','party.tab.formation'],['skills','party.tab.skills'],['gear','party.tab.gear']];
  const active = tabs.some(([id]) => id === state.trainingTab) ? state.trainingTab : advanced ? 'overview' : 'formation';
  const panel = active === 'overview' ? trainingOverview(p, state, preview, progress) : active === 'skills' ? skillsPanel(loadout, kit, r.classId) : active === 'jobs' ? advancement(p, state.hero) : active === 'talents' ? talentsPanel(p, state, r, kit, loadout) : active === 'gear' ? forge(p, state.hero, state) : formation(p, state.hero, r, loadout) + storyPartyPanel(p);
  const zone = CAMPAIGN[state.zone];
  const deployable = zone !== undefined && canEnterZone(p, state.zone);
  return `<section class="party-scene" aria-labelledby="party-title" style="--class-color:${kit.color}">
    <h1 id="party-title" class="sr-only">${advanced ? t('route.progression') : t('route.party')}</h1>
    <nav class="party-roster" aria-label="${t('party.choose')}">${p.roster.map(id => { const needs = heroNeeds(p, id).length > 0; return `<button data-town-hero="${id}" class="${state.hero === id ? 'active' : ''}" aria-pressed="${state.hero === id}"${needs ? ` title="${escape(t('party.dot'))}"` : ''}><img src="${portrait(ROSTER[id].classId, 0, id)}" alt=""/><span>${ROSTER[id].name}</span><small>LV ${heroProgress(p.loadouts[id].xp).level}</small>${needs ? `<i class="hero-dot" aria-label="${escape(t('party.dot'))}"></i>` : ''}</button>`; }).join('')}</nav>
    <div class="party-sticky">${heroSheet(p, state.hero, preview, progress)}
    <nav class="tabs training-tabs" aria-label="${t('party.sections')}">${tabs.map(([id,key]) => `<button data-training-tab="${id}" class="${active === id ? 'active' : ''}" aria-current="${active === id ? 'page' : 'false'}">${t(key)}</button>`).join('')}<button class="party-advanced-link" data-facility="${advanced ? 'party' : 'party-advanced'}">${advanced ? `◀ ${t('route.party')}` : `${t('route.progression')} ▶`}</button></nav></div>
    <section class="win training-panel" data-training-panel="${active}">${panel}</section>
    <div class="deploy-bar party-deploy"><button type="button" class="btn primary party-deploy-button" data-depart="adventure" aria-label="${escape(t('party.deploy', { name: zone?.name ?? '' }))}" ${deployable ? '' : 'disabled'}><span>${escape(t('party.deploy', { name: zone?.name ?? '' }))}</span><small>${deployable ? t('party.deploy.go') : t('party.deploy.locked')}</small></button></div>
  </section>`;
}

const SLOTS: ItemSlot[] = ['weapon', 'armor', 'charm'];
const gearOf = (loadout: Profile['loadouts'][number], slot: ItemSlot) => GEAR.find(g => g.id === loadout.gear?.[slot] && g.slot === slot);
const gearStatsLine = (g: typeof GEAR[number]) => [g.power ? `${t('gear.power')} ${percent(g.power)}` : '', g.hp ? `HP ${percent(g.hp)}` : '', g.tempo ? `${t('gear.tempo')} ${percent(g.tempo)}` : ''].filter(Boolean).join(' · ');

function heroSheet(p: Profile, id: number, preview: ReturnType<Battle['hero']> & {}, progress: ReturnType<typeof heroProgress>) {
  const r = ROSTER[id], kit = KITS[r.classId], loadout = p.loadouts[id];
  const job = JOBS[loadout.job ?? ''];
  const exp = progress.needed ? progress.current / progress.needed * 100 : 100;
  const stats: [string, string][] = [[t('power.hero'), fmtInt(heroPower(preview, normalizeStoryParty(p.storyActive, p.roster, p.cleared).length))], ['HP', fmtInt(preview.maxHp)], [t('party.cd'), fmtSec(preview.total, 2)], ['SP', String(availablePoints(p, id))]];
  return `<div class="win hero-sheet training-identity" style="--class-color:${kit.color}">
    <div class="sheet-portrait"><img src="${portrait(r.classId, 0, id)}" alt=""/><span>LV ${progress.level}</span></div>
    <div class="sheet-body"><small>${escape(job?.name ?? kit.name)} · ${escape(kit.role)}</small><h2>${r.name}<span class="sheet-line" aria-hidden="true">LV ${progress.level} · ${stats[0][0]} ${stats[0][1]} · SP ${stats[3][1]}</span></h2>
      <div class="sheet-exp"><span class="gauge xp" aria-hidden="true"><i style="width:${exp}%"></i></span><small>${progress.needed ? `EXP ${progress.current}/${progress.needed}` : t('party.xp.cap')}</small></div>
      <dl class="sheet-stats">${stats.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
    </div>
    <div class="sheet-gear" aria-label="${t('gear.title')}">${SLOTS.map(slot => { const g = gearOf(loadout, slot); return `<span class="sheet-gear-slot ${g ? 'filled' : ''}" title="${t(`gear.slot.${slot}` as StringKey)}: ${escape(g?.name ?? t('gear.none'))}"><img src="${itemIcon(slot, g?.rarity ?? 'common', !g)}" alt="${t(`gear.slot.${slot}` as StringKey)}"/></span>`; }).join('')}</div>
  </div>`;
}

function storyPartyPanel(p: Profile) {
  const cap = storyPartyCap(p.cleared);
  // During an Undercroft run the party is locked: its heroes are marked, and a click explains why instead of toggling.
  const locked = storyPartyLocked(p), below = p.journey.run?.party ?? [];
  return `<details class="story-party ${locked ? 'locked' : ''}" ${emptySlots(p) || locked ? 'open' : ''}><summary>${t('party.story', { n: p.storyActive.length, cap, total: p.roster.length })}</summary><p class="hint">${locked ? t('dungeon.party.locked') : t('party.story.hint')}</p><div class="departure-actions">${p.roster.map(id => { const active = p.storyActive.includes(id); return `<button class="btn ${active ? 'on' : ''}" data-story-toggle="${id}" aria-pressed="${active}" ${locked ? 'aria-disabled="true"' : active ? p.storyActive.length === 1 ? 'disabled' : '' : p.storyActive.length >= cap ? 'disabled' : ''}>${ROSTER[id].name}: ${locked && below.includes(id) ? t('party.story.undercroft') : active ? t('party.story.active') : t('party.story.bench')}</button>`; }).join('')}</div></details>`;
}

function trainingOverview(p: Profile, state: TownState, preview: ReturnType<Battle['hero']> & {}, progress: ReturnType<typeof heroProgress>) {
  const h = p.loadouts[state.hero], kit = KITS[ROSTER[state.hero].classId], e = preview.equipment;
  const rows: [string, string][] = [[t('party.maxhp'), fmtInt(preview.maxHp)], [t('party.opening'), fmtSec(preview.total, 2)], [`${t('gear.power')} (${t('party.tab.gear')})`, percent(e.power - 1)], [`HP (${t('party.tab.gear')})`, percent(e.hp - 1)], [`${t('gear.tempo')} (${t('party.tab.gear')})`, percent(e.tempo - 1)], [t('party.tab.talents'), String(h.talents.length)], [t('party.job'), escape(h.job ? JOBS[h.job]?.name ?? '' : t('party.basejob'))]];
  return `<section class="hero-progression" data-hero-level="${progress.level}"><label>EXP <span>${progress.needed ? t('party.xp.next', { current: progress.current, needed: progress.needed, level: progress.level + 1 }) : t('party.xp.cap')}</span><span class="gauge xp" aria-hidden="true"><i style="width:${progress.needed ? progress.current / progress.needed * 100 : 100}%"></i></span></label>
    <div class="status-points"><span>${t('party.sp')}</span><b data-skill-points>${availablePoints(p, state.hero)}</b></div>
    <h4 class="subheading">${t('party.status.attributes')}</h4><dl class="stat-table">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
    <h4 class="subheading">${t('party.status.loadout')}</h4><div class="status-loadout">${SLOTS.map(slot => { const g = gearOf(h, slot); return `<div class="status-item ${g ? `rarity-${g.rarity ?? 'common'}` : 'empty'}"><img class="item-icon" src="${itemIcon(slot, g?.rarity ?? 'common', !g)}" alt=""/><span><small>${t(`gear.slot.${slot}` as StringKey)}</small><b>${escape(g?.name ?? t('gear.empty'))}</b></span></div>`; }).join('')}${[0, 1].map(slot => { const skill = kit.skills[h.skills[slot]]; return `<div class="status-item skill"><span class="skill-emblem" aria-hidden="true">${escape(skill.label.slice(0, 2))}</span><span><small>${t('party.skills.slot', { n: slot + 1 })}</small><b>${escape(skill.name)}</b></span></div>`; }).join('')}</div>
    <p class="hint">${t('party.overview.hint', { hp: Math.round(LEVEL_HP * 1000) / 10, power: Math.round(LEVEL_POWER * 1000) / 10 })}</p></section>`;
}

function skillsPanel(loadout: Profile['loadouts'][number], kit: typeof KITS[keyof typeof KITS], classId: keyof typeof KITS) {
  // Same rule as equipSkill: talent skills need their talent, job skills only the current job and its parent.
  const unlocked = (index: number) => legalSkill(index, loadout.talents, loadout.job);
  const lockReason = (index: number) => { const job = index >= 4 ? Object.values(JOBS).find(j => j.base === classId && j.index === index) : undefined; return job ? t('party.skills.lock.jobname', { job: escape(job.name) }) : index >= 4 ? t('party.skills.lock.job') : t('party.skills.lock.talent'); };
  const slotCard = (slot: number) => { const skill = kit.skills[loadout.skills[slot]]; return `<div class="skill-slot" data-loadout-slot="${slot}"><small>${t('party.skills.slot', { n: slot + 1 })}${slot === 0 ? ` · ${t('party.skills.opening')}` : ''}</small><b>${escape(skill.name)}</b><span>${escape(skill.label)} · ${fmtSec(skill.cooldown)}</span></div>`; };
  const card = (skill: typeof kit.skills[number], index: number) => {
    const open = unlocked(index), slot = loadout.skills.indexOf(index);
    return `<article class="skill-card ${slot >= 0 ? 'equipped' : ''} ${open ? '' : 'locked'}" data-skill-card="${index}">
      <span class="skill-emblem" aria-hidden="true">${escape(skill.label.slice(0, 2))}</span>
      <div class="skill-card-body"><b>${escape(skill.name)}</b><small>${escape(skill.label)} · ${fmtSec(skill.cooldown)}${slot >= 0 ? ` · ${t('party.skills.slot', { n: slot + 1 })}` : ''}</small><p>${escape(skill.description)}</p>${open ? '' : `<em class="skill-lock">${lockReason(index)}</em>`}</div>
      ${open ? `<div class="skill-card-actions">${[0, 1].map(s => `<button class="btn" data-equip-skill="${index}" data-skill-slot="${s}" aria-pressed="${loadout.skills[s] === index}" aria-label="${escape(t('party.skills.equip', { name: skill.name, n: s + 1 }))}" ${loadout.skills[s] === index ? 'disabled' : ''}>${['I', 'II'][s]}</button>`).join('')}</div>` : ''}
    </article>`;
  };
  return `<h3 class="subheading">${t('party.skills.title')} <span>${t('party.skills.sub')}</span></h3><div class="skill-loadout">${[0, 1].map(slotCard).join('')}</div><h4 class="subheading skill-book-title">${t('party.skills.book')} <span>${t('party.skills.book.sub')}</span></h4><div class="skill-book">${kit.skills.map(card).join('')}</div><p class="hint">${t('party.skills.hint')}</p>`;
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
    const isLearned = loadout.talents.includes(node.id), available = !isLearned && !talentReason(p, state.hero, node);
    return `<button data-inspect-talent="${node.id}" class="talent-flow-node ${node.id === chosen?.id ? 'chosen' : ''} ${isLearned ? 'learned' : available ? 'available' : 'locked'} ${node.exclusive ? 'keystone' : ''}" aria-label="${escape(node.name)}"><i class="talent-gem" aria-hidden="true">${isLearned ? '✓' : node.exclusive ? '★' : '◆'}</i><b>${escape(node.name)}</b><span>${isLearned ? t('talent.learned.short') : `${fmtInt(node.cost)}G${node.points ? ` · ${node.points} SP` : ''}`}</span></button>`;
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
    return `<div class="talent-node-wrap">${arrows}<button class="talent-node ${owned ? 'learned' : ''}" data-talent="${talent.id}" ${reason ? 'disabled' : ''}><small>${talent.exclusive ? t('talent.keystone') : active ? t('talent.active') : t('talent.passive')}${talent.level ? ` · LV ${talent.level}` : ''}</small><b>${escape(name)}</b><span>${escape(description)}</span><strong>${owned ? t('talent.learned.short') : reason ? escape(lockText(reason)) : `${t('talent.learn')} · ${fmtInt(talent.cost)}G${talent.points ? ` + ${talent.points} SP` : ''}`}</strong></button></div>`;
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
      const state = owned ? t('talent.learned.short') : !eligible ? t('job.otherpath') : level < job.level ? t('job.rank', { n: job.level }) : `${fmtInt(job.cost)}G`;
      return `<button data-promote="${job.id}" class="job-node ${owned ? 'learned' : ''}" ${disabled ? 'disabled' : ''}><small>${job.tier === 2 ? t('job.advanced') : t('job.third')} · ${t('job.rank', { n: job.level })}</small><b>${escape(job.name)}</b><span>${escape(job.description)}</span><em>${t('job.unlock', { name: escape(job.skill.name) })}</em><strong>${state}</strong></button>`;
    });
    return `<section>${cards.join('<span class="job-connector" aria-hidden="true">▼</span>')}</section>`;
  }).join('');
  return `<h3 class="subheading">${t('job.title')} <span>${t('job.sub')}</span></h3><div class="job-paths">${paths}</div><p class="hint">${t('job.hint')}</p><div class="departure-actions"><button class="btn" data-respec ${h.talents.length || h.job ? '' : 'disabled'}>${t('party.respec', { name: ROSTER[id].name })}</button></div>`;
}

function forge(p: Profile, id: number, state: TownState) {
  const h = p.loadouts[id];
  const pending = state.pendingGear?.hero === id ? state.pendingGear : undefined;
  const activeSlot: ItemSlot = pending?.slot ?? state.gearSlot ?? 'weapon';
  const selected = pending ? GEAR.find(g => g.id === pending.gearId && g.slot === pending.slot) : undefined;
  const current = selected ? GEAR.find(g => g.id === h.gear?.[selected.slot]) : undefined;
  const reason = selected ? gearReason(p, id, selected.id) : '', owned = Boolean(selected && h.inventory?.includes(selected.id));
  // Compare what the hero would really fight with: refined stats for owned pieces (refine applies only to owned items).
  const refined = (g?: typeof GEAR[number]) => g ? gearStats({ [g.slot]: g.id }, h.inventory?.includes(g.id) ? h.refine : {}) : { power: 1, hp: 1, tempo: 1 };
  const plus = (g?: typeof GEAR[number]) => g && h.refine?.[g.id] && h.inventory?.includes(g.id) ? ` +${h.refine[g.id]}` : '';
  const next = refined(selected), now = refined(current);
  const comparison = selected ? `${current && current.id !== selected.id ? `<p class="gear-current">${t('gear.current')}: <b>${escape(current.name)}${plus(current)}</b></p>` : ''}<dl class="stat-table gear-comparison"><div><dt>${t('gear.power')}</dt><dd>${percent(next.power - now.power)}</dd></div><div><dt>HP</dt><dd>${percent(next.hp - now.hp)}</dd></div><div><dt>${t('gear.tempo')}</dt><dd>${percent(next.tempo - now.tempo)}</dd></div></dl>` : '';
  const slotButton = (slot: ItemSlot) => {
    const g = gearOf(h, slot);
    return `<button class="equip-slot ${slot === activeSlot ? 'active' : ''} ${g ? `rarity-${g.rarity ?? 'common'}` : 'empty'}" data-gear-open="${slot}" aria-pressed="${slot === activeSlot}"><img class="item-icon" src="${itemIcon(slot, g?.rarity ?? 'common', !g)}" alt=""/><span><small>${t(`gear.slot.${slot}` as StringKey)}</small><b>${escape(g?.name ?? t('gear.empty'))}${g && h.refine?.[g.id] ? ` +${h.refine[g.id]}` : ''}</b><em>${g ? gearStatsLine(g) : t('gear.none')}</em></span></button>`;
  };
  const items = GEAR.filter(g => g.slot === activeSlot && (!g.classId || g.classId === ROSTER[id].classId)).map(g => {
    const owned = h.inventory?.includes(g.id), equipped = h.gear?.[activeSlot] === g.id, why = gearReason(p, id, g.id);
    const tag = equipped ? t('gear.tag.equipped') : owned ? t('gear.owned') : g.source === 'quest' ? t('gear.quest') : `${fmtInt(g.cost)}G`;
    return `<button class="item-card rarity-${g.rarity ?? 'common'} ${equipped ? 'equipped' : ''} ${selected?.id === g.id ? 'chosen' : ''} ${why && !equipped ? 'unavailable' : ''}" data-gear-item="${g.id}" data-gear-slot-for="${activeSlot}" aria-pressed="${selected?.id === g.id}"><img class="item-icon" src="${itemIcon(activeSlot, g.rarity ?? 'common')}" alt=""/><span class="item-main"><b>${escape(g.name)}</b><small>LV ${g.minLevel ?? 1}${g.classId ? ` · ${className(g.classId as keyof typeof KITS)}` : ''} · ${gearStatsLine(g)}</small></span><em>${escape(tag)}</em></button>`;
  }).join('');
  const preview = selected ? `<section class="gear-preview rarity-${selected.rarity ?? 'common'}" data-gear-preview="${selected.id}" aria-live="polite"><small>${t('gear.inspect')} · ${t(`rarity.${selected.rarity ?? 'common'}` as StringKey)}</small><h3>${escape(selected.name)}${plus(selected)}</h3><p>${escape(selected.description)}</p><p>${t('gear.req')}: ${selected.minLevel ? `LV ${selected.minLevel}` : t('gear.req.none')}${selected.classId ? ` · ${className(selected.classId as keyof typeof KITS)}` : ''}${owned ? ` · ${t('gear.owned')}` : selected.source === 'quest' ? ` · ${t('gear.quest')}` : ` · ${fmtInt(selected.cost)}G`}</p>${comparison}<p class="gear-preview-status">${reason ? escape(lockText(reason)) : current?.id === selected.id ? t('gear.equipped') : t('gear.ready')}</p><div class="gear-preview-actions"><button class="btn primary" data-confirm-gear ${reason || current?.id === selected.id ? 'disabled' : ''}>${owned ? t('gear.equip') : t('gear.confirm')}</button><button class="btn" data-cancel-gear>${t('common.cancel')}</button></div></section>` : `<p class="hint gear-preview-empty">${t('gear.hint')}</p>`;
  const equipped = gearOf(h, activeSlot), level = equipped ? h.refine?.[equipped.id] ?? 0 : 0, cost = equipped ? refineCost(equipped.id, level) : undefined;
  const materials = (['ember-shard', 'bell-bronze', 'frost-glass'] as const).map(id => `<span class="mat-chip"><img src="${dungeonIcon(id)}" alt=""/>${escape(t(`material.${id}` as StringKey))} ×${p.economy.materials[id] ?? 0}</span>`).join('');
  const refine = equipped ? `<div class="refine-row"><div><b>${escape(equipped.name)}${level ? ` +${level}` : ''}</b><small>${t('gear.refine.hint', { n: Math.round(REFINE_STEP * 100) })}</small></div>${cost ? `<button class="btn" data-refine="${equipped.id}" ${p.gold >= cost.gold && (p.economy.materials[cost.material] ?? 0) >= cost.amount ? '' : 'disabled'}><span>${t('gear.refine', { n: level + 1 })}</span><small>${t('gear.refine.cost', { gold: cost.gold, mat: t(`material.${cost.material}` as StringKey), n: cost.amount })}</small></button>` : `<em>${t('gear.refine.max', { n: MAX_REFINE })}</em>`}</div>` : '';
  return `<h3 class="subheading">${t('gear.title')} <span>${t('gear.sub')}</span></h3><div class="gear-slots equip-slots">${SLOTS.map(slotButton).join('')}</div><div class="mat-bar" aria-label="${t('gear.materials')}">${materials}</div>${refine}${preview}<h4 class="subheading">${t(`gear.slot.${activeSlot}` as StringKey)} <span>${t('gear.list.sub')}</span></h4><div class="item-list">${items}</div><details class="gear-set-status"><summary>${t('gear.sets')}</summary>${GEAR_SETS.map(set => { const count = Object.entries(h.gear ?? {}).filter(([slot, gearId]) => GEAR.some(g => g.id === gearId && g.slot === slot && g.setId === set.id)).length; return `<p><b>${escape(set.name)} · ${count}/3</b><br>${escape(set.description)} ${count >= 3 ? t('gear.set.all') : count >= 2 ? t('gear.set.two') : ''}</p>`; }).join('')}</details>`;
}

function formation(p: Profile, id: number, r: typeof ROSTER[number], loadout: Profile['loadouts'][number]) {
  // The grid shows the deployed story party; a benched hero is previewed on its preferred tile.
  const deployed = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  const benched = !deployed.includes(id);
  return `<h3 class="subheading">${t('formation.title')} <span>${t('formation.sub', { name: r.name })}</span></h3><div class="formation-grid" aria-label="${t('formation.title')}">${Array.from({ length: 9 }, (_, slot) => { const hero = deployed.find(heroId => heroId !== id && p.loadouts[heroId].slot === slot) ?? (loadout.slot === slot ? id : undefined); const row = slot < 3 ? t('formation.front') : slot < 6 ? t('formation.mid') : t('formation.back'); return `<button data-formation="${slot}" class="${loadout.slot === slot ? 'chosen' : ''}" aria-label="${t('formation.tile', { n: slot + 1 })}${hero !== undefined ? `, ${ROSTER[hero].name}` : ''}"><small>${row}</small>${hero !== undefined ? `<img src="${portrait(ROSTER[hero].classId, 0, hero)}" alt=""/><span>${ROSTER[hero].name}</span>` : `<span class="empty">${t('formation.empty')}</span>`}</button>`; }).join('')}</div><p class="hint">${benched ? t('formation.benched', { name: r.name }) : t('formation.hint')}</p><div class="departure-actions"><button class="btn" data-respec ${loadout.talents.length || loadout.job ? '' : 'disabled'}>${t('party.respec', { name: r.name })}</button></div>`;
}

/** Bestiary families (archetypes); the ledger records kills per family, so a family is seen once one of its variants fell. */
const FAMILIES = Object.values(ENEMIES).filter(e => !e.archetype || e.archetype === e.id);
const seenFamily = (p: Profile, id: string) => (p.ledger.enemies[id] ?? 0) > 0;
/** The enemy as a dark silhouette for entries not met yet (cached by id). */
function silhouette(id: string) {
  const key = `shadow-${id}`;
  if (!portraits.has(key)) {
    const art = monsterCanvas(id), out = document.createElement('canvas');
    out.width = art.width; out.height = art.height;
    const c = out.getContext('2d', { willReadFrequently: true })!; c.imageSmoothingEnabled = false; c.drawImage(art, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#0b1714'; c.fillRect(0, 0, out.width, out.height);
    portraits.set(key, out.toDataURL());
  }
  return portraits.get(key)!;
}
/** A grid of every enemy family (silhouettes until met) with a detail sheet for the picked one. */
function bestiary(p: Profile, pick?: string) {
  const fallback = FAMILIES.find(e => seenFamily(p, e.id)) ?? FAMILIES[0];
  const chosen = ENEMIES[pick ?? ''] ?? fallback, family = chosen.archetype ?? chosen.id, seen = seenFamily(p, family);
  const variants = Object.values(ENEMIES).filter(e => (e.archetype ?? e.id) === family);
  const detail = seen
    ? `<article class="win bestiary-detail" data-bestiary-entry="${chosen.id}"><div class="bestiary-art"><img src="${monsterDataURL(chosen.id)}" alt="${escape(chosen.name)}"/></div><div><small>${escape(chosen.title)} · ${t('bestiary.tier', { n: chosen.tier ?? 1 })}</small><h3>${escape(chosen.name)}</h3><div class="bestiary-variants" role="group" aria-label="${t('bestiary.variants')}">${variants.map(v => `<button class="raid-variant-chip ${v.id === chosen.id ? 'chosen' : ''}" data-bestiary-pick="${v.id}" aria-pressed="${v.id === chosen.id}">T${v.tier ?? 1}</button>`).join('')}</div><p>${escape(chosen.description)}</p><p class="intent-row">${intentChips(chosen.id, chosen.patterns)}</p><p class="counter-note"><b>${t('bestiary.counter')}</b> ${escape(chosen.counter)}</p></div></article>`
    : `<article class="win bestiary-detail unseen" data-bestiary-entry="${family}"><div class="bestiary-art"><img src="${silhouette(family)}" alt=""/></div><div><h3>???</h3><p class="hint">${t('bestiary.unseen')}</p></div></article>`;
  const grid = FAMILIES.map(e => { const known = seenFamily(p, e.id); return `<button class="bestiary-cell ${known ? '' : 'unseen'} ${family === e.id ? 'chosen' : ''}" data-bestiary-pick="${e.id}" aria-pressed="${family === e.id}" aria-label="${known ? escape(e.name) : t('bestiary.unknown')}"><img src="${known ? monsterDataURL(e.id) : silhouette(e.id)}" alt=""/><b>${known ? escape(e.name) : '???'}</b></button>`; }).join('');
  return `<div class="bestiary-list" data-seen="${FAMILIES.filter(e => seenFamily(p, e.id)).length}"><p class="bestiary-count">${t('bestiary.seen', { n: FAMILIES.filter(e => seenFamily(p, e.id)).length, total: FAMILIES.length })}</p>${detail}<div class="win bestiary-grid" role="group" aria-label="${t('bestiary.grid')}">${grid}</div><p class="hint">${t('bestiary.hint')}</p></div>`;
}

/** The Bell Tonic toggle shared by the Raid and Roguelike setups. */
function tonicToggle(p: Profile, state: TownState) {
  const item = bankShopItem(BELL_TONIC)!, affordable = p.economy.commanderCrystal >= item.cost;
  return `<label class="raid-modifier bell-tonic"><input type="checkbox" data-bell-tonic ${state.tonic && affordable ? 'checked' : ''} ${affordable ? '' : 'disabled'}/><span><b>${escape(item.name)} · ${fmtInt(item.cost)} ◆</b><small>${escape(item.description)}</small></span></label>`;
}

function raids(p: Profile, state: TownState) {
  const quarry = openRaidQuarry(p, state.raid) ?? state.raid;
  const selected = ENEMIES[quarry] ?? ENEMIES.golem, base = selected.archetype ?? selected.id;
  const build = state.raidBuild && validRaidBuild(state.raidBuild, p.roster) ? state.raidBuild : defaultRaidBuild(p);
  const contract = state.raidSandbox ? undefined : getRaidContractForEnemy(quarry, state.raidTier, state.raidModifiers);
  const tiers = (['bronze', 'silver', 'gold'] as const).map(tier => {
    const tierContract = getRaidContractForEnemy(quarry, tier, state.raidModifiers);
    return `<option value="${tier}" ${state.raidTier === tier ? 'selected' : ''} ${tierContract ? '' : 'disabled'}>${t(`raid.tier.${tier}` as StringKey)} · ${tierContract ? t('raid.tier.reward', { risk: tierContract.riskPoints, n: raidReward(tierContract, quarry) }) : t('raid.sandbox')}</option>`;
  }).join('');
  // Only simulated modifiers can be ticked; authored-but-unbuilt ones are listed as not yet available.
  const modifiers = RAID_MODIFIERS.map(raw => localizedRaidModifier(raw, lang())).map(modifier => { const ready = raidModifierAvailable(modifier.id), on = ready && state.raidModifiers.includes(modifier.id), open = ready && (on || state.raidModifiers.length < 3); return `<label class="raid-modifier ${ready ? '' : 'unavailable'}"><input type="checkbox" data-raid-modifier="${modifier.id}" ${on ? 'checked' : ''} ${open ? '' : 'disabled'}/><span><b>${escape(modifier.name)}</b><small>${escape(ready ? modifier.description : t('raid.modifier.soon'))}</small></span></label>`; }).join('');
  const taken = new Set(build.slots.map(slot => slot.heroId));
  const party = build.slots.map((slot, index) => `<div class="raid-party-slot"><span>${index + 1}.</span><select data-raid-hero="${index}" aria-label="${t('raid.hero', { n: index + 1 })}">${p.roster.map(id => `<option value="${id}" ${slot.heroId === id ? 'selected' : ''} ${slot.heroId !== id && taken.has(id) ? 'disabled' : ''}>${t('raid.hero.option', { name: ROSTER[id].name, lv: heroProgress(p.loadouts[id]?.xp).level })}</option>`).join('')}</select><select data-raid-job="${index}" aria-label="${t('raid.job', { n: index + 1 })}">${RAID_BASIC_JOBS.map(job => `<option value="${job}" ${slot.classId === job ? 'selected' : ''}>${escape(KITS[job].name)}</option>`).join('')}</select></div>`).join('');
  const sandbox = state.raidSandbox;
  const status = contract && !sandbox ? t('raid.contract', { n: raidReward(contract, quarry) }) : t('raid.sandbox.short');
  const total = contract && !sandbox ? t('raid.total', { tier: t(`raid.tier.${contract.tier}` as StringKey), pacts: contract.modifiers.length, n: raidReward(contract, quarry) }) : t('raid.total.practice');
  const quarries = RAID_QUARRIES.map(id => raidQuarryUnlocked(p, id)
    ? `<button data-raid="${id}" class="${base === id ? 'chosen' : ''}" aria-pressed="${base === id}"><img src="${monsterDataURL(id)}" alt=""/><b>${escape(ENEMIES[id].name)}</b></button>`
    : `<button data-raid="${id}" class="locked" disabled aria-label="${t('raid.locked', { n: raidQuarryUnlockAt(id) })}"><span class="raid-lock" aria-hidden="true">?</span><b>???</b><small>${t('raid.locked', { n: raidQuarryUnlockAt(id) })}</small></button>`).join('');
  const variants = Object.values(ENEMIES).filter(e => e.archetype === base).map(e => `<button class="raid-variant-chip ${quarry === e.id ? 'chosen' : ''}" data-raid-variant="${e.id}" aria-pressed="${quarry === e.id}">T${e.tier ?? 1} · ${escape(e.name)}</button>`).join('');
  return `<article class="win mission-brief raid-departure"><img class="brief-art" src="${monsterDataURL(selected.id)}" alt=""/><div><small>${status}</small><h3>${escape(selected.name)}</h3><p>${escape(selected.title)}</p><p class="counter-note">${escape(selected.counter)}</p></div></article>
  <div class="win raid-pick"><h3 class="subheading">${t('raid.quarry')}</h3><div class="raid-roster">${quarries}</div>
  <div class="raid-variants" role="group" aria-label="${t('raid.variant')}">${variants}</div>
  <label class="raid-tier">${t('raid.reward')}<select data-raid-tier aria-label="${t('raid.reward')}">${tiers}</select></label><p class="raid-total" data-raid-total>${total}</p></div>
  <details class="win" open><summary>${t('raid.party', { n: build.slots.length })}</summary><label class="raid-party-size">${t('raid.size')}<select data-raid-party-size aria-label="${t('raid.size')}">${[1,2,3,4,5,6].map(size => `<option value="${size}" ${build.slots.length === size ? 'selected' : ''} ${size > p.roster.length ? 'disabled' : ''}>${size}</option>`).join('')}</select></label><div class="raid-party-grid">${party}</div><p class="hint">${t('raid.party.hint')}</p>${tonicToggle(p, state)}</details>
  <section class="win raid-modifiers-box"><h3 class="subheading">${t('raid.modifiers')}</h3><fieldset class="raid-modifiers"><legend class="sr-only">${t('raid.modifiers')}</legend>${modifiers}</fieldset><p class="hint">${t('raid.modifiers.hint')}</p></section>
  <details class="win raid-sandbox"><summary>${t('raid.practice')}</summary><p class="hint">${t('raid.practice.hint')}</p>
    <label>${t('raid.slider.hp')} <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.hpScale ?? 1}" data-raid-sandbox="hpScale"/><output>${fmtDec(sandbox?.hpScale ?? 1)}×</output></label>
    <label>${t('raid.slider.damage')} <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.damageScale ?? 1}" data-raid-sandbox="damageScale"/><output>${fmtDec(sandbox?.damageScale ?? 1)}×</output></label>
    <label>${t('raid.slider.interval')} <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.intervalScale ?? 1}" data-raid-sandbox="intervalScale"/><output>${fmtDec(sandbox?.intervalScale ?? 1)}×</output></label>
  </details>`;
}

function challengeShop(p: Profile) {
  return `<div class="win shop-keeper"><p>${t('shop.greeting')}</p><span class="shop-purse">${t('shop.purse', { n: p.economy.commanderCrystal })}</span></div><section class="challenge-shop-grid"><article class="win"><h3 class="subheading">${t('shop.bank')}</h3>${BANK_SHOP.map(item => { const owned = p.challengeUnlocks.includes(item.id); return `<div class="shop-item"><div><h4>${escape(item.name)}</h4><p>${escape(item.description)}</p></div>${item.consumable ? `<span class="shop-cost consumable" data-bank-consumable="${item.id}">${fmtInt(item.cost)} ◆<small>${t('shop.atdeparture')}</small></span>` : `<button class="btn ${owned ? '' : 'primary'}" data-bank-buy="${item.id}" ${owned || p.economy.commanderCrystal < item.cost ? 'disabled' : ''}>${owned ? t('shop.owned') : `${fmtInt(item.cost)} ◆`}</button>`}</div>`; }).join('')}</article><article class="win"><h3 class="subheading">${t('shop.journey')}</h3><p class="hint">${t('shop.journey.hint')}</p>${CHALLENGE_SHOP.map(item => `<div class="shop-item"><div><h4>${escape(item.name)}</h4><p>${escape(item.description)}</p></div><span class="shop-cost">${fmtInt(item.cost)} ◇</span></div>`).join('')}</article></section>`;
}

function endless(p: Profile, state: TownState) {
  const build = state.rogueSetup ?? createRogueBuild();
  return `<article class="win mission-brief"><div><small>${t('endless.best', { n: p.bestFloor })}</small><h3>${t('route.endless')}</h3><p>${t('endless.intro')}</p></div></article>
  <fieldset class="win loadout-slots"><legend>${t('endless.recruits')}</legend>${build.recruits.map((r, i) => `<label>${t('endless.recruit', { n: i + 1 })}<select data-rogue-slot="${i}" aria-label="${t('endless.recruit', { n: i + 1 })}">${BASIC_JOBS.map(id => `<option value="${id}" ${r.classId === id ? 'selected' : ''}>${KITS[id].name}</option>`).join('')}</select></label>`).join('')}<p class="hint">${t('endless.recruits.hint')}</p></fieldset>
  <div class="win endless-kit">${RELIC_IDS.some(id => p.challengeUnlocks.includes(id)) ? `<p class="hint" data-relics>${t('endless.relics', { list: BANK_SHOP.filter(item => RELIC_IDS.includes(item.id) && p.challengeUnlocks.includes(item.id)).map(item => escape(item.name)).join(', ') })}</p>` : ''}${tonicToggle(p, state)}</div>
  <div class="win endless-rules"><p><b>${t('endless.rule1.title')}</b> ${t('endless.rule1')}</p><p><b>${t('endless.rule2.title')}</b> ${t('endless.rule2')}</p><p><b>${t('endless.rule3.title')}</b> ${t('endless.rule3')}</p><p><b>${t('endless.rule4.title')}</b> ${t('endless.rule4')}</p></div>
  <div class="departure-actions"><button class="btn" data-facility="challenge-shop">${t('route.shop')}</button></div>`;
}
