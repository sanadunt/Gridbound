import { KITS, ROSTER } from '../game/content';
import { CAMPAIGN, ENEMIES } from '../game/world';
import { TALENTS, canEnterZone, talentReason, availablePoints, gearReason, profileModifiers, type Profile } from '../game/profile';
import { JOBS, GEAR, GEAR_SETS, legalSkill } from '../game/jobs';
import { heroProgress } from '../game/levels';
import { Battle } from '../game/simulation';
import { questBoard } from './quests';
import { CHARACTERS } from '../game/characters';
import { heroCanvas } from '../art/pixels';
import { monsterCanvas, townCanvas } from '../art/monsters';

export type TownTab = 'campaign' | 'party' | 'bestiary' | 'quests' | 'raid' | 'endless';
export type TrainingTab = 'overview'|'skills'|'jobs'|'talents'|'gear'|'formation';
export type PendingGear = { hero: number; slot: 'weapon'|'armor'|'charm'; gearId: string };
export type TownState = {
  tab: TownTab;
  hero: number;
  zone: number;
  raid: string;
  questFilter?: 'available'|'all'|'claimed';
  notice: string;
  trainingTab: TrainingTab;
  campaignPage: number;
  questPage: number;
  bestiaryPage: number;
  talentBranch?: string;
  selectedTalent?: string;
  pendingGear?: PendingGear;
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
      <div class="town-caption"><span class="eyebrow">SANCTUARY · NO ENEMIES HERE</span><h1 id="town-title">Emberhollow</h1><p>Lonceng terakhir masih menyala. Selama itu, kita punya rumah.</p></div>
      <span class="town-rest">Party dipulihkan penuh setiap pulang</span>
    </section>
    <div class="town-layout">
      <details class="town-sidebar"><summary>Party · pilih karakter</summary>
        <p class="section-label">THE BELLKEEPERS <span>RANK ${p.cleared.length + 1}</span></p>
        <div class="town-roster">${p.roster.map(id => {
          const r = ROSTER[id];
          return `<button data-town-hero="${id}" class="town-hero ${state.hero === id ? 'chosen' : ''}" aria-label="Siapkan ${r.name}"><img src="${portrait(r.classId)}" alt=""/><span><b>${r.name}</b><small>${JOBS[p.loadouts[id].job??'']?.name??KITS[r.classId].name}</small></span><span class="ready-dot">Lv.${heroProgress(p.loadouts[id].xp).level}</span></button>`;
        }).join('')}</div>
        <p class="town-note">${p.roster.length === 3 ? 'Aldric menjaga. Lyra memulihkan. Rowan memburu. Petualangan ini dimulai dengan mereka bertiga.' : 'Rekan yang diselamatkan ikut bertarung. Isi tile kosong dan pilih dua skill tiap hero sebelum berangkat.'}</p>
        <div class="town-progress"><b>${p.cleared.length} / ${CAMPAIGN.length}</b><span>SEALS RESTORED</span></div>
      </details>
      <section class="town-content" aria-label="Fasilitas kota">
        <nav class="facility-tabs" aria-label="Fasilitas"><button data-facility="campaign" class="${state.tab === 'campaign' ? 'active' : ''}">War table</button><button data-facility="party" class="${state.tab === 'party' ? 'active' : ''}">Training hall</button><button data-facility="quests" class="${state.tab === 'quests' ? 'active' : ''}">Quest ledger</button><button data-facility="bestiary" class="${state.tab === 'bestiary' ? 'active' : ''}">Bestiary</button></nav>
        <p id="town-notice" class="town-notice" role="status" ${state.notice ? '' : 'hidden'}>${escape(state.notice)}</p>
        ${state.tab === 'campaign' ? campaign(p, state) : state.tab === 'party' ? training(p, state) : state.tab === 'quests' ? questBoard(p, state.hero, state.questFilter, state.questPage) : state.tab === 'bestiary' ? bestiary(state.bestiaryPage) : state.tab === 'raid' ? raids(state) : endless(p)}
      </section>
    </div>`;
}

function campaign(p: Profile, state: TownState) {
  const pageSize = 1;
  const total = Math.ceil(CAMPAIGN.length / pageSize);
  const page = Math.min(Math.max(0, state.campaignPage), total - 1);
  const visible = CAMPAIGN.slice(page * pageSize, (page + 1) * pageSize);
  const zone = CAMPAIGN[state.zone];
  return `<div class="section-heading"><div><span class="eyebrow">STORY CAMPAIGN</span><h2>Ashes of the Bell</h2></div><span class="chapter-counter">${state.zone + 1} / ${CAMPAIGN.length}</span></div>
    <p class="town-copy">Empat babak. Enam belas chapter. Mulai sebagai penyelamat kota; cari tahu siapa yang membayar harga perlindungannya. Chapter yang selesai dapat dibaca ulang di journal.</p>
    <div class="paged-collection" data-page="${page}"><ol class="zone-route">${visible.map((c, offset) => { const i = page * pageSize + offset; return `<li><button data-zone="${i}" ${canEnterZone(p, i) ? '' : 'disabled'} class="${state.zone === i ? 'chosen' : ''}"><span class="zone-number">${String(i + 1).padStart(2, '0')}</span><span><b>${c.name}</b><small>${p.cleared.includes(i) ? 'SEAL RESTORED · REPLAY' : canEnterZone(p, i) ? c.subtitle : 'LOCKED · CLEAR PREVIOUS ZONE'}</small></span></button></li>`; }).join('')}</ol>${pager('campaign', page, total)}</div>
    <article class="mission-brief"><span class="eyebrow">${zone.speaker}</span><h3>${zone.name}</h3><p>${zone.intro}</p>
    <details><summary>Encounter route & briefing</summary><ol class="stage-route">${zone.stages.map(s => `<li><small>${s.kind.toUpperCase()}</small><b>${s.name}</b></li>`).join('')}</ol>
    <p class="mission-warning">HP dan potion dibawa antar-wave. Hero yang tumbang tidak bangkit sampai kembali ke town. Bersiaplah sebelum melewati gerbang.</p></details>
    <div class="mission-reward">${zone.recruit.length ? `Rekrut: ${zone.recruit.map(id => ROSTER[id].name).join(', ')} · ` : ''}${zone.reward}g bonus zone · XP per hero pada setiap expedition selesai</div>
    <div class="departure-actions"><button class="gold-button" data-depart="adventure" ${canEnterZone(p, state.zone) ? '' : 'disabled'}>Masuk ${zone.name}</button><button class="secondary-button" data-facility="party">Atur skill & formasi</button></div></article>${p.cleared.length ? `<details class="story-journal"><summary>Campaign journal · ${p.cleared.length} chapters recovered</summary>${p.cleared.map(i => `<details><summary>${i + 1}. ${CAMPAIGN[i].name}</summary><p>${CAMPAIGN[i].intro}</p><p>${CAMPAIGN[i].outro}</p></details>`).join('')}</details>` : ''}`;
}

function training(p: Profile, state: TownState) {
  const r = ROSTER[state.hero], kit = KITS[r.classId], loadout = p.loadouts[state.hero];
  const progress = heroProgress(loadout.xp);
  const preview = new Battle('raid', 1, profileModifiers(p), { roster: [state.hero], loadouts: p.loadouts }).hero(state.hero)!;
  const active = state.trainingTab ?? 'talents';
  const tabs: [TrainingTab, string][] = [['overview','Overview'],['skills','Active skills'],['jobs','Jobs'],['talents','Talent branches'],['gear','Equipment'],['formation','Formation']];
  const panel = active === 'overview' ? trainingOverview(p, state, r, preview, progress) : active === 'skills' ? skillsPanel(loadout, kit) : active === 'jobs' ? advancement(p, state.hero) : active === 'talents' ? talentsPanel(p, state, r, kit, loadout) : active === 'gear' ? forge(p, state.hero, state) : formation(p, state.hero, r, loadout);
  return `<div class="training-identity"><img src="${portrait(r.classId)}" alt="${r.name}"/><div><span class="eyebrow">${JOBS[loadout.job??'']?.name??kit.name} · LEVEL ${progress.level}</span><h2>${r.name}</h2><p>${kit.role}</p></div></div>${active === 'overview' ? `<p class="character-bio">${CHARACTERS[state.hero].bio}</p>` : ''}<nav class="training-tabs" aria-label="Training sections">${tabs.map(([id,label]) => `<button data-training-tab="${id}" class="${active === id ? 'active' : ''}" aria-current="${active === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav><section class="training-panel" data-training-panel="${active}">${panel}</section>`;
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
 const branches=['foundation','assault','guard','tempo','class'];
 const nodes=TALENTS.filter(t=>(t.branch??'foundation')===(state.talentBranch??'foundation')&&(!t.classId||t.classId===r.classId));
 const chosen=nodes.find(t=>t.id===state.selectedTalent)??nodes[0];
 return `<nav class="branch-tabs">${branches.map(b=>`<button data-branch="${b}" aria-pressed="${b===(state.talentBranch??'foundation')}">${b}</button>`).join('')}</nav><div class="talent-map"><svg viewBox="0 0 600 240" role="img" aria-label="Talent prerequisite arrows"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#e6c78c"/></marker></defs>${nodes.map((n,i)=>[...new Set([...(n.requires?[n.requires]:[]),...(n.requiresAll??[])])].map(req=>{const j=nodes.findIndex(t=>t.id===req);return j<0?'':`<path data-from="${req}" data-to="${n.id}" d="M${(j%3)*200+100} ${Math.floor(j/3)*48+22} L${(i%3)*200+100} ${Math.floor(i/3)*48+22}" stroke="#e6c78c" fill="none" marker-end="url(#arrow)"/>`;}).join('')).join('')}</svg><div class="talent-map-nodes">${nodes.map(t=>`<button data-inspect-talent="${t.id}" class="${t.id===chosen?.id?'chosen':''}" title="${t.name}">${t.name}${loadout.talents.includes(t.id)?' ✓':''}</button>`).join('')}</div></div>${chosen?talentCard(p,state.hero,kit,loadout)(chosen):''}`;
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
  return `<div class="section-heading"><div><span class="eyebrow">KNOW YOUR ENEMY</span><h2>Field bestiary</h2></div><span class="chapter-counter">${records.length} records</span></div><p class="town-copy">Tanda target mengikuti hero yang ditandai. Tanda di tanah tetap di tile. Serangan seluruh grid tidak bisa di-dodge: siapkan Guard atau interrupt.</p><div class="bestiary-list paged-collection" data-page="${page}">${visible.map(e => `<article><img src="${monster(e.id)}" alt="${e.name} pixel art"/><div><small>${e.title}</small><h3>${e.name}</h3><p>${e.description}</p><p class="counter-note"><b>COUNTER</b> ${e.counter}</p></div></article>`).join('')}${pager('bestiary', page, total)}</div>`;
}

function raids(state: TownState) {
  const choices = Object.values(ENEMIES).filter(e => e.archetype === e.id).map(e => e.id), selected = ENEMIES[state.raid];
  return `<div class="section-heading"><div><span class="eyebrow">RAID CONTRACTS</span><h2>Choose your quarry.</h2></div></div><p class="town-copy">Satu boss. Party dan talent dari town ikut bertarung. Musuh menyesuaikan ukuran party; mekanik tetap berbahaya.</p><details><summary>Browse 12 enemy archetypes</summary><div class="raid-roster">${choices.map(id => `<button data-raid="${id}" class="${state.raid === id ? 'chosen' : ''}" aria-pressed="${state.raid === id}"><img src="${monster(id)}" alt=""/><b>${ENEMIES[id].name}</b><small>${ENEMIES[id].title}</small></button>`).join('')}</div></details><label class="raid-variant">Enemy & variant<select data-raid-variant aria-label="Enemy and variant">${Object.values(ENEMIES).map(e => `<option value="${e.id}" ${state.raid === e.id ? 'selected' : ''}>${e.name} · tier ${e.tier}</option>`).join('')}</select></label><article class="mission-brief"><h3>${selected.name}</h3><p>${selected.description}</p><p class="counter-note">${selected.counter}</p><div class="departure-actions"><button class="gold-button" data-depart="raid">Hunt ${selected.name}</button><button class="secondary-button" data-facility="party">Atur loadout</button></div></article>`;
}

function endless(p: Profile) {
  return `<div class="section-heading"><div><span class="eyebrow">THE SUNKEN BELL</span><h2>A different run.<br>A different build.</h2></div><span class="chapter-counter">BEST ${p.bestFloor}</span></div><p class="town-copy">Turun ke ruang bawah lonceng. Setelah tiap kemenangan, pilih satu dari tiga boon. Efek bisa saling menguatkan: bangun gaya main dari pilihan yang muncul, bukan hanya angka damage.</p><div class="endless-rules"><p><b>Town talents stay.</b> Skill dan talent pilihanmu dibawa masuk.</p><p><b>Boons belong to this run.</b> Kematian atau pulang mengakhiri build sementara.</p><p><b>Every floor pushes back.</b> Musuh berganti, tekanan meningkat. Party pulih saat turun ke floor berikutnya.</p></div><div class="departure-actions"><button class="gold-button" data-depart="endless">Descend · floor 1</button><button class="secondary-button" data-facility="party">Siapkan build</button></div>`;
}
