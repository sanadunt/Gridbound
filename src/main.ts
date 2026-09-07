import Phaser from 'phaser';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import './style.css';
import './town.css';
import './rpg.css';
import './progression.css';
import './paged-town.css';
import './compact-combat.css';
import { Battle, type BattleEvent, type BattleOptions } from './game/simulation';
import { KITS, ROSTER, type Mode } from './game/content';
import { CAMPAIGN, BOONS, boonChoices } from './game/world';
import { promote, equipGear, buyTalent, equipSkill, respecHero, moveFormation, completeZone, profileModifiers, canEnterZone, settleProgress, claimQuest, syncProfileEconomy, buyChallengeUnlock } from './game/profile';
import { renderTown, portrait, type TownState, type TownTab } from './ui/town';
import { BattleScene, ARENA, cell } from './render/BattleScene';
import { ResultGate, RESULT_INPUT_DELAY_MS, type ResultGateGeneration } from './ui/result-gate';
import { Sound } from './audio/sound';
import { loadSave, saveProfile } from './game/save';
import { storyBattleOptions, setStoryParty } from './game/story-party';
import { QUESTS, questProgress } from './game/quests';
import { CHALLENGE_SHOP, createRunWallet, creditRun, resetRunWallet, getRaidContractForEnemy, roguelikeMilestoneForFloor, buyRunItem, type RunWallet } from './economy/challenge';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const store={getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>localStorage.setItem(key,value)};
const saved=loadSave(store);
const profile=saved.profile;
if (matchMedia('(prefers-reduced-motion: reduce)').matches) profile.motion = false;
let storageFailed = false;
function persist() {
  syncProfileEconomy(profile);
  try { saveProfile(store,profile,saved.readOnly); storageFailed = false; }
  catch { storageFailed = true; }
  $('wallet').textContent = `${profile.gold}g`;
  const bankWallet = document.getElementById('bank-wallet');
  if (bankWallet) bankWallet.textContent = `${profile.economy.commanderCrystal} Crystal`;
  $('storage-status').textContent = saved.readOnly ? saved.warning : storageFailed ? 'Save tidak tersedia. Progress hanya bertahan selama tab ini terbuka.' : 'Local save v3 · level, quest dan build tersimpan di perangkat ini';
}
const sound = new Sound();
sound.enabled = profile.sound;
let battle = new Battle('adventure', 1, profileModifiers(profile), storyBattleOptions(profile));
let scene: BattleScene;
let inTown = true;
let initialized = false;
let recorded = false;
let experienceRewards:NonNullable<ReturnType<typeof settleProgress>>=[];
let lastStatus = battle.status;
let drawIn = 0;
let moveMode = false;
let selectedKey = '';
let bannerTimer = 0;
let runBoons: string[] = [];
let runWallet: RunWallet = createRunWallet();
let runSeed = Date.now() % 1000000;
let offeredBoons: typeof BOONS = [];
let resumeOnClose = false;
let resultGeneration: ResultGateGeneration | undefined;
const townState: TownState = {
  tab: 'campaign', hero: 0, zone: Math.min(profile.cleared.length, CAMPAIGN.length - 1), raid: 'golem', notice: '',
  trainingTab: 'talents', campaignPage: 0, questPage: 0, bestiaryPage: 0,
};

$('app').innerHTML = `
<header class="site-header"><button class="brand" id="home" aria-label="Pulang ke Emberhollow"><span class="brand-mark" aria-hidden="true">${'<i></i>'.repeat(9)}</span><span>GRIDBOUND<small>ASHES OF THE BELL</small></span></button>
  <nav class="mode-tabs" aria-label="Mode permainan"><button data-view="campaign" class="active">Town & story</button><button data-view="raid">Raid hunts</button><button data-view="endless">Roguelike</button></nav>
  <div class="header-tools"><b id="wallet" class="wallet">${profile.gold}g</b><b id="bank-wallet" class="wallet bank-wallet">${profile.economy.commanderCrystal} Crystal</b><button id="sound" class="icon-button" aria-label="Toggle audio" aria-pressed="${profile.sound}">♫</button><button id="settings" class="icon-button" aria-label="Settings">⚙</button></div>
</header>
  <main id="town-screen" class="town-screen"></main>
  <main id="battle-screen" class="game-layout" hidden>
    <aside class="left-sidebar"><span class="eyebrow" id="expedition-label">EXPEDITION</span><h1 id="journey-title">Beyond<br>the bell.</h1><p class="intro-copy" id="journey-copy"></p><ol id="stage-list" class="expedition-stages"></ol>
      <section class="field-guide"><div class="section-label">READ. REACT. SURVIVE.</div><p>Tap hero untuk mengisi skill lebih cepat. Ganti fokus saat fatigue naik.</p><p>Ground: pindah tile. Marked: lindungi hero yang diincar. All-grid: Guard atau interrupt.</p><button id="howto" class="secondary-button">Field guide</button></section>
      <section class="run-boons"><h3>Run boons</h3><div id="boon-list"></div></section><section class="run-shop-panel"><h3>Journey shop</h3><div id="run-shop-host"></div><small>Journey Crystal resets on abandon, defeat, or clear. It never enters the bank.</small></section><button id="retreat" class="secondary-button">Pulang ke town</button>
    </aside>
    <section class="arena-column" aria-label="Arena pertarungan">
      <div class="arena-heading"><span><b id="mode-label"></b><span id="encounter-label"></span></span><button id="pause" class="icon-button" aria-label="Jeda permainan">Ⅱ</button></div>
      <div id="arena" class="arena"><div id="game-canvas"></div>
        <div class="boss-hud"><div class="boss-caption"><span id="boss-title"></span><span id="phase"></span></div><div class="boss-title"><h2 id="boss-name"></h2><span id="boss-health"></span></div><div class="boss-meter"><div id="boss-hp"></div></div><div class="stagger-row"><span id="stagger-label">ARMOR</span><div><i id="stagger"></i></div><span id="clock">00:00</span></div></div>
        <div id="banner" class="battle-banner" aria-live="polite"></div>
        <div class="lane-targets" aria-label="Pilih lane target">${['I', 'II', 'III'].map((label, i) => `<button data-lane="${i}" aria-label="Target lane ${i + 1}" aria-pressed="false">${label} <span>${['LEFT', 'CENTER', 'RIGHT'][i]}</span></button>`).join('')}</div>
        <div id="unit-layer"></div><div class="rank-label front">FRONT</div><div class="rank-label middle">MID</div><div class="rank-label back">BACK</div>
        <div class="board-bottom"><span id="standing"></span><span id="move-tip">DRAG TO REPOSITION</span></div>
        <div id="start-overlay" class="start-overlay"><div><span class="eyebrow" id="ready-label">BEYOND THE GATE</span><h3 id="ready-title">Ready, Bellkeepers?</h3><p id="ready-copy">Skill dan formasi telah disiapkan. Perhatikan tanda serangan.</p><button id="start" class="gold-button">Begin encounter</button></div></div>
      </div>
      <p class="tap-instruction"><b>Tap badan karakter</b> → cooldown lebih cepat · tombol kecil ↻ untuk ganti skill · drag untuk pindah</p><div id="intent" class="intent-panel" role="status"><b>No hostile intent</b><span>Perhatikan pola berikutnya.</span></div>
      <div class="action-bar"><button id="guard" class="guard-button"><span>Party Guard<small id="guard-label">G · READY</small></span></button><button id="potion" class="potion-button"><span>Mending mist<small id="potions">H · 2 CHARGES</small></span><b>2</b></button><button id="ultimate" class="ultimate-button" disabled><i id="resolve-fill"></i><span>Ninefold Dawn<small id="resolve-label">R · RESOLVE</small></span></button></div>
      <div class="arena-footnote"><button id="battle-home">Return to town</button><button id="help-shortcut">Controls & counters</button></div>
    </section>
    <aside class="right-sidebar"><button id="battle-info-toggle" class="battle-info-toggle" aria-expanded="false">Battle info <span>＋</span></button><div id="battle-info-panel"><div class="section-label">PARTY INSPECTOR <span id="party-size"></span></div><div id="inspector"></div><section class="battle-notes"><div class="section-label">BATTLE NOTES</div><div id="combat-log"></div></section><div class="session-stats"><div><small>DAMAGE</small><b id="damage">0</b></div><div><small>BLOCKED</small><b id="blocked">0</b></div><div><small>CARRIED LOOT</small><b id="loot">0g</b></div></div></div></aside>
  </main>
  <footer id="storage-status" class="storage-status" role="status"></footer>
  <dialog id="modal" aria-labelledby="modal-title"></dialog>`;
const modal = $<HTMLDialogElement>('modal');
const battleInfoToggle = $<HTMLButtonElement>('battle-info-toggle');
battleInfoToggle.addEventListener('click', () => {
  const sidebar = battleInfoToggle.closest<HTMLElement>('.right-sidebar');
  const open = sidebar?.classList.toggle('info-open') ?? false;
  battleInfoToggle.setAttribute('aria-expanded', String(open));
  battleInfoToggle.querySelector('span')!.textContent = open ? '−' : '＋';
});

function showTown(tab: TownTab = townState.tab, notice = '') {
  inTown = true;
  if (battle.status === 'fighting') battle.pause();
  townState.tab = tab;
  townState.notice = notice;
  $('town-screen').hidden = false;
  $('battle-screen').hidden = true;
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === (['party', 'bestiary', 'quests'].includes(tab) ? 'campaign' : tab)));
  renderTown($('town-screen'), profile, townState);
  persist();
}
$('town-screen').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled || !inTown) return;
  sound.unlock();
  if (button.dataset.storyToggle !== undefined) {
    const id=Number(button.dataset.storyToggle);
    const ids=profile.storyActive.includes(id)?profile.storyActive.filter(hero=>hero!==id):[...profile.storyActive,id];
    const ok=setStoryParty(profile,ids);
    showTown('party',ok?'Story party disimpan. Semua loadout tetap tersimpan.':'Pilih minimal 1 hero dan jangan melebihi cap Story.');
    return;
  }
  if (button.dataset.facility) {
    townState.pendingGear = undefined;
    showTown(button.dataset.facility as TownTab);
  }
  if(button.dataset.inspectTalent){townState.selectedTalent=button.dataset.inspectTalent;showTown('party');return;}
  if (button.dataset.branch) { townState.talentBranch = button.dataset.branch; showTown('party'); return; }
  if (button.dataset.trainingTab) {
    townState.trainingTab = button.dataset.trainingTab as TownState['trainingTab'];
    showTown('party');
  }
  if (button.dataset.campaignPage) {
    townState.campaignPage = Math.max(0, townState.campaignPage + Number(button.dataset.campaignPage));
    showTown('campaign');
  }
  if (button.dataset.questPage) {
    townState.questPage = Math.max(0, townState.questPage + Number(button.dataset.questPage));
    showTown('quests');
  }
  if (button.dataset.bestiaryPage) {
    townState.bestiaryPage = Math.max(0, townState.bestiaryPage + Number(button.dataset.bestiaryPage));
    showTown('bestiary');
  }
  if (button.dataset.townHero) {
    townState.hero = Number(button.dataset.townHero);
    townState.pendingGear = undefined;
    showTown('party');
  }
  if (button.dataset.zone) {
    townState.zone = Number(button.dataset.zone);
    townState.campaignPage = townState.zone;
    showTown('campaign');
  }
  if (button.dataset.raid) { townState.raid = button.dataset.raid; showTown('raid'); }
  if (button.dataset.bankBuy) {
    const item = buyChallengeUnlock(profile, button.dataset.bankBuy);
    showTown(townState.tab, item ? `${item.name} unlocked. Bank Crystal spent; equip it before a future run.` : 'Not enough bank Crystal or this unlock is already owned.');
    return;
  }
  if (button.dataset.runBuy) {
    const item = buyRunItem(runWallet, button.dataset.runBuy);
    if (item) {
      if (item.id === 'run-heal') battle.heroes.forEach(hero => battle.heal(hero, 130));
      if (item.id === 'run-upgrade') battle.power *= 1.1;
      if (item.id === 'run-reroll') offeredBoons = boonChoices(runBoons, runSeed + battle.floor * 104729);
      updateExpedition();
      frame(1);
    }
    if (item && inTown) showTown(townState.tab, `${item.name} bought for this run.`);
    return;
  }
  if (button.hasAttribute('data-confirm-gear')) {
    const pending = townState.pendingGear;
    if (pending && pending.hero === townState.hero && pending.gearId) {
      const ok = equipGear(profile, pending.hero, pending.gearId);
      townState.pendingGear = undefined;
      showTown('party', ok ? 'Equipment dibeli atau dipasang. Efek berlaku pada expedition berikutnya.' : 'Equipment tidak dapat dibeli atau dipasang.');
    }
    return;
  }
  if (button.hasAttribute('data-cancel-gear')) {
    townState.pendingGear = undefined;
    showTown('party');
    return;
  }
  if (button.dataset.promote) { const ok=promote(profile,townState.hero,button.dataset.promote);showTown('party',ok?'Job baru dipelajari. Pasang signature skill di slot aktif.':'Persyaratan promosi belum terpenuhi.'); }
  if (button.dataset.talent) {
    const ok = buyTalent(profile, townState.hero, button.dataset.talent);
    showTown('party', ok ? 'Talent dipelajari. Efek akan dibawa ke expedition berikutnya.' : 'Talent belum tersedia atau gold tidak cukup.');
  }
  if (button.dataset.formation) {
    moveFormation(profile, townState.hero, Number(button.dataset.formation));
    showTown('party', 'Formasi disimpan.');
  }
  if (button.hasAttribute('data-respec')) {
    respecHero(profile, townState.hero);
    showTown('party', 'Talent direset, gold dikembalikan. Dua skill dasar dipasang kembali.');
  }
  if(button.dataset.claimQuest){const q=QUESTS.find(q=>q.id===button.dataset.claimQuest);const ok=claimQuest(profile,button.dataset.claimQuest,townState.hero);showTown('quests',ok?`Reward diterima ${ROSTER[q?.heroId??townState.hero].name}. Equipment hadiah masuk inventory; pasang di Training hall.`:'Quest belum selesai atau sudah diklaim.');}
  if(button.dataset.trackQuest){const q=QUESTS.find(q=>q.id===button.dataset.trackQuest);if(q&&questProgress(profile,q).unlocked){profile.trackedQuest=q.id;showTown('quests','Quest ditandai. Progress dihitung dari kemenangan yang sudah dibank.');}}
  if(button.dataset.questHunt){townState.raid=button.dataset.questHunt;showTown('raid');}
  if (button.dataset.depart) depart(button.dataset.depart as Mode);
});
$('town-screen').addEventListener('change', event => {
  const el = event.target as HTMLSelectElement;
  if (!inTown) return;
  if(el.matches('[data-quest-filter]')){townState.questPage=0;townState.questFilter=el.value as 'available'|'all'|'claimed';showTown('quests');return;}
  if(el.matches('[data-quest-recipient]')){townState.hero=Number(el.value);showTown('quests');return;}
  if(el.matches('[data-raid-variant]')){townState.raid=el.value;showTown('raid');return;}
  if(el.matches('[data-gear-slot]')){
    const slot = el.dataset.gearSlot as 'weapon' | 'armor' | 'charm';
    townState.trainingTab = 'gear';
    if (!el.value) { townState.pendingGear = undefined; showTown('party'); return; }
    townState.pendingGear = { hero: townState.hero, slot, gearId: el.value };
    showTown('party');
    return;
  }
  if (!el.matches('[data-equip-slot]')) return;
  equipSkill(profile, townState.hero, Number(el.dataset.equipSlot), Number(el.value));
  showTown('party', 'Loadout disimpan. Slot pertama menjadi aksi pembuka.');
});

function depart(mode: Mode) {
  if (mode === 'adventure' && !canEnterZone(profile, townState.zone)) return;
  runBoons = [];
  resetRunWallet(runWallet);
  runWallet = createRunWallet();
  runSeed = Date.now() % 1000000;
  boot(mode, mode === 'adventure' ? townState.zone + 1 : mode === 'raid' ? profile.cleared.length+1 : 1);
}
function boot(mode: Mode = 'adventure', floor = 1, options: Partial<BattleOptions> = {}) {
  inTown = false;
  resultRequest++;
  presentingResult = false;
  resultGeneration = undefined;
  const sidebar = battleInfoToggle.closest<HTMLElement>('.right-sidebar');
  sidebar?.classList.remove('info-open');
  battleInfoToggle.setAttribute('aria-expanded', 'false');
  battleInfoToggle.querySelector('span')!.textContent = '＋';
  const milestone = mode === 'endless' ? roguelikeMilestoneForFloor(floor) : undefined;
  battle = new Battle(mode, floor, profileModifiers(profile), {
    roster: [...profile.roster], loadouts: structuredClone(profile.loadouts),
    boons: [...runBoons], settlementId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...(mode === 'raid' ? { enemyId: townState.raid, raidContract: getRaidContractForEnemy(townState.raid, 'bronze') } : {}),
    ...(mode === 'endless' && milestone ? { runWallet, runAct: milestone.act, runActClear: milestone.actClear, runFinalClear: milestone.finalClear } : {}), ...options,
    ...(mode === 'adventure' ? storyBattleOptions(profile) : {}),
  });
  recorded = false;
  experienceRewards=[];
  offeredBoons = [];
  lastStatus = 'ready';
  moveMode = false;
  touches.clear();
  if (initialized) { scene.dragId = -1; scene.dragPoint = undefined; scene.hoverSlot = -1; scene.replace(battle); }
  $('town-screen').hidden = true;
  $('battle-screen').hidden = false;
  makeUnits();
  updateExpedition();
  showReady();
  $('combat-log').textContent = '';
  addLog('Formasi siap. Talent dan dua skill aktif sudah dibawa dari town.');
  document.querySelectorAll<HTMLElement>('[data-lane]').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-pressed', 'false'); });
  frame(1);
  requestAnimationFrame(() => scene.scale?.refresh());
  $('battle-screen').scrollIntoView({ block: 'start' });
}
function updateExpedition() {
  const c = CAMPAIGN[battle.floor - 1];
  $('loot').textContent = battle.mode === 'endless' ? `${runWallet.crystal} RUN` : battle.mode === 'raid' ? `${battle.raidContract?.tier.toUpperCase() ?? 'PRACTICE'} · ${battle.raidContract?.sandbox ? 'NO CRYSTAL' : 'CONTRACT'}` : `${battle.gold}g`;
  const runShopHost = document.getElementById('run-shop-host');
  if (runShopHost) runShopHost.innerHTML = battle.mode === 'endless' && battle.status === 'ready' ? CHALLENGE_SHOP.map(item => `<button class="secondary-button" data-run-buy="${item.id}" ${runWallet.crystal < item.cost ? 'disabled' : ''}>${item.name} · ${item.cost} RUN</button>`).join('') : '';
  $('mode-label').textContent = battle.mode === 'adventure' ? `CHAPTER ${battle.floor}` : battle.mode === 'endless' ? `FLOOR ${battle.floor}` : 'RAID HUNT';
  $('encounter-label').textContent = battle.stageName;
  $('boss-name').textContent = battle.enemyName;
  $('boss-title').textContent = battle.enemyTitle;
  $('expedition-label').textContent = battle.mode === 'adventure' ? 'STORY CAMPAIGN' : battle.mode === 'endless' ? 'THE SUNKEN BELL' : 'RAID CONTRACT';
  $('journey-title').textContent = battle.mode === 'adventure' ? c.name : battle.mode === 'endless' ? 'Below the bell.' : battle.enemyName;
  $('journey-copy').textContent = battle.mode === 'adventure' ? c.subtitle : 'Baca intent, siapkan counter. Jangan biarkan party kehilangan tempo.';
  $('stage-list').innerHTML = battle.mode === 'adventure' ? c.stages.map((s, i) => `<li class="${i === battle.stage ? 'current' : i < battle.stage ? 'completed' : ''}"><small>${i + 1} · ${s.kind.toUpperCase()}</small><span>${s.name}</span></li>`).join('') : '';
  $('boon-list').innerHTML = runBoons.length ? runBoons.map(id => { const b = BOONS.find(b => b.id === id)!; return `<p><b>${b.name}</b><small>${b.description}</small></p>`; }).join('') : '<p class="log-muted">Belum ada boon di run ini.</p>';
}
function showReady() {
  $('start-overlay').hidden = false;
  $('ready-label').textContent = battle.stageName;
  $('ready-title').textContent = battle.stage > 0 ? 'Keep the ember alive.' : 'Ready, Bellkeepers?';
  $('ready-copy').textContent = battle.mode==='adventure' ? (CAMPAIGN[battle.floor-1].stages[battle.stage].beat??(battle.stage===0?CAMPAIGN[battle.floor-1].intro:'Jalur berikutnya terbuka. HP dan potion dibawa; siapkan stance dan baca intent sebelum menyerang.')) : battle.stage > 0 ? 'HP dan potion tersisa dibawa ke wave ini. Periksa stance sebelum lanjut.' : 'Skill dan formasi sudah siap. Tap mempercepat; strategi menjaga party tetap hidup.';
  $('start').textContent = 'Begin encounter';
}
function begin() {
  if (inTown) return;
  if (['victory', 'defeat'].includes(battle.status)) { result(); return; }
  sound.unlock();
  battle.start();
  $('start-overlay').hidden = true;
  addLog('Pertarungan dimulai. Perhatikan intent musuh.');
}

function makeUnits() {
  $('unit-layer').innerHTML = battle.heroes.map(h => {
    const p = cell(h.slot);
    return `<div class="unit-card" data-hero="${h.id}" style="left:${p.x / 6}%;top:${p.y / 7.6}%;width:24%;height:${120 / 7.6}%;--class-color:${KITS[h.classId].color}"><button class="unit-tap" data-tap="${h.id}" aria-label="Tap ${h.name} untuk mempercepat"><span class="unit-name">${h.name}</span><span class="tap-hint">TAP ↓ CD</span><span class="unit-cd"></span><span class="tap-flash">TEMPO</span></button><button class="unit-stance" data-stance="${h.id}" aria-label="Ganti skill ${h.name}"></button><div class="unit-health"><i></i><em></em></div><div class="unit-cooldown"><i></i></div></div>`;
  }).join('');
  $('unit-layer').querySelectorAll<HTMLElement>('[data-tap]').forEach(el => bindPointer(el, Number(el.dataset.tap)));
  $('unit-layer').querySelectorAll<HTMLElement>('[data-stance]').forEach(el => el.addEventListener('click', () => cycleSkill(Number(el.dataset.stance))));
  $('party-size').textContent = `${battle.heroes.length} HEROES`;
  selectedKey = '';
  renderInspector();
}
function cycleSkill(id: number, direction = 1) {
  const h = battle.hero(id);
  if (!h) return;
  const skills = battle.availableSkills(id);
  battle.selected = id;
  battle.stance(id, skills[(skills.indexOf(h.stance) + direction + skills.length) % skills.length]);
  sound.unlock();
  renderInspector();
}
type Touch = { id: number; x: number; y: number; started: number; drag: boolean; el: HTMLElement };
const touches = new Map<number, Touch>();
function point(x: number, y: number) {
  const r = $('arena').getBoundingClientRect();
  return { x: (x - r.left) / r.width * 600, y: (y - r.top) / r.height * 760 };
}
function slotAt(p: { x: number; y: number }) {
  for (let i = 0; i < 9; i++) { const c = cell(i); if (p.x >= c.x && p.x < c.x + 144 && p.y >= c.y && p.y < c.y + 112) return i; }
  return -1;
}
function tapHero(id: number, sync = false) {
  if (inTown) return;
  battle.selected = id;
  if (battle.tap(id, sync)) {
    const el = document.querySelector<HTMLElement>(`[data-tap="${id}"]`)!;
    el.classList.remove('tapped');
    void el.offsetWidth;
    el.classList.add('tapped');
    frame(1);
  }
  renderInspector();
}
function bindPointer(el: HTMLElement, id: number) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || touches.size >= 2 || inTown) return;
    const h = battle.hero(id);
    if (!h || h.hp <= 0) return;
    sound.unlock();
    if (moveMode) { battle.move(battle.selected, h.slot); moveMode = false; renderInspector(); return; }
    battle.selected = id;
    renderInspector();
    el.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, { id, x: e.clientX, y: e.clientY, started: performance.now(), drag: false, el });
  });
  el.addEventListener('pointermove', e => {
    const t = touches.get(e.pointerId);
    if (!t || scene.dragId !== -1 && scene.dragId !== id) return;
    if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 9) {
      t.drag = true;
      scene.dragId = id;
      scene.dragPoint = point(e.clientX, e.clientY);
      scene.hoverSlot = slotAt(scene.dragPoint);
      el.closest('.unit-card')?.classList.add('dragging');
    }
  });
  const finish = (e: PointerEvent, cancelled = false) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    if (!cancelled) {
      if (t.drag) { const slot = slotAt(point(e.clientX, e.clientY)); if (slot >= 0) battle.move(id, slot); }
      else tapHero(id, [...touches.entries()].some(([key, other]) => key !== e.pointerId && other.id === id && Math.abs(other.started - t.started) < 120));
    }
    touches.delete(e.pointerId);
    if (t.drag) { scene.dragId = -1; scene.dragPoint = undefined; scene.hoverSlot = -1; }
    el.closest('.unit-card')?.classList.remove('dragging');
  };
  el.addEventListener('pointerup', e => finish(e));
  el.addEventListener('pointercancel', e => finish(e, true));
  el.addEventListener('lostpointercapture', e => finish(e as PointerEvent, true));
  el.addEventListener('click', e => { if (e.detail === 0) tapHero(id); });
}
function renderInspector() {
  const h = battle.hero(battle.selected);
  if (!h) return;
  const k = KITS[h.classId];
  const key = `${h.id}-${h.stance}-${moveMode}-${battle.status}`;
  if (key === selectedKey) return;
  selectedKey = key;
  $('inspector').innerHTML = `<div class="hero-identity"><div class="portrait-frame"><img src="${portrait(h.classId)}" alt="${h.name}"/><span>LV. ${h.level}</span></div><div><span class="hero-class">${k.name}</span><h2>${h.name}</h2><p>${k.role}</p></div></div><div class="hero-stats"><span>HP <b id="selected-hp"></b></span><span>SHIELD <b id="selected-shield"></b></span></div><div class="section-label stance-label">EQUIPPED SKILLS <span>AUTO-CAST</span></div><div class="stance-options">${battle.availableSkills(h.id).map(i => { const s = k.skills[i]; return `<button data-select-stance="${i}" class="stance-option ${h.stance === i ? 'chosen' : ''}" aria-pressed="${h.stance === i}" ${!['ready', 'fighting'].includes(battle.status) || h.hp <= 0 ? 'disabled' : ''}><span><b>${s.name}</b><small>${s.label} · ${s.cooldown.toFixed(1)}s</small></span><i>${h.stance === i ? '●' : '○'}</i></button>`; }).join('')}</div><p class="skill-description">${k.skills[h.stance].description}</p><div class="focus-meter"><div><span>TAP FATIGUE</span><span id="fatigue-label">FRESH</span></div><span><i id="fatigue-fill"></i></span></div><button id="move-selected" class="move-button">${moveMode ? 'Pilih grid tujuan · Esc batal' : 'Pindahkan karakter'}<small>+0.9s</small></button><div class="move-grid" ${moveMode ? '' : 'hidden'}>${Array.from({ length: 9 }, (_, i) => `<button data-move-slot="${i}" aria-label="Pindah ke grid ${i + 1}" ${i === h.slot ? 'disabled' : ''}>${i + 1}</button>`).join('')}</div>`;
  $('inspector').querySelectorAll<HTMLElement>('[data-select-stance]').forEach(el => el.addEventListener('click', () => { battle.stance(h.id, Number(el.dataset.selectStance)); renderInspector(); }));
  $('move-selected').addEventListener('click', () => { moveMode = !moveMode; renderInspector(); });
  $('inspector').querySelectorAll<HTMLElement>('[data-move-slot]').forEach(el => el.addEventListener('click', () => { battle.move(battle.selected, Number(el.dataset.moveSlot)); moveMode = false; renderInspector(); }));
}
function formatTime(t: number) { return `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`; }
function frame(dt: number) {
  if (inTown) return;
  drawIn -= dt;
  if (drawIn > 0) return;
  drawIn = .06;
  if (battle.status !== lastStatus) { lastStatus = battle.status; renderInspector(); if (['victory', 'defeat'].includes(battle.status)) result(); }
  $('boss-health').textContent = `${Math.ceil(battle.bossHp).toLocaleString()} / ${battle.bossMax.toLocaleString()}`;
  $('boss-hp').style.width = `${battle.bossHp / battle.bossMax * 100}%`;
  $('phase').textContent = `PHASE ${battle.phase} / 3`;
  $('stagger').style.width = `${battle.breakLeft > 0 ? battle.breakLeft / 6 * 100 : battle.stagger / 800 * 100}%`;
  $('stagger-label').textContent = battle.breakLeft > 0 ? 'BREAK' : 'ARMOR';
  $('clock').textContent = formatTime(battle.time);
  const threat = [...battle.threats].sort((a, b) => a.left - b.left)[0];
  $('intent').classList.toggle('danger', Boolean(threat));
  $('intent').querySelector('b')!.textContent = threat ? `${threat.name} · ${Math.max(0, threat.left).toFixed(1)}s${threat.targetId !== undefined ? ` · ${battle.hero(threat.targetId)?.name ?? 'MARKED'}` : ''}` : battle.guardLeft > 0 ? `PARTY GUARD · ${battle.guardLeft.toFixed(1)}s` : 'Watch the next move.';
  $('intent').querySelector('span')!.textContent = threat ? `${threat.counter ?? 'Pindahkan hero dari tile yang ditandai.'}${battle.threats.length > 1 ? ` (+${battle.threats.length - 1} intent lain)` : ''}` : 'Ground: move. Marked: protect. All-grid: Guard / interrupt.';
  $('damage').textContent = Math.round(battle.damage).toLocaleString();
  $('blocked').textContent = Math.round(battle.blocked).toLocaleString();
  $('loot').textContent = battle.mode === 'endless' ? `${runWallet.crystal} RUN` : battle.mode === 'raid' ? `${battle.raidContract?.sandbox ? 'PRACTICE' : battle.raidContract?.tier.toUpperCase() ?? 'PRACTICE'}` : `${battle.gold}g`;
  $('standing').textContent = `${battle.living().length} / ${battle.heroes.length} STANDING`;
  $('move-tip').textContent = moveMode ? 'CHOOSE A DESTINATION' : 'DRAG TO REPOSITION';
  $('resolve-fill').style.width = `${battle.resolve}%`;
  $('resolve-label').textContent = battle.resolve >= 100 ? 'R · READY' : `R · ${Math.floor(battle.resolve)}% RESOLVE`;
  $<HTMLButtonElement>('ultimate').disabled = battle.resolve < 100 || battle.status !== 'fighting';
  $<HTMLButtonElement>('potion').disabled = battle.potions <= 0 || battle.status !== 'fighting';
  $('potions').textContent = `H · ${battle.potions} CHARGES`;
  $('potion').querySelector('b')!.textContent = String(battle.potions);
  $<HTMLButtonElement>('guard').disabled = battle.guardCooldown > 0 || battle.status !== 'fighting';
  $('guard-label').textContent = battle.guardLeft > 0 ? `ACTIVE · ${battle.guardLeft.toFixed(1)}s` : battle.guardCooldown > 0 ? `G · ${battle.guardCooldown.toFixed(1)}s` : 'G · READY';
  $('guard').classList.toggle('guarding', battle.guardLeft > 0);
  for (const h of battle.heroes) {
    const el = document.querySelector<HTMLElement>(`[data-hero="${h.id}"]`);
    if (!el) continue;
    const p = cell(h.slot);
    el.style.left = `${p.x / 6}%`;
    el.style.top = `${p.y / 7.6}%`;
    el.classList.toggle('selected', h.id === battle.selected);
    el.classList.toggle('downed', h.hp <= 0);
    el.classList.toggle('buffed', h.buff > 0);
    el.querySelector('.unit-cd')!.textContent = h.hp <= 0 ? 'DOWN' : h.moveLock > 0 ? 'MOVE' : `${h.remaining.toFixed(1)}s`;
    const stance = el.querySelector<HTMLButtonElement>('.unit-stance')!;
    stance.textContent = `${KITS[h.classId].skills[h.stance].label} ⟳`;
    stance.disabled = h.hp <= 0 || !['ready', 'fighting'].includes(battle.status);
    (el.querySelector('.unit-health i') as HTMLElement).style.width = `${h.hp / h.maxHp * 100}%`;
    (el.querySelector('.unit-health em') as HTMLElement).style.width = `${h.shield / h.maxHp * 100}%`;
    (el.querySelector('.unit-cooldown i') as HTMLElement).style.width = `${Math.min(100, Math.max(0, 1 - h.remaining / h.total) * 100)}%`;
  }
  const h = battle.hero(battle.selected);
  if (h && $('selected-hp')) {
    $('selected-hp').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
    $('selected-shield').textContent = String(Math.round(h.shield));
    $('fatigue-label').textContent = h.fatigue > 70 ? 'TIRED · SWITCH HERO' : h.fatigue > 40 ? 'WARM' : 'FRESH';
    $('fatigue-fill').style.width = `${h.fatigue}%`;
  }
}
function addLog(text: string) {
  const p = document.createElement('p');
  p.className = 'log-entry';
  const time = document.createElement('span');
  time.textContent = formatTime(battle.time);
  p.append(time, document.createTextNode(text));
  $('combat-log').prepend(p);
  while ($('combat-log').children.length > 5) $('combat-log').lastElementChild?.remove();
}
window.addEventListener('battle-banner', event => {
  if (inTown) return;
  const e = (event as CustomEvent<BattleEvent>).detail;
  $('banner').textContent = e.text ?? '';
  $('banner').className = `battle-banner visible ${e.type === 'warning' ? 'danger' : ''}`;
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => $('banner').classList.remove('visible'), 1800);
  if (e.text) addLog(e.text);
});

function openModal(content: string, pause = true) {
  const alreadyOpen = modal.open;
  if (!alreadyOpen) resumeOnClose = !inTown && pause && battle.status === 'fighting';
  if (!inTown && pause && battle.status === 'fighting') { resumeOnClose = true; battle.pause(); }
  modal.innerHTML = `${content}<button data-close class="modal-close icon-button" aria-label="Tutup dialog">×</button>`;
  if (!alreadyOpen) modal.showModal();
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.close()));
}
modal.addEventListener('close', () => { if (resumeOnClose && !inTown && battle.status === 'paused') battle.pause(); resumeOnClose = false; clearResultState(); });
function closeWithoutResume() { resumeOnClose = false; clearResultState(); if (modal.open) modal.close(); }
function help() {
  openModal(`<span class="eyebrow">COMMANDER'S FIELD GUIDE</span><h2 id="modal-title">Every intent has an answer.</h2><div class="help-rows"><p><b>Tap / angka 1–9</b><br>Percepat cooldown hero di tile tersebut. Berganti fokus saat fatigue naik. Dua pointer didukung; drag tidak dihitung sebagai tap.</p><p><b>Skill / Q dan E</b><br>Ganti antara dua skill yang dipasang di town. Persentase cooldown dipertahankan, bukan direset.</p><p><b>Drag / Pindahkan karakter</b><br>Keluar dari ground AoE. Relokasi menambah cooldown 0,9 detik. Serangan marked tetap mengikuti hero: gunakan shield, heal, atau Guard.</p><p><b>Party Guard / G</b><br>Mitigasi seluruh party untuk window singkat. Tekan menjelang all-grid impact, jangan terlalu dini. Skill interrupt dapat membatalkan ritual.</p><p><b>Mending mist / H · Ninefold Dawn / R</b><br>Potion terbatas per expedition. Resolve mengisi serangan party. Jangan menunggu healer tumbang.</p><p><b>Lane I, II, III</b><br>Arahkan ranged skill ke minion. Klik lane yang sama lagi untuk kembali ke boss.</p></div><button class="gold-button" data-close>Kembali memimpin</button>`);
}
function settings() {
  openModal(`<span class="eyebrow">CAMP SETTINGS</span><h2 id="modal-title">Your kind of adventure.</h2><label class="setting-row"><span><b>Suara & musik</b><small>Chiptune dan feedback skill.</small></span><input id="setting-sound" type="checkbox" ${profile.sound ? 'checked' : ''}></label><label class="setting-row"><span><b>Full motion & particles</b><small>Matikan untuk mengurangi gerakan dan screen shake.</small></span><input id="setting-motion" type="checkbox" ${profile.motion ? 'checked' : ''}></label><p>Save v3 menyimpan XP tiap hero, quest, talent, inventory dan formasi. Save v2 lama tetap utuh untuk rollback. Pertarungan berjalan tidak disimpan.</p><button id="export-save" class="secondary-button">Download backup save JSON</button><button class="gold-button" data-close>Kembali</button>`);
  $('export-save').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Gridbound-save-v3.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('setting-sound').addEventListener('change', e => { profile.sound = (e.target as HTMLInputElement).checked; updateSound(); });
  $('setting-motion').addEventListener('change', e => { profile.motion = (e.target as HTMLInputElement).checked; scene.reducedMotion = !profile.motion; document.body.classList.toggle('reduced-motion', !profile.motion); persist(); });
}
function updateSound() { sound.enabled = profile.sound; if (profile.sound) sound.unlock(); $('sound').setAttribute('aria-pressed', String(profile.sound)); persist(); }
function pauseMenu() {
  if (inTown) return;
  if (['victory', 'defeat'].includes(battle.status)) { result(); return; }
  if (modal.open) { modal.close(); return; }
  openModal(`<span class="eyebrow">TAKE A BREATH</span><h2 id="modal-title">The forest can wait.</h2><p>Simulasi berhenti selama dialog terbuka.</p><button class="gold-button" data-close>Lanjutkan</button><button id="pause-help" class="secondary-button">Kontrol & counter</button><button id="pause-retreat" class="secondary-button">Akhiri expedition · pulang</button>`);
  $('pause-help').addEventListener('click', help);
  $('pause-retreat').addEventListener('click', () => { closeWithoutResume(); runBoons = []; resetRunWallet(runWallet); showTown(); });
}
function navigateTown(tab: TownTab = 'campaign') {
  if (inTown || ['ready', 'victory', 'defeat'].includes(battle.status)) { runBoons = []; resetRunWallet(runWallet); showTown(tab); return; }
  openModal(`<h2 id="modal-title">Pulang ke Emberhollow?</h2><p>HP dipulihkan di town, tetapi loot yang belum dibank dan boon run ini akan hilang.</p><button id="confirm-retreat" class="gold-button">Akhiri run & pulang</button><button class="secondary-button" data-close>Tetap bertarung</button>`);
  $('confirm-retreat').addEventListener('click', () => { closeWithoutResume(); runBoons = []; resetRunWallet(runWallet); showTown(tab); });
}
const resultGate = new ResultGate();
let presentingResult = false;
let resultRequest = 0;
function clearResultState() {
  delete modal.dataset.result;
  resultGeneration = undefined;
  resultGate.close();
}
modal.addEventListener('click', event => {
  if (modal.dataset.result === 'true' && !resultGate.allows(performance.now(), resultGeneration)) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);
modal.addEventListener('close', clearResultState);
modal.addEventListener('cancel', event => { if(modal.dataset.result === 'true' && !resultGate.allows(performance.now(), resultGeneration)) event.preventDefault(); });
function result() {
  if (presentingResult) return;
  presentingResult = true;
  const request = ++resultRequest;
  const current = battle, stage = battle.stage;
  const show = () => {
    presentingResult = false;
    if (request !== resultRequest || inTown || battle !== current || battle.stage !== stage) return;
    presentResult();
    modal.dataset.result = 'true';
    const generation = resultGate.open(performance.now());
    resultGeneration = generation;
    const buttons = Array.from(modal.querySelectorAll<HTMLButtonElement>('button'));
    buttons.forEach(button => { button.disabled = true; });
    const hint = document.createElement('p'); hint.setAttribute('role','status'); hint.textContent = 'Sebentar… opsi aktif dalam 1 detik.';
    modal.append(hint);
    window.setTimeout(() => {
      if (!modal.open || request !== resultRequest || battle !== current || battle.stage !== stage || !resultGate.allows(performance.now(), generation)) return;
      buttons.forEach(button => { button.disabled = false; });
      delete modal.dataset.result;
      resultGate.close();
      resultGeneration = undefined;
      hint.remove();
    }, RESULT_INPUT_DELAY_MS);
  };
  if (battle.status === 'victory') {
    const readiness = scene?.waitForEnemyDeathAnimation?.();
    if (readiness) readiness.then(show, show);
    else show();
  } else show();
}
function presentResult() {
  const won = battle.status === 'victory';
  const moreWaves = won && battle.mode === 'adventure' && battle.stage + 1 < battle.stageCount;
  const zone = CAMPAIGN[battle.floor - 1];
  let recruited: string[] = [];
  let reward = 0;
  if (!recorded && !moreWaves) {
    recorded = true;
    if (won) {
      if (battle.mode === 'endless') creditRun(runWallet, 3);
      reward = battle.gold + (battle.mode === 'adventure' ? zone.reward : 0);
      if (battle.mode === 'adventure') profile.gold += reward;
      profile.wins++;
      if (battle.mode === 'adventure') {
        const before = new Set(profile.roster);
        completeZone(profile, battle.floor - 1);
        recruited = profile.roster.filter(id => !before.has(id)).map(id => ROSTER[id].name);
        townState.zone = Math.min(profile.cleared.length, CAMPAIGN.length - 1);
      }
      if (battle.mode === 'endless') {
        profile.bestFloor = Math.max(profile.bestFloor, battle.floor);
        offeredBoons = boonChoices(runBoons, runSeed + battle.floor * 7919);
      }
      experienceRewards=settleProgress(profile,battle)??[];
      persist();
    }
  }
  $('start-overlay').hidden = false;
  $('ready-title').textContent = won ? moreWaves ? 'The path opens.' : 'The bell remembers.' : 'The ember remains.';
  $('ready-copy').textContent = 'Buka hasil untuk melanjutkan atau kembali ke town.';
  $('start').textContent = 'Lihat hasil';
  const description = moreWaves ? 'Masih ada bahaya di depan. HP, potion, formasi, dan cooldown party dibawa ke pertempuran berikutnya.' : won && battle.mode === 'adventure' ? zone.outro : won && battle.mode === 'raid' ? `${battle.raidContract?.sandbox ? 'Practice selesai; kontrak Sandbox tidak memberi Crystal.' : `Certified ${battle.raidContract?.tier ?? 'bronze'} contract settled. Bank Crystal: ${battle.raidContract ? 'receipt recorded' : 'none'}.`}` : won ? `Room clear. Journey purse sekarang ${runWallet.crystal} Crystal; act reward hanya masuk bank pada authored act clear.` : 'Party tumbang. Coba skill berbeda, jaga hero yang ditandai, dan simpan Guard untuk ritual.';
  openModal(`<span class="eyebrow">${moreWaves ? `STAGE ${battle.stage + 1} / ${battle.stageCount} CLEARED` : won ? 'EXPEDITION COMPLETE' : 'EXPEDITION LOST'}</span><h2 id="modal-title">${won ? moreWaves ? 'Keep moving.' : 'Bring the fire home.' : 'Rally. Adapt. Return.'}</h2><p>${description}</p>${recruited.length ? `<p class="recruit-notice">${recruited.join(' dan ')} bergabung dengan Bellkeepers. Rekan baru mengikuti level tengah party.</p>` : ''}${experienceRewards.length?`<section class="xp-results"><h3>Hero experience banked</h3>${experienceRewards.map(r=>`<p data-xp-kind="${r.kind}"><b>${ROSTER[r.id].name} · ${r.kind === 'bench' ? 'BENCH' : 'ACTIVE'}</b><span>+${r.xp} XP${r.bonus ? ` (catch-up +${r.bonus})` : ''} · ${r.after>r.before?`LEVEL UP ${r.before} → ${r.after}`:`Lv.${r.after}`}</span></p>`).join('')}<small>Hero tumbang mendapat 60% XP. Bonus stat baru aktif expedition berikutnya. ${QUESTS.filter(q=>questProgress(profile,q).ready).length} quest siap diklaim di town.</small></section>`:''}<div class="result-stats"><div><b>${formatTime(battle.time)}</b><small>ELAPSED</small></div><div><b>${battle.living().length}/${battle.heroes.length}</b><small>STANDING</small></div><div><b>${won ? moreWaves ? `${battle.gold}g` : `${battle.gold + (battle.mode === 'adventure' ? zone.reward : 0)}g` : '0g'}</b><small>${moreWaves ? 'CARRIED · NOT BANKED' : 'GOLD BANKED'}</small></div></div>${moreWaves ? '<button id="next-wave" class="gold-button">Lanjut ke encounter berikutnya</button>' : won && battle.mode === 'endless' ? `<h3>Choose a boon</h3><p>Efek aktif sampai run berakhir. Party pulih untuk floor berikutnya.</p>${!offeredBoons.length?'<button id="next-floor" class="gold-button">All boons collected · descend</button>':''}<div class="boon-draft">${offeredBoons.map(b => `<button data-boon="${b.id}"><small>${b.patron}</small><b>${b.name}</b><span>${b.description}</span></button>`).join('')}</div>` : '<button id="retry" class="secondary-button">Ulang expedition dari awal</button>'}<button id="result-town" class="${moreWaves ? 'secondary-button' : 'gold-button'}">${moreWaves ? 'Abandon loot & pulang' : 'Kembali ke Emberhollow'}</button>`, false);
  $('next-wave')?.addEventListener('click', () => {
    closeWithoutResume();
    if (battle.nextWave()) {
      lastStatus = 'ready';
      recorded = false;
      scene.replace(battle);
      makeUnits();
      updateExpedition();
      showReady();
      frame(1);
    }
  });
  modal.querySelectorAll<HTMLElement>('[data-boon]').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.boon!;
    if (!offeredBoons.some(b => b.id === id)) return;
    runBoons.push(id);
    offeredBoons = [];
    closeWithoutResume();
    boot('endless', battle.floor + 1);
  }));
  $('next-floor')?.addEventListener('click',()=>{closeWithoutResume();boot('endless',battle.floor+1);});
  modal.querySelectorAll<HTMLElement>('[data-run-buy]').forEach(el => el.addEventListener('click', () => {
    const item = buyRunItem(runWallet, el.dataset.runBuy!);
    if (!item) return;
    if (item.id === 'run-heal') battle.heroes.forEach(hero => battle.heal(hero, 130));
    if (item.id === 'run-upgrade') battle.power *= 1.1;
    if (item.id === 'run-reroll') offeredBoons = boonChoices(runBoons, runSeed + battle.floor * 104729);
    closeWithoutResume();
    updateExpedition();
    if (battle.mode === 'endless' && battle.status === 'paused') battle.pause();
    frame(1);
  }));
  modal.querySelectorAll<HTMLElement>('[data-run-buy]').forEach(el => el.addEventListener('click', () => {
    const item = buyRunItem(runWallet, el.dataset.runBuy!);
    if (!item) return;
    if (item.id === 'run-heal') battle.heroes.forEach(hero => battle.heal(hero, 130));
    if (item.id === 'run-upgrade') battle.power *= 1.1;
    if (item.id === 'run-reroll') offeredBoons = boonChoices(runBoons, runSeed + battle.floor * 104729);
    closeWithoutResume();
    updateExpedition();
    if (battle.mode === 'endless' && battle.status === 'paused') battle.pause();
    frame(1);
  }));
  modal.querySelector('[data-open-run-shop]')?.addEventListener('click', () => {
    const shop = document.createElement('section');
    shop.className = 'run-shop-modal';
    shop.innerHTML = `<h3>Journey shop · ${runWallet.crystal} Crystal</h3>${CHALLENGE_SHOP.map(item => `<button class="secondary-button" data-run-buy="${item.id}" ${runWallet.crystal < item.cost ? 'disabled' : ''}>${item.name} · ${item.cost} RUN</button>`).join('')}`;
    modal.querySelector('[data-open-run-shop]')?.replaceWith(shop);
    shop.querySelectorAll<HTMLElement>('[data-run-buy]').forEach(el => el.addEventListener('click', () => {
      const item = buyRunItem(runWallet, el.dataset.runBuy!);
      if (!item) return;
      if (item.id === 'run-heal') battle.heroes.forEach(hero => battle.heal(hero, 130));
      if (item.id === 'run-upgrade') battle.power *= 1.1;
      if (item.id === 'run-reroll') offeredBoons = boonChoices(runBoons, runSeed + battle.floor * 104729);
      closeWithoutResume(); updateExpedition(); frame(1);
    }));
  });
  $('retry')?.addEventListener('click', () => { const mode = battle.mode, floor = battle.mode === 'endless' ? 1 : battle.floor; runBoons = []; closeWithoutResume(); boot(mode, floor); });
  $('result-town').addEventListener('click', () => { runBoons = []; resetRunWallet(runWallet); closeWithoutResume(); showTown(battle.mode === 'adventure' ? 'campaign' : battle.mode === 'raid' ? 'raid' : 'endless'); });
}

$('home').addEventListener('click', () => navigateTown());
$('retreat').addEventListener('click', () => navigateTown());
$('battle-home').addEventListener('click', () => navigateTown());
$('battle-info-toggle').addEventListener('click', () => {
  const toggle = $('battle-info-toggle');
  const panel = $('battle-info-panel');
  const expanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!expanded));
  panel.hidden = expanded;
  toggle.querySelector('span')!.textContent = expanded ? '＋' : '−';
});
document.querySelectorAll<HTMLElement>('[data-view]').forEach(el => el.addEventListener('click', () => navigateTown(el.dataset.view as TownTab)));
$('start').addEventListener('click', begin);
$('pause').addEventListener('click', pauseMenu);
$('howto').addEventListener('click', help);
$('help-shortcut').addEventListener('click', help);
$('settings').addEventListener('click', settings);
$('sound').addEventListener('click', () => { profile.sound = !profile.sound; updateSound(); });
$('guard').addEventListener('click', () => battle.guard());
$('potion').addEventListener('click', () => battle.potion());
$('ultimate').addEventListener('click', () => battle.ultimate());
document.querySelectorAll<HTMLElement>('[data-lane]').forEach(el => el.addEventListener('click', () => {
  const lane = Number(el.dataset.lane);
  battle.targetLane = battle.targetLane === lane ? -1 : lane;
  document.querySelectorAll<HTMLElement>('[data-lane]').forEach(button => { const active = Number(button.dataset.lane) === battle.targetLane; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
}));
window.addEventListener('keydown', e => {
  if (e.repeat || (e.target as HTMLElement).matches('input,textarea,select,[contenteditable="true"]')) return;
  if (modal.open) { if (modal.dataset.result === 'true' && !resultGate.allows(performance.now(), resultGeneration)) { e.preventDefault(); return; } if (e.code === 'Escape') { e.preventDefault(); modal.close(); } return; }
  if (inTown) return;
  const controlFocused = (e.target as HTMLElement).closest('button,a');
  if (e.code === 'Space' && !controlFocused) { e.preventDefault(); pauseMenu(); }
  if (e.code === 'Enter' && !controlFocused && battle.status === 'ready') begin();
  if (e.code === 'KeyH') battle.potion();
  if (e.code === 'KeyG') battle.guard();
  if (e.code === 'KeyR') battle.ultimate();
  if (e.code === 'Escape') { moveMode = false; renderInspector(); }
  if (/^Digit[1-9]$/.test(e.code)) { const h = battle.heroes.find(h => h.slot === Number(e.code.slice(-1)) - 1); if (h) { sound.unlock(); tapHero(h.id); } }
  if (e.code === 'KeyQ' || e.code === 'KeyE') cycleSkill(battle.selected, e.code === 'KeyE' ? 1 : -1);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !inTown && battle.status === 'fighting') pauseMenu(); });
scene = new BattleScene(battle, sound, frame);
scene.reducedMotion = !profile.motion;
document.body.classList.toggle('reduced-motion', !profile.motion);
new Phaser.Game({ type: Phaser.AUTO, parent: 'game-canvas', width: ARENA.width, height: ARENA.height, backgroundColor: '#152d2c', pixelArt: true, roundPixels: true, antialias: false, scene: [scene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 3 }, audio: { noAudio: true }, render: { preserveDrawingBuffer: true }, banner: false });
initialized = true;
showTown();
if (import.meta.env.DEV) Object.assign(window, { gridbound: {
  snapshot: () => battle.snapshot(), profile: () => structuredClone(profile),
  get battle() { return battle; }, get inTown() { return inTown; },
  step: (seconds: number) => { for (let t = 0; t < Math.min(600, Math.max(0, seconds)); t += 1 / 60) battle.tick(1 / 60); frame(1); },
  boot, scene,
} });
