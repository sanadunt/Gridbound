import { KITS, ROSTER } from '../game/content';
import { CAMPAIGN, ENEMIES } from '../game/world';
import { TALENTS, canEnterZone, talentReason, availablePoints, gearReason, profileModifiers, type Profile } from '../game/profile';
import { JOBS, GEAR, GEAR_SETS, legalSkill } from '../game/jobs';
import { heroProgress } from '../game/levels';
import { storyPartyCap } from '../game/story-party';
import { BASIC_JOBS, createRogueBuild, type RogueBuild } from '../game/roguelike-build';
import { Battle } from '../game/simulation';
import { BANK_SHOP, CHALLENGE_SHOP, RAID_MODIFIERS, getRaidContractForEnemy, raidReward, type RaidModifierId, type RaidSandbox, type RaidTier } from '../economy/challenge';
import { createRaidBuild, validRaidBuild, type RaidBuild } from '../game/raid-build';
import { questBoard } from './quests';
import { CHARACTERS } from '../game/characters';
import { heroCanvas } from '../art/pixels';
import { monsterCanvas, townCanvas } from '../art/monsters';
import { renderWorldMap } from './world-map';

export type TownTab = 'campaign' | 'party' | 'bestiary' | 'quests' | 'raid' | 'endless' | 'challenge-shop';
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
let townImage = '';
export function portrait(classId: keyof typeof KITS) {
  if (!portraits.has(classId)) portraits.set(classId, heroCanvas(classId).toDataURL());
  return portraits.get(classId)!;
}
function monster(id: string) {
  const key = `enemy-${id}`;
  if (!portraits.has(key)) portraits.set(key, monsterCanvas(id).toDataURL());
  return portraits.get(key)!;
}
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const pager = (kind: 'campaign'|'quest'|'bestiary', page: number, total: number) => total <= 1 ? '' : `<nav class="page-controls" aria-label="Page ${kind}"><button class="secondary-button" data-${kind}-page="-1" ${page <= 0 ? 'disabled' : ''}>← Previous</button><span>PAGE ${page + 1} / ${total}</span><button class="secondary-button" data-${kind}-page="1" ${page >= total - 1 ? 'disabled' : ''}>Next →</button></nav>`;
const percent = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;

export function renderTown(root: HTMLElement, p: Profile, state: TownState) {
  townImage ||= townCanvas().toDataURL();
  root.innerHTML = `
    <section class="town-panorama" aria-labelledby="town-title">
      <img src="${townImage}" alt="Emberhollow, desa hutan dengan menara lonceng, rumah-rumah dan api unggun" />
      <div class="town-crest-corner tl" aria-hidden="true"></div>
      <div class="town-crest-corner tr" aria-hidden="true"></div>
      <div class="town-crest-corner bl" aria-hidden="true"></div>
      <div class="town-crest-corner br" aria-hidden="true"></div>
      <div class="town-embers" aria-hidden="true">
        <span class="town-ember"></span>
        <span class="town-ember"></span>
        <span class="town-ember"></span>
        <span class="town-ember"></span>
        <span class="town-ember"></span>
        <span class="town-ember"></span>
      </div>
      <div class="town-caption">
        <span class="eyebrow"><span class="eyebrow-pip">◆</span> SANCTUARY · NO ENEMIES HERE <span class="eyebrow-pip">◆</span></span>
        <h1 id="town-title">Emberhollow</h1>
        <p>Lonceng terakhir masih menyala. Selama itu, kita punya rumah.</p>
      </div>
      <span class="town-rest"><span class="rest-pip">✦</span> Party dipulihkan penuh setiap pulang</span>
    </section>
    <div class="town-layout">
      <details class="town-sidebar" open><summary><span class="sidebar-label">Party · The Bellkeepers</span><span class="sidebar-rank">RANK ${p.cleared.length + 1}</span></summary>
        <p class="section-label">THE BELLKEEPERS <span>RANK ${p.cleared.length + 1}</span></p>
        <div class="town-roster">${p.roster.map(id => {
          const r = ROSTER[id];
          return `<button data-town-hero="${id}" class="town-hero ${state.hero === id ? 'chosen' : ''}" aria-label="Siapkan ${r.name}"><span class="hero-avatar"><img src="${portrait(r.classId)}" alt=""/></span><span class="hero-details"><b>${r.name}</b><small>${JOBS[p.loadouts[id].job??'']?.name??KITS[r.classId].name}</small></span><span class="ready-dot">Lv.${heroProgress(p.loadouts[id].xp).level}</span></button>`;
        }).join('')}</div>
        <p class="town-note">Story: ${p.storyActive.length}/${storyPartyCap(p.cleared)} aktif, ${p.roster.length-p.storyActive.length} bench. Semua loadout tetap tersimpan. Atur party di Training hall.</p>
        <div class="town-progress"><b>${p.cleared.length} / ${CAMPAIGN.length}</b><span>SEALS RESTORED</span></div>
      </details>
      <section class="town-content" aria-label="Fasilitas kota">
        <nav class="facility-tabs" aria-label="Fasilitas"><button data-facility="campaign" class="${state.tab === 'campaign' ? 'active' : ''}"><span class="fac-icon">⚔</span> War table</button><button data-facility="party" class="${state.tab === 'party' ? 'active' : ''}"><span class="fac-icon">🛡</span> Training hall</button><button data-facility="quests" class="${state.tab === 'quests' ? 'active' : ''}"><span class="fac-icon">📜</span> Quest ledger</button><button data-facility="bestiary" class="${state.tab === 'bestiary' ? 'active' : ''}"><span class="fac-icon">👁</span> Bestiary</button><button data-facility="challenge-shop" class="${state.tab === 'challenge-shop' ? 'active' : ''}"><span class="fac-icon">💎</span> Challenge shop</button></nav>
        <p id="town-notice" class="town-notice" role="status" ${state.notice ? '' : 'hidden'}>${escape(state.notice)}</p>
        <div class="facility-panel-wrap">
          ${state.tab === 'campaign' ? campaign(p, state) : state.tab === 'party' ? training(p, state) : state.tab === 'quests' ? questBoard(p, state.hero, state.questFilter, state.questPage) : state.tab === 'bestiary' ? bestiary(state.bestiaryPage) : state.tab === 'raid' ? raids(p, state) : state.tab === 'challenge-shop' ? challengeShop(p) : endless(p,state)}
        </div>
      </section>
    </div>`;
}

function campaign(p: Profile, state: TownState) {
  return renderWorldMap(p, state);
}

function training(p: Profile, state: TownState) {
  const r = ROSTER[state.hero], kit = KITS[r.classId], loadout = p.loadouts[state.hero];
  const progress = heroProgress(loadout.xp);
  const preview = new Battle('raid', 1, profileModifiers(p), { roster: [state.hero], loadouts: p.loadouts }).hero(state.hero)!;
  const active = state.trainingTab ?? 'talents';
  const tabs: [TrainingTab, string][] = [['overview','Overview'],['skills','Active skills'],['jobs','Jobs'],['talents','Talent branches'],['gear','Equipment'],['formation','Formation']];
  const panel = storyPartyPanel(p) + (active === 'overview' ? trainingOverview(p, state, r, preview, progress) : active === 'skills' ? skillsPanel(loadout, kit) : active === 'jobs' ? advancement(p, state.hero) : active === 'talents' ? talentsPanel(p, state, r, kit, loadout) : active === 'gear' ? forge(p, state.hero, state) : formation(p, state.hero, r, loadout));
  return `<div class="training-identity"><img src="${portrait(r.classId)}" alt="${r.name}"/><div><span class="eyebrow">${JOBS[loadout.job??'']?.name??kit.name} · LEVEL ${progress.level}</span><h2>${r.name}</h2><p>${kit.role}</p></div></div>${active === 'overview' ? `<p class="character-bio">${CHARACTERS[state.hero].bio}</p>` : ''}<nav class="training-tabs" aria-label="Training sections">${tabs.map(([id,label]) => `<button data-training-tab="${id}" class="${active === id ? 'active' : ''}" aria-current="${active === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav><section class="training-panel" data-training-panel="${active}">${panel}</section>`;
}

function storyPartyPanel(p: Profile) {
  const cap=storyPartyCap(p.cleared);
  return `<details class="story-party" open><summary>Story party: ${p.storyActive.length}/${cap} active · ${p.roster.length}/9 recruited</summary><div class="party-status-ribbon"><span class="hud-chip">👥 ACTIVE ${p.storyActive.length}/${cap}</span><span class="hud-chip">💤 BENCH ${p.roster.length-p.storyActive.length}</span><span class="hud-chip gold">⚡ 50% BENCH XP</span></div><div class="departure-actions">${p.roster.map(id=>{const active=p.storyActive.includes(id);return `<button class="secondary-button" data-story-toggle="${id}" aria-pressed="${active}" ${active?p.storyActive.length===1?'disabled':'':p.storyActive.length>=cap?'disabled':''}>${ROSTER[id].name}: ${active?'Active → bench':'Bench → active'}</button>`;}).join('')}</div><p>Swap saat penuh: bench satu hero, lalu aktifkan penggantinya.</p></details>`;
}

function trainingOverview(p: Profile, state: TownState, r: typeof ROSTER[number], preview: ReturnType<Battle['hero']> & {}, progress: ReturnType<typeof heroProgress>) {
  const h = p.loadouts[state.hero];
  return `<section class="hero-progression" data-hero-level="${progress.level}"><label>Hero XP <span>${progress.needed ? `${progress.current} / ${progress.needed} to Lv.${progress.level + 1}` : 'LEVEL CAP · 40'}</span><progress max="${progress.needed || 1}" value="${progress.needed ? progress.current : 1}"></progress></label><dl><div><dt>Max HP</dt><dd>${preview.maxHp}</dd></div><div><dt>Opening cooldown</dt><dd>${preview.total.toFixed(2)}s</dd></div><div><dt>Skill points</dt><dd data-skill-points>${availablePoints(p, state.hero)}</dd></div></dl><p>+2% base HP dan +1,5% base power per level. XP diperoleh saat expedition selesai; quest memberi XP kepada penerima pilihanmu.</p></section><div class="training-overview-grid"><article><span class="eyebrow">BUILD SNAPSHOT</span><h3>${h.talents.length} talents · ${h.job ? JOBS[h.job]?.name : 'Base class'}</h3><p>Atur skill, jobs, branches, gear dan formation melalui tab terpisah. Setiap perubahan disimpan setelah konfirmasi.</p></article><article><span class="eyebrow">NEXT DECISION</span><h3>Two active slots</h3><p>Slot pertama menjadi aksi pembuka. Pilih satu panel di atas untuk membuat perubahan yang terukur.</p></article></div>`;
}

function skillsPanel(loadout: Profile['loadouts'][number], kit: typeof KITS[keyof typeof KITS]) {
  const unlocked = (index: number) => index < 2 || loadout.talents.includes(`active-${index}`) || (index >= 4 && Boolean(loadout.job));
  const skillOptions = (slot: number) => kit.skills.map((s, i) => `<option value="${i}" ${loadout.skills[slot] === i ? 'selected' : ''} ${unlocked(i) ? '' : 'disabled'}>${s.name}${unlocked(i) ? '' : ' (unlock first)'}</option>`).join('');
  return `<h3 class="subheading">Active skills <span>2 slots · opening slot first</span></h3><p class="town-copy">Pilih dua skill yang benar-benar dibawa ke combat. Skill terkunci tetap terlihat dan menjelaskan jalur unlock-nya.</p><div class="loadout-slots">${[0, 1].map(slot => `<label><span>ACTIVE SLOT ${slot + 1}${slot === 0 ? ' · OPENING' : ''}</span><select data-equip-slot="${slot}" aria-label="Active slot ${slot + 1}">${skillOptions(slot)}</select><small>${kit.skills[loadout.skills[slot]].description}</small></label>`).join('')}</div>`;
}

function talentsPanel(p: Profile, state: TownState, r: typeof ROSTER[number], kit: typeof KITS[keyof typeof KITS], loadout: Profile['loadouts'][number]) {
 const branches = ['foundation', 'assault', 'guard', 'tempo', 'class'];
 const nodes = TALENTS.filter(t => (t.branch ?? 'foundation') === (state.talentBranch ?? 'foundation') && (!t.classId || t.classId === r.classId));
 const chosen = nodes.find(t => t.id === state.selectedTalent) ?? nodes[0];
 const branchName = (state.talentBranch ?? 'foundation').replace('-', ' ');
 const depth = (node: typeof TALENTS[number], seen = new Set<string>()): number => {
  if (seen.has(node.id)) return 0;
  const requirements = [...new Set([...(node.requires ? [node.requires] : []), ...(node.requiresAll ?? [])])];
  if (!requirements.length) return 0;
  const next = requirements.map(id => nodes.find(candidate => candidate.id === id) ?? TALENTS.find(candidate => candidate.id === id)).filter(Boolean) as typeof TALENTS[number][];
  return 1 + Math.min(3, Math.max(...next.map(candidate => depth(candidate, new Set(seen).add(node.id))), 0));
 };
 const tierLabels = ['ROOT', 'CORE', 'SPECIALIZATION', 'KEYSTONE'];
 const lanes = [0, 1, 2, 3].map(level => nodes.filter(node => depth(node) === level));
 const activeLanes = lanes.filter(l => l.length);
 return `<section class="talent-workspace" aria-label="Talent workspace"><div class="talent-workspace-heading"><div><span class="eyebrow">TALENT PROGRESSION · 4 TIERS</span><h3>${branchName} path</h3></div><span class="talent-count">${nodes.filter(t => loadout.talents.includes(t.id)).length}/${nodes.length} learned</span></div><nav class="branch-tabs" aria-label="Talent branches">${branches.map(b => `<button data-branch="${b}" aria-pressed="${b === (state.talentBranch ?? 'foundation')}">${b}</button>`).join('')}</nav><div class="talent-flow" aria-label="${branchName} talent progression">${activeLanes.map((lane, index) => `<div class="talent-flow-lane"><div class="talent-flow-label">${tierLabels[index]}</div><div class="talent-flow-cards">${lane.map(node => {
   const isLearned = loadout.talents.includes(node.id);
   const isSelected = node.id === chosen?.id;
   const isKeystone = Boolean(node.exclusive);
   const isActive = node.id.startsWith('active-');
   return `<button data-inspect-talent="${node.id}" class="talent-flow-node ${isSelected ? 'chosen' : ''} ${isLearned ? 'learned' : ''} ${isKeystone ? 'keystone' : ''}" aria-label="Inspect ${node.name}"><small>${isKeystone ? 'KEYSTONE' : isActive ? 'ACTIVE' : tierLabels[index]}</small><b>${node.name}${isLearned ? ' ✓' : ''}</b><span>${isLearned ? 'LEARNED' : `${node.cost}g`}</span></button>`;
 }).join('')}</div></div>`).join('<span class="talent-flow-arrow" aria-hidden="true">→</span>')}</div><div class="talent-inspector-section"><div class="section-label">SELECTED TALENT DETAILS <span>INSPECT & LEARN</span></div>${chosen ? talentCard(p, state.hero, kit, loadout)(chosen) : ''}</div></section>`;
}

function talentCard(p: Profile, hero: number, kit: typeof KITS[keyof typeof KITS], loadout: Profile['loadouts'][number]) {
  return (t: typeof TALENTS[number]) => {
    const owned = loadout.talents.includes(t.id), reason = talentReason(p, hero, t);
    const active = t.id.startsWith('active-'), index = Number(t.id.slice(-1));
    const name = active ? kit.skills[index]?.name ?? t.name : t.name;
    const description = active ? kit.skills[index]?.description ?? t.description : t.description;
    const prereqs = [...new Set([...(t.requires ? [t.requires] : []), ...(t.requiresAll ?? [])])];
    const arrows = prereqs.map(req => `<div class="talent-arrow" data-talent-arrow="${req}->${t.id}" data-from="${req}" data-to="${t.id}" aria-label="Requires ${req} before ${t.id}"><span aria-hidden="true">↓</span> Requires ${TALENTS.find(n => n.id === req)?.name ?? req}</div>`).join('');
    return `<div class="talent-node-wrap">${arrows}<button class="talent-node ${owned ? 'learned' : ''}" data-talent="${t.id}" ${reason ? 'disabled' : ''}><small>${t.exclusive ? 'KEYSTONE' : active ? 'ACTIVE' : 'PASSIVE'}${t.level ? ` · LV.${t.level}` : ''}${prereqs.length ? ` · ${prereqs.length > 1 ? 'COMBINED PREREQUISITES' : 'PREREQUISITE'}` : ' · ROOT'}</small><b>${name}</b><span>${description}</span><strong>${owned ? 'LEARNED' : reason || `${t.cost}g${t.points ? ` + ${t.points} SP` : ''}`}</strong></button></div>`;
  };
}

function advancement(p: Profile, id: number) {
  const h = p.loadouts[id], base = ROSTER[id].classId, level = p.cleared.length + 1;
  const paths = Object.values(JOBS).filter(j => j.base === base && j.tier === 2).map(j => {
    const third = Object.values(JOBS).find(t => t.parent === j.id);
    const jobs = [j, third].filter(Boolean) as typeof JOBS[string][];
    const cards = jobs.map(t => {
      const owned = h.job === t.id || JOBS[h.job ?? '']?.parent === t.id;
      const eligible = t.tier === 2 ? !h.job : h.job === t.parent;
      const disabled = owned || !eligible || level < t.level || p.gold < t.cost;
      const state = owned ? 'LEARNED' : !eligible ? 'OTHER PATH / PREREQUISITE' : level < t.level ? `REQUIRES RANK ${t.level}` : `${t.cost}g`;
      return `<button data-promote="${t.id}" class="job-node ${owned ? 'learned' : ''}" ${disabled ? 'disabled' : ''}><small>${t.tier === 2 ? 'ADVANCED' : 'THIRD JOB'} · CAMPAIGN RANK ${t.level}</small><b>${t.name}</b><span>${t.description}</span><em>Unlock: ${t.skill.name}</em><strong>${state}</strong></button>`;
    });
    return `<section>${cards.join('<span class="job-connector" aria-hidden="true">↓</span>')}</section>`;
  }).join('');
  return `<h3 class="subheading">Job advancement <span>2 branches · third job at campaign rank 10</span></h3><div class="job-paths">${paths}</div><p class="town-note">Promosi membuka signature skill, bukan memasangnya otomatis. Pilih di dua slot aktif. Reset mengembalikan biaya talent dan job; gear tetap dimiliki.</p>`;
}

function forge(p: Profile, id: number, state: TownState) {
  const h = p.loadouts[id];
  const slots = ['weapon','armor','charm'] as const;
  const optionFor = (slot: typeof slots[number]) => {
    const pending = state.pendingGear?.hero === id && state.pendingGear.slot === slot ? state.pendingGear.gearId : h.gear?.[slot] ?? '';
    return GEAR.filter(g => g.slot === slot && (!g.classId || g.classId === ROSTER[id].classId)).map(g => {
      const owned = h.inventory?.includes(g.id), reason = gearReason(p, id, g.id);
      return `<option value="${g.id}" ${pending === g.id ? 'selected' : ''}>${g.name} · ${g.rarity ?? 'common'} · Lv.${g.minLevel ?? 1} · ${owned ? 'owned' : g.source === 'quest' ? 'QUEST' : g.cost + 'g'}${reason ? ` · ${reason}` : ''}</option>`;
    }).join('');
  };
  const pending = state.pendingGear?.hero === id ? state.pendingGear : undefined;
  const selected = pending ? GEAR.find(g => g.id === pending.gearId && g.slot === pending.slot) : undefined;
  const current = selected ? GEAR.find(g => g.id === h.gear?.[selected.slot]) : undefined;
  const reason = selected ? gearReason(p, id, selected.id) : '';
  const comparison = selected ? `<dl class="gear-comparison"><div><dt>Power</dt><dd>${percent(selected.power - (current?.power ?? 0))}</dd></div><div><dt>HP</dt><dd>${percent(selected.hp - (current?.hp ?? 0))}</dd></div><div><dt>Tempo</dt><dd>${percent(selected.tempo - (current?.tempo ?? 0))}</dd></div></dl>` : '';
  return `<h3 class="subheading">Equipment <span>inspect first · confirm purchase second</span></h3><p class="town-copy">Choosing an item only opens a free preview. Gold and inventory change only after Confirm purchase & equip.</p><div class="gear-slots">${slots.map(slot => `<label>${slot.toUpperCase()}<select data-gear-slot="${slot}" aria-label="${slot}"><option value="">Choose equipment</option>${optionFor(slot)}</select><small>${GEAR.find(g => g.id === h.gear?.[slot])?.description ?? 'No equipment equipped.'}</small></label>`).join('')}</div>${selected ? `<section class="gear-preview" data-gear-preview="${selected.id}" aria-live="polite"><span class="eyebrow">FREE INSPECTION · ${selected.rarity ?? 'common'}</span><h3>${selected.name}</h3><p>${selected.description}</p><p><b>Requirements:</b> ${selected.minLevel ? `Hero Lv.${selected.minLevel}` : 'None'}${selected.classId ? ` · ${selected.classId} class` : ''}${selected.source === 'quest' ? ' · quest reward' : ` · ${selected.cost}g`}</p>${comparison}<p class="gear-preview-status">${reason || (current?.id === selected.id ? 'Already equipped.' : 'Ready to confirm.')}</p><div class="gear-preview-actions"><button class="gold-button" data-confirm-gear ${reason || current?.id === selected.id ? 'disabled' : ''}>Confirm purchase & equip</button><button class="secondary-button" data-cancel-gear>Cancel preview</button></div></section>` : '<p class="gear-preview-empty">Select any catalog item to inspect its description, requirements, stats and comparison before spending gold.</p>'}<details class="gear-set-status"><summary>Equipment set reference</summary>${GEAR_SETS.map(set => { const count = Object.entries(h.gear ?? {}).filter(([slot, gearId]) => GEAR.some(g => g.id === gearId && g.slot === slot && g.setId === set.id)).length; return `<p><b>${set.name} · ${count}/3 pieces</b><br>${set.description} ${count >= 3 ? 'ALL BONUSES ACTIVE' : count >= 2 ? '2-PIECE ACTIVE' : ''}</p>`; }).join('')}</details>`;
}

function formation(p: Profile, id: number, r: typeof ROSTER[number], loadout: Profile['loadouts'][number]) {
  return `<div class="formation-heading"><h3>Starting formation</h3><p>Musuh berada di atas. Pilih tile untuk ${r.name}; tile berisi hero akan ditukar.</p></div><div class="formation-grid" aria-label="Formasi tiga kali tiga">${Array.from({ length: 9 }, (_, slot) => { const hero = p.roster.find(heroId => p.loadouts[heroId].slot === slot); return `<button data-formation="${slot}" class="${loadout.slot === slot ? 'chosen' : ''}" aria-label="Tile ${slot + 1}${hero !== undefined ? `, ${ROSTER[hero].name}` : ', kosong'}"><small>${slot < 3 ? 'FRONT' : slot < 6 ? 'MID' : 'BACK'} ${slot + 1}</small>${hero !== undefined ? `<img src="${portrait(ROSTER[hero].classId)}" alt=""/><span>${ROSTER[hero].name}</span>` : '<span>Empty</span>'}</button>`; }).join('')}</div><div class="departure-actions"><button class="secondary-button" data-respec ${loadout.talents.length || loadout.job ? '' : 'disabled'}>Reset ${r.name} · refund penuh</button><button class="gold-button" data-facility="campaign">Kembali ke war table</button></div>`;
}

function bestiary(pageIndex: number) {
  const records = Object.values(ENEMIES);
  const pageSize = 1, total = Math.ceil(records.length / pageSize), page = Math.min(Math.max(0, pageIndex), total - 1), visible = records.slice(page * pageSize, (page + 1) * pageSize);
  return `<div class="section-heading"><div><span class="eyebrow">KNOW YOUR ENEMY</span><h2>Field bestiary</h2></div><span class="chapter-counter">${records.length} records</span></div><div class="game-stat-ribbon"><span class="hud-chip">📖 FIELD ARCHIVE</span><span class="hud-chip">👁️ ${records.length} PROFILES</span><span class="hud-chip gold">🛡️ INTENT & COUNTERS</span></div><p class="town-copy">Tanda target mengikuti hero yang ditandai. Tanda di tanah tetap di tile. Serangan seluruh grid tidak bisa di-dodge: siapkan Guard atau interrupt.</p><div class="bestiary-list paged-collection" data-page="${page}">${visible.map(e => `<article><img src="${monster(e.id)}" alt="${e.name} pixel art"/><div><small>${e.title}</small><h3>${e.name}</h3><p>${e.description}</p><p class="counter-note"><b>COUNTER</b> ${e.counter}</p></div></article>`).join('')}${pager('bestiary', page, total)}</div>`;
}

function raids(p: Profile, state: TownState) {
  const choices = Object.values(ENEMIES).filter(e => e.archetype === e.id).map(e => e.id);
  const selected = ENEMIES[state.raid] ?? ENEMIES.golem;
  const build = state.raidBuild && validRaidBuild(state.raidBuild, p.roster) ? state.raidBuild : createRaidBuild(p.roster, Math.min(3, p.roster.length, 6));
  const contract = state.raidSandbox ? undefined : getRaidContractForEnemy(state.raid, state.raidTier, state.raidModifiers);
  const tiers = (['bronze', 'silver', 'gold'] as const).map(tier => {
    const tierContract = getRaidContractForEnemy(state.raid, tier, state.raidModifiers);
    return `<option value="${tier}" ${state.raidTier === tier ? 'selected' : ''} ${tierContract ? '' : 'disabled'}>${tier.toUpperCase()} · ${tierContract ? `${tierContract.riskPoints} risk · ${raidReward(tierContract, state.raid)} Crystal` : 'Sandbox combo'}</option>`;
  }).join('');
  const modifiers = RAID_MODIFIERS.map(modifier => `<label class="raid-modifier"><input type="checkbox" data-raid-modifier="${modifier.id}" ${state.raidModifiers.includes(modifier.id) ? 'checked' : ''}/><span><b>${modifier.id} · ${modifier.name}</b><small>${modifier.description}</small></span></label>`).join('');
  const party = build.slots.map((slot, index) => `<label class="raid-party-slot"><span>${index + 1}. ${ROSTER[slot.heroId].name}</span><select data-raid-job="${index}" aria-label="Raid job ${index + 1}">${['warrior', 'rogue', 'archer', 'healer', 'wizard'].map(job => `<option value="${job}" ${slot.classId === job ? 'selected' : ''}>${KITS[job as keyof typeof KITS].name}</option>`).join('')}</select></label>`).join('');
  const sandbox = state.raidSandbox;
  const status = contract && !sandbox ? `REWARDED CONTRACT · ${raidReward(contract, state.raid)} CRYSTAL` : 'SANDBOX · NO CRYSTAL';
  return `<div class="section-heading"><div><span class="eyebrow">RAID CONTRACTS</span><h2>Choose your quarry.</h2></div><span class="chapter-counter">${status}</span></div><div class="game-stat-ribbon"><span class="hud-chip">🎯 QUARRY HUNT</span><span class="hud-chip">${build.slots.length} HEROES</span><span class="hud-chip gold">💎 ${status}</span></div><p class="town-copy">Certified runs use frozen boss/modifier records. Raw tuning is useful for practice, but any slider or unsupported modifier combo permanently disables Crystal for that run.</p><details open><summary>Raid party · ${build.slots.length}/6 echo units</summary><label class="raid-party-size">Party size<select data-raid-party-size aria-label="Raid party size">${[1,2,3,4,5,6].map(size => `<option value="${size}" ${build.slots.length === size ? 'selected' : ''} ${size > p.roster.length ? 'disabled' : ''}>${size} hero${size === 1 ? '' : 'es'}</option>`).join('')}</select></label><div class="raid-party-grid">${party}</div><p class="town-note">Raid jobs are temporary and do not overwrite Story loadouts. Duplicate basic jobs are allowed.</p></details><details open><summary>Browse ${choices.length} authored boss archetypes</summary><div class="raid-roster">${choices.map(id => `<button data-raid="${id}" class="${state.raid === id ? 'chosen' : ''}" aria-pressed="${state.raid === id}"><img src="${monster(id)}" alt=""/><b>${ENEMIES[id].name}</b><small>${ENEMIES[id].title}</small></button>`).join('')}</div></details><label class="raid-variant">Boss variant<select data-raid-variant aria-label="Enemy and variant">${Object.values(ENEMIES).map(e => `<option value="${e.id}" ${state.raid === e.id ? 'selected' : ''}>${e.name} · tier ${e.tier}</option>`).join('')}</select></label><label class="raid-tier">Reward contract<select data-raid-tier aria-label="Raid reward tier">${tiers}</select></label><fieldset class="raid-modifiers"><legend>Certified modifier allowlist</legend>${modifiers}<small>Only calibrated combinations remain rewarded. Selecting an uncalibrated combination shows Sandbox.</small></fieldset><details class="raid-sandbox"><summary>Practice sliders · always Sandbox</summary><p>Use these to test difficulty. Any value other than the certified contract disables Crystal rewards.</p><label>Boss HP <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.hpScale ?? 1}" data-raid-sandbox="hpScale"/><output>${(sandbox?.hpScale ?? 1).toFixed(1)}×</output></label><label>Incoming damage <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.damageScale ?? 1}" data-raid-sandbox="damageScale"/><output>${(sandbox?.damageScale ?? 1).toFixed(1)}×</output></label><label>Attack interval <input type="range" min="0.5" max="3" step="0.1" value="${sandbox?.intervalScale ?? 1}" data-raid-sandbox="intervalScale"/><output>${(sandbox?.intervalScale ?? 1).toFixed(1)}×</output></label></details><article class="mission-brief"><span class="eyebrow">${status}</span><h3>${selected.name}</h3><p>${selected.description}</p><p class="counter-note">${selected.counter}</p><p class="mission-reward">${contract ? `Frozen reward: ${raidReward(contract, state.raid)} Commander Crystal · receipt protected against duplicates.` : 'Practice only. This configuration settles XP/ledger progress but pays 0 Commander Crystal.'}</p><div class="departure-actions"><button class="gold-button" data-depart="raid">Hunt ${selected.name}</button><button class="secondary-button" data-facility="party">Atur Story loadout</button></div></article>`;
}

function challengeShop(p: Profile) {
  return `<div class="section-heading"><div><span class="eyebrow">SHARED CHALLENGE WALLET</span><h2>Spend bank Crystal.</h2></div><span class="chapter-counter">${p.economy.commanderCrystal} CRYSTAL</span></div><p class="town-copy">Bank Crystal persists on this Commander and is shared by Raid and Roguelike. Story Gold and journey Crystal never pay this shop.</p><section class="challenge-shop-grid"><article><span class="eyebrow">SUNKEN ARCHIVE · RUN META</span>${BANK_SHOP.map(item => { const owned = p.challengeUnlocks.includes(item.id); return `<div class="shop-item"><div><h3>${item.name}</h3><p>${item.description}</p></div><button class="${owned ? 'secondary-button' : 'gold-button'}" data-bank-buy="${item.id}" ${owned || p.economy.commanderCrystal < item.cost ? 'disabled' : ''}>${owned ? 'OWNED' : `${item.cost} CRYSTAL`}</button></div>`; }).join('')}</article><article><span class="eyebrow">JOURNEY SHOP · RUN ONLY</span><p>Available after entering a Roguelike run. These purchases disappear on abandon, defeat, or clear; no purse conversion.</p>${CHALLENGE_SHOP.map(item => `<div class="shop-item"><div><h3>${item.name}</h3><p>${item.description}</p></div><span class="shop-cost">${item.cost} RUN</span></div>`).join('')}</article></section></div>`;
}

function runShop(purse: number) {
  return `<section class="run-shop"><span class="eyebrow">JOURNEY SHOP · ${purse} RUN CRYSTAL</span>${CHALLENGE_SHOP.map(item => `<div class="shop-item"><div><h3>${item.name}</h3><p>${item.description}</p></div><button class="secondary-button" data-run-buy="${item.id}" ${purse < item.cost ? 'disabled' : ''}>${item.cost} RUN</button></div>`).join('')}</section>`;
}

function endless(p: Profile, state: TownState) {
  const build=state.rogueSetup??createRogueBuild();
  const setup=`<fieldset class="loadout-slots"><legend>Roguelike recruits: exactly 3</legend>${build.recruits.map((r,i)=>`<label>Recruit ${i+1}<select data-rogue-slot="${i}" aria-label="Recruit ${i+1} basic job">${BASIC_JOBS.map(id=>`<option value="${id}" ${r.classId===id?'selected':''}>${KITS[id].name}</option>`).join('')}</select></label>`).join('')}</fieldset><p>Duplicate jobs allowed. One promotion point per room clear; spend before the next encounter. Jobs and signature skills belong only to this run. Reload starts a fresh setup.</p>`;
  return `<div class="section-heading"><div><span class="eyebrow">THE SUNKEN BELL</span><h2>A different run.<br>A different build.</h2></div><span class="chapter-counter">BEST ${p.bestFloor}</span></div><div class="game-stat-ribbon"><span class="hud-chip">🔔 SUNKEN BELL</span><span class="hud-chip gold">🏆 BEST FLOOR ${p.bestFloor}</span><span class="hud-chip">🎲 3 RECRUITS</span></div><p class="town-copy">Turun ke ruang bawah lonceng. Setelah tiap kemenangan, pilih satu dari tiga boon. Efek bisa saling menguatkan: bangun gaya main dari pilihan yang muncul, bukan hanya angka damage.</p><div class="endless-rules"><p><b>Three custom recruits.</b> Story jobs, equipment, XP dan talent tidak dibawa masuk.</p><p><b>Boons belong to this run.</b> Kematian atau pulang mengakhiri build sementara.</p><p><b>Every floor pushes back.</b> Musuh berganti, tekanan meningkat. Party pulih saat turun ke floor berikutnya.</p><p><b>Run purse.</b> Room clear memberi journey Crystal untuk temporary shop; act clear memberi bank Crystal lewat receipt. Sisa purse tidak pernah dikonversi.</p></div>${setup}<div class="departure-actions"><button class="gold-button" data-depart="endless">Descend · floor 1</button><button class="secondary-button" data-facility="challenge-shop">Open Challenge shop</button><button class="secondary-button" data-facility="party">Siapkan build</button></div>`;
}
