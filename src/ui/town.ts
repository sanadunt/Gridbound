import { KITS, ROSTER } from '../game/content';
import { CAMPAIGN, ENEMIES } from '../game/world';
import { TALENTS, canEnterZone, type Profile } from '../game/profile';
import { JOBS, GEAR, legalSkill } from '../game/jobs';
import { CHARACTERS } from '../game/characters';
import { heroCanvas } from '../art/pixels';
import { monsterCanvas, townCanvas } from '../art/monsters';

export type TownTab = 'campaign' | 'party' | 'bestiary' | 'raid' | 'endless';
export type TownState = { tab: TownTab; hero: number; zone: number; raid: string; notice: string };
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

export function renderTown(root: HTMLElement, p: Profile, state: TownState) {
  townImage ||= townCanvas().toDataURL();
  root.innerHTML = `
    <section class="town-panorama" aria-labelledby="town-title">
      <img src="${townImage}" alt="Emberhollow, desa hutan dengan menara lonceng, rumah-rumah dan api unggun" />
      <div class="town-caption"><span class="eyebrow">SANCTUARY · NO ENEMIES HERE</span><h1 id="town-title">Emberhollow</h1><p>Lonceng terakhir masih menyala. Selama itu, kita punya rumah.</p></div>
      <span class="town-rest">Party dipulihkan penuh setiap pulang</span>
    </section>
    <div class="town-layout">
      <aside class="town-sidebar">
        <p class="section-label">THE BELLKEEPERS <span>LV. ${p.cleared.length + 1}</span></p>
        <div class="town-roster">${p.roster.map(id => {
          const r = ROSTER[id];
          return `<button data-town-hero="${id}" class="town-hero ${state.hero === id ? 'chosen' : ''}" aria-label="Siapkan ${r.name}"><img src="${portrait(r.classId)}" alt=""/><span><b>${r.name}</b><small>${JOBS[p.loadouts[id].job??'']?.name??KITS[r.classId].name}</small></span><span class="ready-dot">Ready</span></button>`;
        }).join('')}</div>
        <p class="town-note">${p.roster.length === 3 ? 'Aldric menjaga. Lyra memulihkan. Rowan memburu. Petualangan ini dimulai dengan mereka bertiga.' : 'Rekan yang diselamatkan ikut bertarung. Isi tile kosong dan pilih dua skill tiap hero sebelum berangkat.'}</p>
        <div class="town-progress"><b>${p.cleared.length} / ${CAMPAIGN.length}</b><span>SEALS RESTORED</span></div>
      </aside>
      <section class="town-content" aria-label="Fasilitas kota">
        <nav class="facility-tabs" aria-label="Fasilitas"><button data-facility="campaign" class="${state.tab === 'campaign' ? 'active' : ''}">War table</button><button data-facility="party" class="${state.tab === 'party' ? 'active' : ''}">Training hall</button><button data-facility="bestiary" class="${state.tab === 'bestiary' ? 'active' : ''}">Bestiary</button></nav>
        <p id="town-notice" class="town-notice" role="status" ${state.notice ? '' : 'hidden'}>${escape(state.notice)}</p>
        ${state.tab === 'campaign' ? campaign(p, state) : state.tab === 'party' ? training(p, state) : state.tab === 'bestiary' ? bestiary() : state.tab === 'raid' ? raids(state) : endless(p)}
      </section>
    </div>`;
}

function campaign(p: Profile, state: TownState) {
  const zone = CAMPAIGN[state.zone];
  return `<div class="section-heading"><div><span class="eyebrow">STORY CAMPAIGN</span><h2>Ashes of the Bell</h2></div><span class="chapter-counter">${state.zone + 1} / ${CAMPAIGN.length}</span></div>
    <p class="town-copy">Empat babak. Enam belas chapter. Mulai sebagai penyelamat kota; cari tahu siapa yang membayar harga perlindungannya. Chapter yang selesai dapat dibaca ulang di journal.</p>
    <ol class="zone-route">${CAMPAIGN.map((c, i) => `<li><button data-zone="${i}" ${canEnterZone(p, i) ? '' : 'disabled'} class="${state.zone === i ? 'chosen' : ''}"><span class="zone-number">${String(i + 1).padStart(2, '0')}</span><span><b>${c.name}</b><small>${p.cleared.includes(i) ? 'SEAL RESTORED · REPLAY' : canEnterZone(p, i) ? c.subtitle : 'LOCKED · CLEAR PREVIOUS ZONE'}</small></span></button></li>`).join('')}</ol>
    <article class="mission-brief"><span class="eyebrow">${zone.speaker}</span><h3>${zone.name}</h3><p>${zone.intro}</p>
    <ol class="stage-route">${zone.stages.map(s => `<li><small>${s.kind.toUpperCase()}</small><b>${s.name}</b></li>`).join('')}</ol>
    <p class="mission-warning">HP dan potion dibawa antar-wave. Hero yang tumbang tidak bangkit sampai kembali ke town. Bersiaplah sebelum melewati gerbang.</p>
    <div class="mission-reward">${zone.recruit.length ? `Rekrut: ${zone.recruit.map(id => ROSTER[id].name).join(', ')} · ` : ''}${zone.reward}g bonus zone · Level naik pada clear pertama</div>
    <div class="departure-actions"><button class="gold-button" data-depart="adventure" ${canEnterZone(p, state.zone) ? '' : 'disabled'}>Masuk ${zone.name}</button><button class="secondary-button" data-facility="party">Atur skill & formasi</button></div></article>${p.cleared.length?`<details class="story-journal"><summary>Campaign journal · ${p.cleared.length} chapters recovered</summary>${p.cleared.map(i=>`<details><summary>${i+1}. ${CAMPAIGN[i].name}</summary><p>${CAMPAIGN[i].intro}</p><p>${CAMPAIGN[i].outro}</p></details>`).join('')}</details>`:''}`;
}

function training(p: Profile, state: TownState) {
  const r = ROSTER[state.hero], kit = KITS[r.classId], loadout = p.loadouts[state.hero];
  const unlocked = (index: number) => legalSkill(index,loadout.talents,loadout.job);
  const skillOptions = (slot: number) => kit.skills.map((s, i) => `<option value="${i}" ${loadout.skills[slot] === i ? 'selected' : ''} ${unlocked(i) ? '' : 'disabled'}>${s.name}${unlocked(i) ? '' : ' (unlock talent)'}</option>`).join('');
  return `<div class="training-identity"><img src="${portrait(r.classId)}" alt="${r.name}"/><div><span class="eyebrow">${JOBS[loadout.job??'']?.name??kit.name} · LEVEL ${p.cleared.length + 1}</span><h2>${r.name}</h2><p>${kit.role}</p></div></div><p class="character-bio">${CHARACTERS[state.hero].bio}</p>
    <p class="town-copy">Dua slot aktif. Slot pertama jadi aksi pembuka; saat combat, ganti di antara dua skill ini. Mengganti slot yang terpakai akan menukar keduanya.</p>
    <div class="loadout-slots">${[0, 1].map(slot => `<label><span>ACTIVE SLOT ${slot + 1}${slot === 0 ? ' · OPENING' : ''}</span><select data-equip-slot="${slot}" aria-label="Active slot ${slot + 1}">${skillOptions(slot)}</select><small>${kit.skills[loadout.skills[slot]].description}</small></label>`).join('')}</div>
    ${advancement(p,state.hero)}
    <h3 class="subheading">Skill tree <span>Gold available: ${p.gold}g</span></h3>
    <div class="talent-tree">${TALENTS.map(t => {
      const owned = loadout.talents.includes(t.id), prereq = !t.requires || loadout.talents.includes(t.requires);
      const active = t.id.startsWith('active-'), index = Number(t.id.slice(-1));
      const name = active ? kit.skills[index]?.name ?? t.name : t.name;
      const description = active ? kit.skills[index]?.description ?? t.description : t.description;
      return `<button class="talent-node ${owned ? 'learned' : ''}" data-talent="${t.id}" ${owned || !prereq || p.gold < t.cost ? 'disabled' : ''}><small>${active ? 'ACTIVE' : 'PASSIVE'}${t.requires ? ` · REQUIRES ${t.requires === 'active-2' ? kit.skills[2]?.name : t.requires}` : ' · ROOT'}</small><b>${name}</b><span>${description}</span><strong>${owned ? 'LEARNED' : !prereq ? 'PREREQUISITE LOCKED' : `${t.cost}g`}</strong></button>`;
    }).join('')}</div>
    ${forge(p,state.hero)}
    <div class="formation-heading"><h3>Starting formation</h3><p>Musuh berada di atas. Pilih tile untuk ${r.name}; tile berisi hero akan ditukar.</p></div>
    <div class="formation-grid" aria-label="Formasi tiga kali tiga">${Array.from({ length: 9 }, (_, slot) => {
      const id = p.roster.find(id => p.loadouts[id].slot === slot);
      return `<button data-formation="${slot}" class="${loadout.slot === slot ? 'chosen' : ''}" aria-label="Tile ${slot + 1}${id !== undefined ? `, ${ROSTER[id].name}` : ', kosong'}"><small>${slot < 3 ? 'FRONT' : slot < 6 ? 'MID' : 'BACK'} ${slot + 1}</small>${id !== undefined ? `<img src="${portrait(ROSTER[id].classId)}" alt=""/><span>${ROSTER[id].name}</span>` : '<span>Empty</span>'}</button>`;
    }).join('')}</div>
    <div class="departure-actions"><button class="secondary-button" data-respec ${loadout.talents.length||loadout.job ? '' : 'disabled'}>Reset ${r.name} · refund penuh</button><button class="gold-button" data-facility="campaign">Kembali ke war table</button></div>`;
}

function advancement(p:Profile,id:number) {
 const h=p.loadouts[id],base=ROSTER[id].classId,level=p.cleared.length+1;
 return `<h3 class="subheading">Job advancement <span>2 branches · third job at Lv.10</span></h3><div class="job-paths">${Object.values(JOBS).filter(j=>j.base===base&&j.tier===2).map(j=>{const third=Object.values(JOBS).find(t=>t.parent===j.id)!;return `<section>${[j,third].map(t=>{const owned=h.job===t.id||JOBS[h.job??'']?.parent===t.id;const eligible=t.tier===2?!h.job:h.job===t.parent;return `<button data-promote="${t.id}" class="job-node ${owned?'learned':''}" ${owned||!eligible||level<t.level||p.gold<t.cost?'disabled':''}><small>${t.tier===2?'ADVANCED':'THIRD JOB'} · LV.${t.level}</small><b>${t.name}</b><span>${t.description}</span><em>Unlock: ${t.skill.name}</em><strong>${owned?'LEARNED':!eligible?'OTHER PATH / PREREQUISITE':level<t.level?`REQUIRES LV.${t.level}`:`${t.cost}g`}</strong></button>`;}).join('<span class="job-connector" aria-hidden="true">↓</span>')}</section>`;}).join('')}</div><p class="town-note">Promosi membuka signature skill, bukan memasangnya otomatis. Pilih di dua slot aktif. Reset mengembalikan biaya talent dan job; gear tetap dimiliki.</p>`;
}
function forge(p:Profile,id:number) {
 const h=p.loadouts[id];return `<h3 class="subheading">Forge & equipment <span>3 slots · no random rolls</span></h3><div class="gear-slots">${(['weapon','armor','charm'] as const).map(slot=>`<label>${slot.toUpperCase()}<select data-gear-slot="${slot}" aria-label="${slot}"><option value="">Choose equipment</option>${GEAR.filter(g=>g.slot===slot).map(g=>`<option value="${g.id}" ${h.gear?.[slot]===g.id?'selected':''} ${!h.inventory?.includes(g.id)&&p.gold<g.cost?'disabled':''}>${g.name} · ${h.inventory?.includes(g.id)?'owned':g.cost+'g'}</option>`).join('')}</select><small>${GEAR.find(g=>g.id===h.gear?.[slot])?.description??'Tidak ada gear. Item dibeli sekali; swap item yang sudah dimiliki gratis.'}</small></label>`).join('')}</div>`;
}
function bestiary() {
  return `<div class="section-heading"><div><span class="eyebrow">KNOW YOUR ENEMY</span><h2>Field bestiary</h2></div></div><p class="town-copy">Tanda target mengikuti hero yang ditandai. Tanda di tanah tetap di tile. Serangan seluruh grid tidak bisa di-dodge: siapkan Guard atau interrupt.</p><div class="bestiary-list">${Object.values(ENEMIES).map(e => `<article><img src="${monster(e.id)}" alt="${e.name} pixel art"/><div><small>${e.title}</small><h3>${e.name}</h3><p>${e.description}</p><p class="counter-note"><b>COUNTER</b> ${e.counter}</p></div></article>`).join('')}</div>`;
}

function raids(state: TownState) {
  const choices = ['golem', 'wraith', 'treant', 'dragon'];
  const selected = ENEMIES[state.raid];
  return `<div class="section-heading"><div><span class="eyebrow">RAID CONTRACTS</span><h2>Choose your quarry.</h2></div></div><p class="town-copy">Satu boss. Party dan talent dari town ikut bertarung. Musuh menyesuaikan ukuran party; mekanik tetap berbahaya.</p><div class="raid-roster">${choices.map(id => `<button data-raid="${id}" class="${state.raid === id ? 'chosen' : ''}" aria-pressed="${state.raid === id}"><img src="${monster(id)}" alt=""/><b>${ENEMIES[id].name}</b><small>${ENEMIES[id].title}</small></button>`).join('')}</div><article class="mission-brief"><h3>${selected.name}</h3><p>${selected.description}</p><p class="counter-note">${selected.counter}</p><div class="departure-actions"><button class="gold-button" data-depart="raid">Hunt ${selected.name}</button><button class="secondary-button" data-facility="party">Atur loadout</button></div></article>`;
}

function endless(p: Profile) {
  return `<div class="section-heading"><div><span class="eyebrow">THE SUNKEN BELL</span><h2>A different run.<br>A different build.</h2></div><span class="chapter-counter">BEST ${p.bestFloor}</span></div><p class="town-copy">Turun ke ruang bawah lonceng. Setelah tiap kemenangan, pilih satu dari tiga boon. Efek bisa saling menguatkan: bangun gaya main dari pilihan yang muncul, bukan hanya angka damage.</p><div class="endless-rules"><p><b>Town talents stay.</b> Skill dan talent pilihanmu dibawa masuk.</p><p><b>Boons belong to this run.</b> Kematian atau pulang mengakhiri build sementara.</p><p><b>Every floor pushes back.</b> Musuh berganti, tekanan meningkat. Party pulih saat turun ke floor berikutnya.</p></div><div class="departure-actions"><button class="gold-button" data-depart="endless">Descend · floor 1</button><button class="secondary-button" data-facility="party">Siapkan build</button></div>`;
}
