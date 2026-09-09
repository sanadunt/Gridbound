import Phaser from 'phaser';
import gsap from 'gsap';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import './style.css';
import { currencyAmount } from './ui/currency';

import './town.css';
import './rpg.css';
import './progression.css';
import './paged-town.css';
import './compact-combat.css';
import './currency.css';
import './talent-ui.css';
import './title-screen.css';
import './boon-draft.css';
import './combat-hud.css';
import './result-ceremony.css';
import './archives-ui.css';
import './pact-ui.css';
import './world-map.css';
import { Battle, type BattleEvent, type BattleOptions } from './game/simulation';
import { KITS, ROSTER, type Mode } from './game/content';
import { CAMPAIGN, BOONS, boonChoices } from './game/world';
import { promote, equipGear, buyTalent, equipSkill, respecHero, moveFormation, completeZone, profileModifiers, canEnterZone, settleProgress, claimQuest, syncProfileEconomy, buyChallengeUnlock } from './game/profile';
import { renderTown, portrait, type TownState, type TownTab } from './ui/town';
import { BattleScene, ARENA, cell } from './render/BattleScene';
import { ResultGate, RESULT_INPUT_DELAY_MS, type ResultGateGeneration } from './ui/result-gate';
import { Sound } from './audio/sound';
import { loadSave, saveProfile } from './game/save';
import { createProfile } from './game/profile';
import { CommanderSession } from './game/commander-session';
import { copyLegacyToCommander, createCommanderDocument, createRunCheckpoint, terminalRun, storedStateFor, type CommanderDocument, type CommanderMode, type SlotId } from './game/commander';
import { storyBattleOptions, setStoryParty } from './game/story-party';
import { createRogueBuild, setRogueJobs, rogueUpgrades } from './game/roguelike-build';
import { createRaidBuild, setRaidJob, setRaidPartySize, normalizeRaidBuild } from './game/raid-build';
import { QUESTS, questProgress } from './game/quests';
import { CHALLENGE_SHOP, createRunWallet, creditRun, resetRunWallet, getRaidContractForEnemy, roguelikeMilestoneForFloor, buyRunItem, type RaidModifierId, type RaidSandbox, type RaidTier, type RunWallet } from './economy/challenge';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const store = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
const saved=loadSave(store);
let profile = saved.profile;
const commander = new CommanderSession();
let encounter: NonNullable<CommanderDocument['encounters']>[CommanderMode];
let pendingSettlement = false;
if (matchMedia('(prefers-reduced-motion: reduce)').matches) profile.motion = false;
let storageFailed = false;
function updateTitleStatus() {
  const nameEl = $('title-commander-name');
  if (!nameEl) return;
  const name = commander.document?.name || 'Recruit';
  const mode = commander.mode === 'story' ? 'Story' : commander.mode === 'raid' ? 'Raid' : 'Roguelike';
  nameEl.textContent = `${name} · ${mode}`;
}
function showTitleScreen(animated = true) {
  const titleScreen = $('title-screen');
  if (!titleScreen) return;
  updateTitleStatus();
  titleScreen.classList.remove('dismissing');
  titleScreen.hidden = false;
  if (animated && profile.motion) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.fromTo('.title-brand', { opacity: 0, y: -20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.45 })
      .fromTo('.title-flourish', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'power3.out' }, '-=0.2')
      .fromTo('.title-menu-item', { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.07, duration: 0.35, clearProps: 'transform' }, '-=0.15')
      .fromTo('.title-footer', { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'all' }, '-=0.2');
  }
}
function animateTownEntrance() {
  if (!profile.motion) return;
  const town = $('town-screen');
  if (!town || town.hidden) return;
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  tl.fromTo('.town-panorama', { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.3, clearProps: 'all' })
    .fromTo('.town-caption', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, clearProps: 'all' }, '-=0.15')
    .fromTo('.facility-tabs button', { opacity: 0, y: -8 }, { opacity: 1, y: 0, stagger: 0.03, duration: 0.2, ease: 'back.out(1.4)', clearProps: 'all' }, '-=0.15')
    .fromTo('.town-hero', { opacity: 0, x: -12 }, { opacity: 1, x: 0, stagger: 0.02, duration: 0.22, clearProps: 'all' }, '-=0.15')
    .fromTo('.facility-panel-wrap', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.22, clearProps: 'all' }, '-=0.12');
}
function enterEmberhollow() {
  const titleScreen = $('title-screen');
  if (!titleScreen || titleScreen.hidden) return;
  sound.unlock();
  if (profile.motion) {
    const tl = gsap.timeline({
      onComplete: () => {
        titleScreen.hidden = true;
        titleScreen.classList.remove('dismissing');
        gsap.set([titleScreen, '.title-menu-item'], { clearProps: 'all' });
        animateTownEntrance();
      }
    });
    tl.to('#title-enter', { scale: 1.04, borderColor: '#fff', duration: 0.12, yoyo: true, repeat: 1 })
      .to('.title-menu-item:not(#title-enter)', { opacity: 0, y: 10, stagger: 0.04, duration: 0.2 }, 0.1)
      .to(titleScreen, { opacity: 0, scale: 1.02, duration: 0.25, ease: 'power2.in' }, 0.18);
  } else {
    titleScreen.classList.add('dismissing');
    setTimeout(() => {
      titleScreen.hidden = true;
      titleScreen.classList.remove('dismissing');
    }, 250);
  }
}
function storageStatus() {
  $('wallet').innerHTML = currencyAmount('gold', profile.gold);
  $('bank-wallet').innerHTML = currencyAmount('crystal', profile.economy.commanderCrystal);
  $('storage-status').textContent = saved.readOnly ? saved.warning : (commander.error || (!commander.document ? 'Choose or create a Commander. Legacy saves are read-only.' : commander.busy ? 'Saving Commander…' : commander.dirty ? 'Unsaved changes. Retry or export before leaving.' : commander.repository?.persistent ? `Commander revision ${commander.document.revision} · local IndexedDB` : 'Session-only: export before closing this tab.'));
  updateTitleStatus();
}
function context(slotId: SlotId = 'auto') {
  return { mode: commander.mode, slotId, profile, rogueBuild: townState.rogueSetup, raidBuild: townState.raidBuild, raidContract: getRaidContractForEnemy(townState.raid,townState.raidTier,townState.raidModifiers), raidSandbox: townState.raidSandbox };
}
function persist(slotId: SlotId = 'auto', edit?: (document: CommanderDocument) => void) {
  if (saved.readOnly) { storageStatus(); return Promise.resolve(false); }
  if (pendingSettlement && !edit) return Promise.resolve(false);
  syncProfileEconomy(profile);
  try { saveProfile(store, profile, saved.readOnly); storageFailed = false; } catch { storageFailed = true; }
  if (!commander.document) { storageStatus(); return Promise.resolve(false); }
  return commander.save(context(slotId), edit).then(ok => { storageFailed = !ok; return ok; });
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
  tab: 'campaign', hero: 0, zone: Math.min(profile.cleared.length, CAMPAIGN.length - 1), raid: 'golem', raidTier: 'bronze', raidModifiers: [], raidBuild: createRaidBuild(profile.roster, Math.min(3, profile.roster.length, 6)), notice: '',
  trainingTab: 'talents', campaignPage: 0, questPage: 0, bestiaryPage: 0,
};

$('app').innerHTML = `
<section id="title-screen" class="title-screen" hidden>
  <div class="title-backdrop" aria-hidden="true">
    <div class="title-vignette"></div>
    <div class="title-crest-glow"></div>
    <div class="title-embers">
      <span class="title-ember"></span>
      <span class="title-ember"></span>
      <span class="title-ember"></span>
      <span class="title-ember"></span>
      <span class="title-ember"></span>
      <span class="title-ember"></span>
      <span class="title-ember"></span>
      <span class="title-ember"></span>
    </div>
  </div>
  <div class="title-content">
    <div class="title-brand">
      <span class="title-eyebrow">A Tactical Roguelike RPG</span>
      <h1 class="title-logo">GRIDBOUND</h1>
      <div class="title-subtitle-wrap">
        <span class="title-flourish"></span>
        <span>ASHES OF THE BELL</span>
        <span class="title-flourish right"></span>
      </div>
    </div>
    <nav class="title-menu" aria-label="Main Menu">
      <button id="title-enter" class="title-menu-item primary" type="button">
        <span class="menu-title">
          <span class="menu-bullet" aria-hidden="true">◆</span>
          ENTER EMBERHOLLOW
          <span class="menu-bullet" aria-hidden="true">◆</span>
        </span>
        <span class="menu-subtext">Return to town &amp; prepare for expeditions</span>
      </button>
      <button id="title-profiles" class="title-menu-item" type="button">
        <span class="menu-title">
          <span class="menu-bullet" aria-hidden="true">◆</span>
          COMMANDER PROFILES
          <span class="menu-bullet" aria-hidden="true">◆</span>
        </span>
        <span class="menu-subtext">Switch commander or manage save slots</span>
      </button>
      <button id="title-journal" class="title-menu-item" type="button">
        <span class="menu-title">
          <span class="menu-bullet" aria-hidden="true">◆</span>
          STORY JOURNAL
          <span class="menu-bullet" aria-hidden="true">◆</span>
        </span>
        <span class="menu-subtext">Chronicle of choices, memories &amp; epilogues</span>
      </button>
      <button id="title-settings" class="title-menu-item" type="button">
        <span class="menu-title">
          <span class="menu-bullet" aria-hidden="true">◆</span>
          CAMP SETTINGS
          <span class="menu-bullet" aria-hidden="true">◆</span>
        </span>
        <span class="menu-subtext">Audio, visuals &amp; accessibility preferences</span>
      </button>
    </nav>
  </div>
  <footer class="title-footer">
    <div class="title-active-commander" id="title-commander-status">
      <b>ACTIVE:</b> <span id="title-commander-name">Recruit</span>
    </div>
    <div class="title-meta-info">
      <span>GRIDBOUND v3.1</span>
      <span>•</span>
      <span>HTML5 / PHASER CANVAS</span>
    </div>
  </footer>
</section>
<header class="site-header"><button class="brand" id="home" aria-label="Pulang ke Emberhollow"><span class="brand-mark" aria-hidden="true">${'<i></i>'.repeat(9)}</span><span>GRIDBOUND<small>ASHES OF THE BELL</small></span></button>
  <nav class="mode-tabs" aria-label="Mode permainan"><button data-view="campaign" class="active">Town & story</button><button data-view="raid">Raid hunts</button><button data-view="endless">Roguelike</button></nav>
  <div class="header-tools"><button id="profiles" class="secondary-button">Profiles / slots</button><b id="wallet" class="wallet">${currencyAmount('gold', profile.gold)}</b><b id="bank-wallet" class="wallet bank-wallet">${currencyAmount('crystal', profile.economy.commanderCrystal)}</b><button id="sound" class="icon-button" aria-label="Toggle audio" aria-pressed="${profile.sound}">♫</button><button id="settings" class="icon-button" aria-label="Settings">⚙</button></div>
</header>
  <main id="town-screen" class="town-screen"></main>
  <main id="battle-screen" class="game-layout" hidden>
    <aside class="left-sidebar"><span class="eyebrow" id="expedition-label">EXPEDITION</span><h1 id="journey-title">Beyond<br>the bell.</h1><p class="intro-copy" id="journey-copy"></p><ol id="stage-list" class="expedition-stages"></ol>
      <section class="field-guide"><div class="section-label">READ. REACT. SURVIVE.</div><p>Tap hero untuk mengisi skill lebih cepat. Ganti fokus saat fatigue naik.</p><p>Ground: pindah tile. Marked: lindungi hero yang diincar. All-grid: Guard atau interrupt.</p><button id="howto" class="secondary-button">Field guide</button></section>
      <section class="run-boons"><h3>Run boons</h3><div id="boon-list"></div></section><section class="run-shop-panel"><h3>Journey shop</h3><div id="run-shop-host"></div><small>Journey Crystal resets on abandon, defeat, or clear. It never enters the bank.</small></section><button id="retreat" class="secondary-button">Pulang ke town</button>
    </aside>
    <section class="arena-column" aria-label="Arena pertarungan">
      <div class="arena-heading">
        <span><b id="mode-label"></b><span id="encounter-label"></span></span>
        <div class="arena-heading-controls">
          <button id="combat-boons" class="icon-button combat-boons-btn" aria-label="Boon codex" title="Active boons [B]">✦<span id="boon-count-badge" class="boon-count-badge" style="display:none">0</span></button>
          <button id="pause" class="icon-button" aria-label="Jeda permainan">Ⅱ</button>
        </div>
      </div>
      <div id="arena" class="arena"><div id="game-canvas"></div>
        <div class="boss-hud"><div class="boss-crest-corner tl"></div><div class="boss-crest-corner tr"></div><div class="boss-crest-corner bl"></div><div class="boss-crest-corner br"></div><div class="boss-hud-inner"><div class="boss-caption"><span class="boss-title-prefix">✦ ADVERSARY ✦</span><span id="boss-title"></span><span id="phase" class="boss-phase-badge"></span></div><div class="boss-title"><h2 id="boss-name"></h2><span id="boss-health"></span></div><div class="boss-meter"><div id="boss-hp-ghost" class="boss-hp-ghost"></div><div id="boss-hp"></div><div class="boss-phase-notch p1"></div><div class="boss-phase-notch p2"></div></div><div class="stagger-row"><span id="stagger-label">ARMOR</span><div class="stagger-track"><i id="stagger"></i></div><span id="clock">00:00</span></div></div></div>
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

function showTown(tab: TownTab = townState.tab, notice = '', animate = false) {
  const nextMode: CommanderMode = tab === 'raid' ? 'raid' : tab === 'endless' ? 'roguelike' : 'story';
  if (commander.document && nextMode !== commander.mode) {
    commander.mode = nextMode;
    commander.document.activeMode = nextMode;
    void persist();
  }
  inTown = true;
  if (battle.status === 'fighting') battle.pause();
  townState.tab = tab;
  townState.notice = notice;
  $('town-screen').hidden = false;
  $('battle-screen').hidden = true;
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === (['party', 'bestiary', 'quests'].includes(tab) ? 'campaign' : tab)));
  renderTown($('town-screen'), profile, townState);
  persist();
  if (animate && profile.motion) {
    const panel = document.querySelector<HTMLElement>('.facility-panel-wrap');
    if (panel) {
      gsap.fromTo(panel, { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.28, ease: 'power2.out', clearProps: 'all' });
      if (tab === 'party') {
        animateMirrorTalents();
      } else if (tab === 'bestiary') {
        animateCodexEntry();
      } else if (tab === 'quests') {
        animateProphecies();
      } else if (tab === 'challenge-shop') {
        animateChallengeShop();
      } else if (tab === 'raid') {
        animatePactRaid();
      } else if (tab === 'endless') {
        animateSunkenDescent();
      }
    }
  }
}
$('town-screen').addEventListener('click', event => {
  if (modal.open) modal.close();
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled || !inTown || commander.stale || pendingSettlement) return;
  sound.unlock();
  if (button.dataset.storyToggle !== undefined) {
    const id=Number(button.dataset.storyToggle);
    const ids=profile.storyActive.includes(id)?profile.storyActive.filter(hero=>hero!==id):[...profile.storyActive,id];
    const ok=setStoryParty(profile,ids);
    showTown('party',ok?'Story party disimpan. Semua loadout tetap tersimpan.':'Pilih minimal 1 hero dan jangan melebihi cap Story.', true);
    return;
  }
  if (button.dataset.facility) {
    townState.pendingGear = undefined;
    showTown(button.dataset.facility as TownTab, '', true);
  }
  if (button.dataset.talent) {
    const ok = buyTalent(profile, townState.hero, button.dataset.talent);
    showTown('party', ok ? 'Talent dipelajari. Efek akan dibawa ke expedition berikutnya.' : 'Talent belum tersedia atau gold tidak cukup.', true);
    return;
  }
  if (button.dataset.inspectTalent) {
    townState.selectedTalent = button.dataset.inspectTalent;
    showTown('party');
    return;
  }
  if (button.dataset.branch) { townState.talentBranch = button.dataset.branch; townState.selectedTalent = undefined; showTown('party', '', true); return; }
  if (button.dataset.trainingTab) {
    townState.trainingTab = button.dataset.trainingTab as TownState['trainingTab'];
    showTown('party', '', true);
  }
  if (button.dataset.campaignPage) {
    const delta = Number(button.dataset.campaignPage);
    townState.zone = Math.max(0, Math.min(CAMPAIGN.length - 1, townState.zone + delta));
    townState.campaignPage = townState.zone;
    sound.clink();
    showTown('campaign', '', true);
    return;
  }
  if (button.dataset.questPage) {
    townState.questPage = Math.max(0, townState.questPage + Number(button.dataset.questPage));
    showTown('quests', '', true);
    animateProphecies();
  }
  if (button.dataset.bestiaryPage) {
    townState.bestiaryPage = Math.max(0, townState.bestiaryPage + Number(button.dataset.bestiaryPage));
    showTown('bestiary', '', true);
    animateCodexEntry();
  }
  if (button.dataset.townHero) {
    townState.hero = Number(button.dataset.townHero);
    townState.pendingGear = undefined;
    showTown('party', '', true);
    if (profile.motion) {
      const heroBtn = document.querySelector<HTMLElement>(`[data-town-hero="${townState.hero}"]`);
      if (heroBtn) gsap.fromTo(heroBtn, { scale: 0.93 }, { scale: 1, duration: 0.22, ease: 'back.out(2)', clearProps: 'transform' });
    }
  }
  if (button.dataset.act !== undefined) {
    const actId = Number(button.dataset.act);
    const startZone = actId * 4;
    const actZones = [startZone, startZone + 1, startZone + 2, startZone + 3];
    const target = actZones.find(z => !profile.cleared.includes(z)) ?? startZone;
    townState.zone = target;
    townState.campaignPage = target;
    sound.clink();
    showTown('campaign', '', true);
    return;
  }
  if (button.dataset.zone) {
    townState.zone = Number(button.dataset.zone);
    townState.campaignPage = townState.zone;
    sound.clink();
    showTown('campaign', '', true);
    if (profile.motion) {
      const pin = document.querySelector<HTMLElement>(`[data-zone="${townState.zone}"]`);
      if (pin) gsap.fromTo(pin, { scale: 0.9 }, { scale: 1.18, duration: 0.22, ease: 'back.out(2)' });
    }
    return;
  }
  if (button.dataset.raid) { townState.raid = button.dataset.raid; townState.raidSandbox = undefined; showTown('raid', '', true); return; }
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

  if (button.dataset.formation) {
    moveFormation(profile, townState.hero, Number(button.dataset.formation));
    showTown('party', 'Formasi disimpan.');
  }
  if (button.hasAttribute('data-respec')) {
    respecHero(profile, townState.hero);
    showTown('party', 'Talent direset, gold dikembalikan. Dua skill dasar dipasang kembali.');
  }
  if(button.dataset.claimQuest){
    const questId = button.dataset.claimQuest;
    const q=QUESTS.find(q=>q.id===questId);
    const ok=claimQuest(profile,questId,townState.hero);
    showTown('quests',ok?`Reward diterima ${ROSTER[q?.heroId??townState.hero].name}. Equipment hadiah masuk inventory; pasang di Training hall.`:'Quest belum selesai atau sudah diklaim.', true);
    if (ok && profile.motion) {
      const entry = document.querySelector<HTMLElement>(`[data-quest="${questId}"]`);
      if (entry) gsap.fromTo(entry, { scale: 0.96, filter: 'brightness(1.5)' }, { scale: 1, filter: 'brightness(1)', duration: 0.35, ease: 'back.out(2)', clearProps: 'transform,filter' });
    }
  }
  if(button.dataset.trackQuest){const q=QUESTS.find(q=>q.id===button.dataset.trackQuest);if(q&&questProgress(profile,q).unlocked){profile.trackedQuest=q.id;showTown('quests','Quest ditandai. Progress dihitung dari kemenangan yang sudah dibank.');}}
  if(button.dataset.questHunt){townState.raid=button.dataset.questHunt;townState.raidSandbox=undefined;navigateTown('raid');}
  if (button.dataset.depart) {
    depart(button.dataset.depart as Mode);
  }
});
$('town-screen').addEventListener('change', event => {
  const el = event.target as HTMLSelectElement;
  if (!inTown || commander.stale || pendingSettlement) return;
  if(el.matches('[data-quest-filter]')){townState.questPage=0;townState.questFilter=el.value as 'available'|'all'|'claimed';showTown('quests');return;}
  if(el.matches('[data-quest-recipient]')){townState.hero=Number(el.value);showTown('quests');return;}
  if(el.matches('[data-rogue-slot]')){
    const build=townState.rogueSetup??createRogueBuild();
    const jobs=build.recruits.map(r=>r.classId);
    const slot=Number(el.dataset.rogueSlot);
    if(Number.isInteger(slot)&&slot>=0&&slot<3){jobs[slot]=el.value as never;if(setRogueJobs(build,jobs))townState.rogueSetup=build;}
    showTown('endless');return;
  }
  if(el.matches('[data-raid-variant]')){townState.raid=el.value;townState.raidSandbox=undefined;showTown('raid');return;}
  if(el.matches('[data-raid-tier]')){
    townState.raidTier=el.value as RaidTier;
    const certified=getRaidContractForEnemy(townState.raid,townState.raidTier,townState.raidModifiers);
    const sandbox=townState.raidSandbox;
    const neutral=!sandbox||([sandbox.hpScale,sandbox.damageScale,sandbox.intervalScale].every(value=>value===1));
    townState.raidSandbox=certified&&neutral?undefined:sandbox??{hpScale:1,damageScale:1,intervalScale:1};
    showTown('raid');return;
  }
  if(el.matches('[data-raid-modifier]')){
    const input=el as unknown as HTMLInputElement;
    const id=input.dataset.raidModifier as RaidModifierId;
    townState.raidModifiers=input.checked?[...townState.raidModifiers,id]:townState.raidModifiers.filter(value=>value!==id);
    const certified=getRaidContractForEnemy(townState.raid,townState.raidTier,townState.raidModifiers);
    const sandbox=townState.raidSandbox;
    const neutral=!sandbox||([sandbox.hpScale,sandbox.damageScale,sandbox.intervalScale].every(value=>value===1));
    townState.raidSandbox=certified&&neutral?undefined:sandbox??{hpScale:1,damageScale:1,intervalScale:1};
    showTown('raid');return;
  }
  if(el.matches('[data-raid-party-size]')){
    const build=(townState.raidBuild&&normalizeRaidBuild(townState.raidBuild,profile.roster))??createRaidBuild(profile.roster,Math.min(3,profile.roster.length,6));
    const ok=setRaidPartySize(build,Number(el.value),profile.roster);
    if(ok)townState.raidBuild=build;
    showTown('raid',ok?'Raid party disimpan. Story loadout tidak berubah.':'Raid party harus berisi 1–6 hero yang sudah direkrut.');return;
  }
  if(el.matches('[data-raid-job]')){
    const build=(townState.raidBuild&&normalizeRaidBuild(townState.raidBuild,profile.roster))??createRaidBuild(profile.roster,Math.min(3,profile.roster.length,6));
    const ok=setRaidJob(build,Number(el.dataset.raidJob),el.value);
    if(ok)townState.raidBuild=build;
    showTown('raid',ok?'Raid job disimpan sebagai build sementara.':'Job Raid tidak valid.');return;
  }
  if(el.matches('[data-raid-sandbox]')){
    const input=el as unknown as HTMLInputElement;
    const key=input.dataset.raidSandbox as keyof RaidSandbox;
    const current=townState.raidSandbox??{hpScale:1,damageScale:1,intervalScale:1};
    townState.raidSandbox={...current,[key]:Number(input.value)};
    showTown('raid','Practice slider aktif: run ini Sandbox dan tidak membayar Crystal.');return;
  }
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

let ensureCommanderPromise: Promise<CommanderDocument | undefined> | undefined;
async function ensureCommander() {
  if (commander.document) return commander.document;
  if (ensureCommanderPromise) return ensureCommanderPromise;
  ensureCommanderPromise = (async () => {
    try {
      const docs = (await commander.open()).sort((a, b) => b.lastPlayed - a.lastPlayed);
      if (docs.length > 0) {
        if (!commander.document) activateCommander(docs[0]);
        return commander.document;
      }
    } catch { /* storage fallback */ } finally {
      ensureCommanderPromise = undefined;
    }
    return undefined;
  })();
  return ensureCommanderPromise;
}

function depart(mode: Mode) {
  commander.mode = mode === 'raid' ? 'raid' : mode === 'endless' ? 'roguelike' : 'story';
  if (commander.document) commander.document.activeMode = commander.mode;
  if (mode === 'adventure' && !canEnterZone(profile, townState.zone)) return;
  const existing = commander.document?.encounters?.[commander.mode];
  if (existing && !existing.settled) { restoreEncounter(existing); return; }
  runBoons = [];
  resetRunWallet(runWallet);
  runWallet = createRunWallet();
  runSeed = Date.now() % 1000000;
  boot(mode, mode === 'adventure' ? townState.zone + 1 : mode === 'raid' ? profile.cleared.length+1 : 1, mode === 'endless' ? { rogueBuild: structuredClone(townState.rogueSetup ?? createRogueBuild()) } : {});
  void ensureCommander().then(() => {
    if (commander.document) {
      commander.document.activeMode = commander.mode;
      if (!commander.stale && battle.status === 'ready') void checkpoint();
    }
  });
}
function boot(mode: Mode = 'adventure', floor = 1, options: Partial<BattleOptions> = {}) {
  const commanderMode: CommanderMode = mode === 'raid' ? 'raid' : mode === 'endless' ? 'roguelike' : 'story';
  if (commander.document && commander.mode !== commanderMode) {
    activateCommander(commander.document, commanderMode);
  }
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
    ...(mode === 'raid' ? {
      enemyId: townState.raid,
      raidContract: getRaidContractForEnemy(townState.raid, townState.raidTier, townState.raidModifiers),
      raidBuild: structuredClone(townState.raidBuild),
      raidSandbox: townState.raidSandbox ? structuredClone(townState.raidSandbox) : undefined,
    } : {}),
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
  const boonBadge = $('boon-count-badge');
  if (boonBadge) {
    boonBadge.textContent = String(runBoons.length);
    boonBadge.style.display = runBoons.length > 0 ? 'inline-block' : 'none';
  }
}
function showReady() {
  $('start-overlay').hidden = false;
  $('ready-label').textContent = battle.stageName;
  $('ready-title').textContent = battle.stage > 0 ? 'Keep the ember alive.' : 'Ready, Bellkeepers?';
  $('ready-copy').textContent = battle.mode==='adventure' ? (CAMPAIGN[battle.floor-1].stages[battle.stage].beat??(battle.stage===0?CAMPAIGN[battle.floor-1].intro:'Jalur berikutnya terbuka. HP dan potion dibawa; siapkan stance dan baca intent sebelum menyerang.')) : battle.stage > 0 ? 'HP dan potion tersisa dibawa ke wave ini. Periksa stance sebelum lanjut.' : 'Skill dan formasi sudah siap. Tap mempercepat; strategi menjaga party tetap hidup.';
  $('start').textContent = 'Begin encounter';
}
async function begin() {
  if (inTown) return;
  if (commander.stale || pendingSettlement) return;
  if (['victory', 'defeat'].includes(battle.status)) { result(); return; }
  encounter = makeEncounter();
  sound.unlock();
  battle.start();
  $('start-overlay').hidden = true;
  addLog('Pertarungan dimulai. Perhatikan intent musuh.');
  void ensureCommander().then(() => commander.flush()).then(() => checkpoint(true));
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
  const hpPercent = `${battle.bossHp / battle.bossMax * 100}%`;
  $('boss-hp').style.width = hpPercent;
  const ghost = document.getElementById('boss-hp-ghost');
  if (ghost) ghost.style.width = hpPercent;
  $('phase').textContent = `PHASE ${battle.phase} / 3`;
  $('stagger').style.width = `${battle.breakLeft > 0 ? battle.breakLeft / 6 * 100 : battle.stagger / 800 * 100}%`;
  $('stagger-label').textContent = battle.breakLeft > 0 ? 'BREAK' : 'ARMOR';
  $('clock').textContent = formatTime(battle.time);
  const threat = [...battle.threats].sort((a, b) => a.left - b.left)[0];
  const isDanger = Boolean(threat);
  const wasDanger = $('intent').classList.contains('danger');
  $('intent').classList.toggle('danger', isDanger);
  if (isDanger && !wasDanger && profile.motion) {
    gsap.fromTo('#intent', { scale: 1.025 }, { scale: 1, duration: 0.25, ease: 'back.out(2)', clearProps: 'transform' });
  }
  $('intent').querySelector('b')!.textContent = threat ? `${threat.name} · ${Math.max(0, threat.left).toFixed(1)}s${threat.targetId !== undefined ? ` · ${battle.hero(threat.targetId)?.name ?? 'MARKED'}` : ''}` : battle.guardLeft > 0 ? `PARTY GUARD · ${battle.guardLeft.toFixed(1)}s` : 'Watch the next move.';
  $('intent').querySelector('span')!.textContent = threat ? `${threat.counter ?? 'Pindahkan hero dari tile yang ditandai.'}${battle.threats.length > 1 ? ` (+${battle.threats.length - 1} intent lain)` : ''}` : 'Ground: move. Marked: protect. All-grid: Guard / interrupt.';
  $('damage').textContent = Math.round(battle.damage).toLocaleString();
  $('blocked').textContent = Math.round(battle.blocked).toLocaleString();
  $('loot').textContent = battle.mode === 'endless' ? `${runWallet.crystal} RUN` : battle.mode === 'raid' ? `${battle.raidContract?.sandbox ? 'PRACTICE' : battle.raidContract?.tier.toUpperCase() ?? 'PRACTICE'}` : `${battle.gold}g`;
  $('standing').textContent = `${battle.living().length} / ${battle.heroes.length} STANDING`;
  $('move-tip').textContent = moveMode ? 'CHOOSE A DESTINATION' : 'DRAG TO REPOSITION';
  $('resolve-fill').style.width = `${battle.resolve}%`;
  $('resolve-label').textContent = battle.resolve >= 100 ? 'R · READY' : `R · ${Math.floor(battle.resolve)}% RESOLVE`;
  const ultReady = battle.resolve >= 100 && battle.status === 'fighting';
  $<HTMLButtonElement>('ultimate').disabled = !ultReady;
  $('ultimate').classList.toggle('ready', ultReady);
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
  modal.scrollTop = 0;
  if (!alreadyOpen) {
    try { modal.showModal(); } catch { modal.show(); }
    sound.modalReveal();
    if (profile.motion) {
      gsap.fromTo(modal, { opacity: 0, scale: 0.94, y: -10 }, { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'back.out(1.2)', clearProps: 'transform' });
      if (!modal.querySelector('.result-ceremony-modal') && !modal.querySelector('.boon-draft-modal')) {
        const targets = modal.querySelectorAll('h2, .help-rows p, .setting-row, section, .gold-button, .secondary-button');
        if (targets.length) {
          gsap.fromTo(targets, { opacity: 0, y: 8 }, { opacity: 1, y: 0, stagger: 0.03, duration: 0.2, ease: 'power2.out', clearProps: 'opacity,transform' });
        }
      }
    }
  }
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.close()));
}
modal.addEventListener('close', () => { if (resumeOnClose && !inTown && battle.status === 'paused') battle.pause(); resumeOnClose = false; clearResultState(); });
function closeWithoutResume() { resumeOnClose = false; clearResultState(); if (modal.open) modal.close(); }
function help() {
  openModal(`<span class="eyebrow">COMMANDER'S FIELD GUIDE</span><h2 id="modal-title">Every intent has an answer.</h2><div class="help-rows"><p><b>Tap / angka 1–9</b><br>Percepat cooldown hero di tile tersebut. Berganti fokus saat fatigue naik. Dua pointer didukung; drag tidak dihitung sebagai tap.</p><p><b>Skill / Q dan E</b><br>Ganti antara dua skill yang dipasang di town. Persentase cooldown dipertahankan, bukan direset.</p><p><b>Drag / Pindahkan karakter</b><br>Keluar dari ground AoE. Relokasi menambah cooldown 0,9 detik. Serangan marked tetap mengikuti hero: gunakan shield, heal, atau Guard.</p><p><b>Party Guard / G</b><br>Mitigasi seluruh party untuk window singkat. Tekan menjelang all-grid impact, jangan terlalu dini. Skill interrupt dapat membatalkan ritual.</p><p><b>Mending mist / H · Ninefold Dawn / R</b><br>Potion terbatas per expedition. Resolve mengisi serangan party. Jangan menunggu healer tumbang.</p><p><b>Lane I, II, III</b><br>Arahkan ranged skill ke minion. Klik lane yang sama lagi untuk kembali ke boss.</p></div><button class="gold-button" data-close>Kembali memimpin</button>`);
}
function settings() {
  openModal(`<span class="eyebrow">CAMP SETTINGS</span><h2 id="modal-title">Your kind of adventure.</h2><label class="setting-row"><span><b>Suara & musik</b><small>Chiptune dan feedback skill.</small></span><input id="setting-sound" type="checkbox" ${profile.sound ? 'checked' : ''}></label><label class="setting-row"><span><b>Full motion & particles</b><small>Matikan untuk mengurangi gerakan dan screen shake.</small></span><input id="setting-motion" type="checkbox" ${profile.motion ? 'checked' : ''}></label><p>Save v3 menyimpan XP tiap hero, quest, talent, inventory dan formasi. Save v2 lama tetap utuh untuk rollback. Pertarungan berjalan tidak disimpan.</p><button id="export-save" class="secondary-button">Download backup save JSON</button><button class="gold-button" data-close>Kembali</button>`);
  $('export-save').addEventListener('click',exportCommander);
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
  $('pause-retreat').addEventListener('click', () => navigateTown());
}
const escapeUI = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
function showBoonTray() {
  if (inTown) return;
  if (modal.open) {
    if (modal.querySelector('.boon-tray-modal')) {
      modal.close();
      return;
    }
  }
  sound.cardDeal();

  const activeBoonIds = (runBoons.length > 0 ? runBoons : battle.boons) ?? [];
  const boons = activeBoonIds.map(id => BOONS.find(b => b.id === id)).filter(Boolean) as typeof BOONS;
  const isEndless = battle.mode === 'endless';
  const isRaid = battle.mode === 'raid';

  const modeBadge = isEndless
    ? `THE SUNKEN BELL · FLOOR ${battle.floor}`
    : isRaid
    ? `RAID CONTRACT · ${battle.raidContract?.tier.toUpperCase() ?? 'PRACTICE'}`
    : `STORY EXPEDITION · ${battle.stageName || 'ENCOUNTER'}`;

  const boonsListHtml = boons.length > 0
    ? `<div class="boon-tray-list">
        ${boons.map((b, i) => `
          <div class="boon-tray-card" style="animation-delay: ${i * 0.04}s">
            <div class="boon-tray-card-top">
              <span class="boon-patron-badge">✦ ${escapeUI(b.patron)}</span>
              <span class="boon-id-badge">#${escapeUI(b.id)}</span>
            </div>
            <h3 class="boon-name">${escapeUI(b.name)}</h3>
            <p class="boon-desc">${escapeUI(b.description)}</p>
          </div>
        `).join('')}
      </div>`
    : `<div class="boon-tray-empty">
        <div class="empty-sigil">✦</div>
        <p>No boons drafted yet in this expedition.</p>
        <small>Claim Olympian & Underworld boons at floor thresholds, draft chambers, or the journey peddler.</small>
      </div>`;

  const raidModifiers = battle.raidContract?.modifiers?.length ?? 0;
  const pactHeatHtml = raidModifiers > 0
    ? `<div class="boon-tray-pact-badge"><span class="heat-flame">🔥</span> Pact Heat +${raidModifiers}</div>`
    : '';

  const content = `
    <div class="boon-tray-modal">
      <div class="boon-tray-header">
        <div class="boon-tray-eyebrow">✦ UNDERWORLD CODEX · ACTIVE BLESSINGS ✦</div>
        <h2 id="modal-title">Fated Boons & Relics (${boons.length})</h2>
        <div class="boon-tray-sub">
          <span class="boon-tray-mode-tag">${modeBadge}</span>
          ${pactHeatHtml}
        </div>
      </div>
      ${boonsListHtml}
      <div class="boon-tray-footer">
        <div class="boon-tray-stats">
          <span>Purse: <b class="gold">${runWallet.crystal}</b> Crystal</span>
          <span>Active: <b>${battle.heroes.filter(h => h.hp > 0).length} / ${battle.heroes.length}</b> Bellkeepers</span>
        </div>
        <button class="gold-button" data-close>Resume Encounter [ESC]</button>
      </div>
    </div>
  `;

  openModal(content);
}
function navigateTown(tab: TownTab = 'campaign') {
  if (inTown) {
    if (commander.document) {
      const mode: CommanderMode = tab === 'raid' ? 'raid' : tab === 'endless' ? 'roguelike' : 'story';
      activateCommander(commander.document, mode);
    }
    showTown(tab);
    return;
  }
  void leaveSafely(async () => {
    if (commander.document) {
      await commander.flush();
      const mode: CommanderMode = tab === 'raid' ? 'raid' : tab === 'endless' ? 'roguelike' : 'story';
      activateCommander(commander.document, mode);
    }
    showTown(tab);
  });
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

type BoonMeta = {
  icon: string;
  color: string;
  glow: string;
  rarity: string;
};

function getBoonMeta(id: string): BoonMeta {
  switch (id) {
    case 'ember':
      return { icon: '🔥', color: '#ff6b3d', glow: 'rgba(255, 107, 61, 0.45)', rarity: 'OLYMPIAN FAVOR' };
    case 'storm':
      return { icon: '⚡', color: '#4da6ff', glow: 'rgba(77, 166, 255, 0.45)', rarity: 'STORM CREST' };
    case 'tide':
      return { icon: '🌊', color: '#2de2bd', glow: 'rgba(45, 226, 189, 0.45)', rarity: 'ABYSSAL SIGIL' };
    case 'thorn':
      return { icon: '🌿', color: '#52cc6c', glow: 'rgba(82, 204, 108, 0.45)', rarity: 'BRIAR EMBLEM' };
    case 'bell':
      return { icon: '🔔', color: '#f5c462', glow: 'rgba(245, 196, 98, 0.45)', rarity: 'RESONANT RELIC' };
    case 'fleet':
      return { icon: '🌪️', color: '#5eead4', glow: 'rgba(94, 234, 212, 0.45)', rarity: 'ZEPHYR TRIBUTE' };
    case 'resolve':
      return { icon: '🌅', color: '#f97316', glow: 'rgba(249, 115, 22, 0.45)', rarity: 'SOLAR COVENANT' };
    case 'execution':
      return { icon: '💀', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.45)', rarity: 'NETHER BRAND' };
    case 'frost':
      return { icon: '❄️', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)', rarity: 'GLACIAL SEED' };
    case 'feast':
      return { icon: '🌾', color: '#fb923c', glow: 'rgba(251, 146, 60, 0.45)', rarity: 'FERTILE OFFERING' };
    case 'lifeline':
      return { icon: '🕯️', color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.45)', rarity: 'SACRED TETHER' };
    case 'chorus':
      return { icon: '🎵', color: '#e879f9', glow: 'rgba(232, 121, 249, 0.45)', rarity: 'HARMONIC CHORD' };
    default:
      return { icon: '✨', color: '#f5c462', glow: 'rgba(245, 196, 98, 0.45)', rarity: 'DIVINE BLESSING' };
  }
}

function animateBoonDraft() {
  if (!profile.motion) return;
  const cards = modal.querySelectorAll('.boon-card');
  if (!cards.length) return;
  gsap.fromTo(
    cards,
    { opacity: 0, y: 35, scale: 0.88 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      stagger: 0.08,
      duration: 0.4,
      ease: 'back.out(1.6)',
      clearProps: 'opacity,transform',
    }
  );
}

function animateCeremony() {
  if (!profile.motion) return;
  const modalEl = modal.querySelector('.result-ceremony-modal');
  if (!modalEl) return;
  const crest = modalEl.querySelector('.ceremony-crest');
  const plaques = modalEl.querySelectorAll('.stat-plaque');
  const cards = modalEl.querySelectorAll('.xp-card');
  const tl = gsap.timeline();
  if (crest) {
    tl.fromTo(crest, { scale: 0.35, opacity: 0, rotation: -12 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.4, ease: 'back.out(2)', clearProps: 'opacity,transform' });
  }
  if (plaques.length) {
    tl.fromTo(plaques, { opacity: 0, y: 14 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.28, ease: 'power2.out', clearProps: 'opacity,transform' }, '-=0.15');
  }
  if (cards.length) {
    tl.fromTo(cards, { opacity: 0, x: -14 }, { opacity: 1, x: 0, stagger: 0.035, duration: 0.25, ease: 'power2.out', clearProps: 'opacity,transform' }, '-=0.1');
  }
}

function animateMirrorTalents() {
  if (!profile.motion) return;
  const nodes = document.querySelectorAll('.talent-flow-node');
  if (!nodes.length) return;
  gsap.fromTo(
    nodes,
    { opacity: 0, scale: 0.94 },
    { opacity: 1, scale: 1, stagger: 0.02, duration: 0.2, ease: 'power2.out', clearProps: 'opacity,transform' }
  );
}

function animateCodexEntry() {
  if (!profile.motion) return;
  const art = document.querySelector<HTMLElement>('.bestiary-list article');
  if (!art) return;
  const img = art.querySelector<HTMLElement>('img');
  const details = art.querySelector<HTMLElement>('div');
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  if (img) tl.fromTo(img, { opacity: 0, scale: 0.88, rotate: -2 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.28 });
  if (details) tl.fromTo(details.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.04, duration: 0.22, clearProps: 'all' }, '-=0.15');
}

function animateProphecies() {
  if (!profile.motion) return;
  const entries = document.querySelectorAll<HTMLElement>('.quest-entry');
  if (!entries.length) return;
  gsap.fromTo(entries, { opacity: 0, y: 12 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.25, ease: 'power2.out', clearProps: 'all' });
}

function animateChallengeShop() {
  if (!profile.motion) return;
  const items = document.querySelectorAll<HTMLElement>('.challenge-shop-grid .shop-item');
  if (!items.length) return;
  gsap.fromTo(items, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.03, duration: 0.22, ease: 'power2.out', clearProps: 'all' });
}

function animatePactRaid() {
  if (!profile.motion) return;
  const cards = document.querySelectorAll<HTMLElement>('.raid-roster button');
  if (cards.length) {
    gsap.fromTo(cards, { opacity: 0, scale: 0.95, y: 8 }, { opacity: 1, scale: 1, y: 0, stagger: 0.03, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,transform' });
  }
  const brief = document.querySelector<HTMLElement>('.mission-brief');
  if (brief) {
    gsap.fromTo(brief, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'opacity,transform' });
  }
}

function animateSunkenDescent() {
  if (!profile.motion) return;
  const pillars = document.querySelectorAll<HTMLElement>('.endless-rules p');
  if (pillars.length) {
    gsap.fromTo(pillars, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.24, ease: 'power2.out', clearProps: 'opacity,transform' });
  }
  const slots = document.querySelectorAll<HTMLElement>('.loadout-slots label');
  if (slots.length) {
    gsap.fromTo(slots, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, stagger: 0.06, duration: 0.25, ease: 'back.out(1.2)', clearProps: 'opacity,transform' });
  }
  const cta = document.querySelector<HTMLElement>('button[data-depart="endless"]');
  if (cta) {
    gsap.fromTo(cta, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.28, ease: 'power2.out', clearProps: 'opacity,transform' });
  }
}

function result() {
  if (presentingResult) return;
  presentingResult = true;
  const request = ++resultRequest;
  const current = battle, stage = battle.stage;
  const show = async () => {
    if (request !== resultRequest || inTown || battle !== current || battle.stage !== stage) return;
    if (await presentResult() === false) { presentingResult = false; return; }
    presentingResult = false;
    modal.dataset.result = 'true';
    const generation = resultGate.open(performance.now());
    resultGeneration = generation;
    const buttons = Array.from(modal.querySelectorAll<HTMLButtonElement>('button'));
    buttons.forEach(button => { button.disabled = true; });
    const hint = document.createElement('p'); hint.setAttribute('role','status'); hint.textContent = 'Sebentar… opsi aktif dalam 1 detik.';
    modal.append(hint);
    modal.scrollTop = 0;
    window.setTimeout(() => {
      if (!modal.open || request !== resultRequest || battle !== current || battle.stage !== stage || !resultGate.allows(performance.now(), generation)) return;
      buttons.forEach(button => { button.disabled = false; });
      modal.scrollTop = 0;
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
async function presentResult() {
  const won = battle.status === 'victory';
  const moreWaves = won && battle.mode === 'adventure' && battle.stage + 1 < battle.stageCount;
  const zone = CAMPAIGN[battle.floor - 1];
  let recruited: string[] = [];
  let reward = 0;
  if (!recorded) {
    pendingSettlement = true;
    if (won && !moreWaves && !encounter?.settled) {
      const candidate = structuredClone(profile);
      const wallet = structuredClone(runWallet);
      const rewards = settleProgress(candidate, battle, wallet);
      if (rewards === null) {
        commander.error = 'Settlement rejected. No success receipt was created. Export pending outcome before refresh.';
        storageStatus();
        openModal('<h2 id="modal-title">Settlement blocked</h2><p>No reward confirmation. Open Profiles to export recovery data.</p>');
        return false;
      }
      reward = battle.gold + (battle.mode === 'adventure' ? zone.reward : 0);
      if (battle.mode === 'adventure') {
        candidate.gold += reward;
        const before = new Set(candidate.roster);
        completeZone(candidate, battle.floor - 1);
        recruited = candidate.roster.filter(id => !before.has(id)).map(id => ROSTER[id].name);
      }
      candidate.wins++;
      if (battle.mode === 'endless') candidate.bestFloor = Math.max(candidate.bestFloor, battle.floor);
      profile = candidate;
      runWallet = wallet;
      battle.runWallet = runWallet;
      experienceRewards = rewards;
      encounter = makeEncounter(true);
    } else if (moreWaves) {
      encounter = makeEncounter(false);
    } else if (!encounter?.settled) encounter = makeEncounter(true);
    const ok = await checkpoint(true);
    if (!ok && commander.document) {
      openModal('<h2 id="modal-title">Outcome not saved</h2><p>Navigation locked. Retry the same pending outcome, or export recovery data.</p><button id="retry-save" class="gold-button">Retry save</button><button id="pending-export" class="secondary-button">Export pending outcome</button>');
      $('retry-save').onclick = () => { presentingResult = false; result(); };
      $('pending-export').onclick = exportCommander;
      return false;
    }
    pendingSettlement = false;
    recorded = true;
  }
  if (won && battle.mode === 'endless') offeredBoons = boonChoices(runBoons, runSeed + battle.floor * 7919);
  $('start-overlay').hidden = false;
  $('ready-title').textContent = won ? moreWaves ? 'The path opens.' : 'The bell remembers.' : 'The ember remains.';
  $('ready-copy').textContent = 'Buka hasil untuk melanjutkan atau kembali ke town.';
  $('start').textContent = 'Lihat hasil';
  const description = moreWaves ? 'Masih ada bahaya di depan. HP, potion, formasi, dan cooldown party dibawa ke pertempuran berikutnya.' : won && battle.mode === 'adventure' ? zone.outro : won && battle.mode === 'raid' ? `${battle.raidContract?.sandbox ? 'Practice selesai; kontrak Sandbox tidak memberi Crystal.' : `Certified ${battle.raidContract?.tier ?? 'bronze'} contract settled. Bank Crystal: ${battle.raidContract ? 'receipt recorded' : 'none'}.`}` : won ? `Room clear. Journey purse sekarang ${runWallet.crystal} Crystal; act reward hanya masuk bank pada authored act clear.` : 'Party tumbang. Coba skill berbeda, jaga hero yang ditandai, dan simpan Guard untuk ritual.';
  if (won && battle.mode === 'endless') {
    const cardsHtml = offeredBoons.map(b => {
      const meta = getBoonMeta(b.id);
      return `<button class="boon-card" data-boon="${b.id}" style="--card-accent: ${meta.color}; --card-glow: ${meta.glow};" aria-label="${b.name} - ${b.patron}">
        <div class="boon-card-corner tl"></div>
        <div class="boon-card-corner tr"></div>
        <div class="boon-card-corner bl"></div>
        <div class="boon-card-corner br"></div>
        <div class="boon-card-frame">
          <div class="boon-card-header">
            <div class="boon-patron-badge">
              <span class="boon-patron-icon">${meta.icon}</span>
              <span class="boon-patron-name">${b.patron}</span>
            </div>
            <span class="boon-rarity-pill">${meta.rarity}</span>
          </div>
          <div class="boon-card-body">
            <h4 class="boon-name">${b.name}</h4>
            <div class="boon-card-divider"><span class="card-div-gem">◆</span></div>
            <p class="boon-desc">${b.description}</p>
          </div>
          <div class="boon-card-footer">
            <div class="boon-cta">
              <span class="boon-cta-gem">✦</span>
              <span>Accept Blessing</span>
              <span class="boon-cta-gem">✦</span>
            </div>
          </div>
        </div>
      </button>`;
    }).join('');

    openModal(`<div class="boon-draft-modal">
      <header class="boon-modal-header">
        <span class="eyebrow">✦ DIVINE OFFERING · FLOOR ${battle.floor} CLEARED ✦</span>
        <h2 id="modal-title" class="boon-modal-title">THE PATRONS BESTOW THEIR FAVOR</h2>
        <p class="boon-modal-subtitle">Choose one divine blessing to guide the Bellkeepers deeper into the Sunken Bell. Its power endures until the expedition ends.</p>
        <div class="boon-run-wallet">
          <span>Purse: <b>${runWallet.crystal}</b> Crystal</span>
          <span>·</span>
          <span>Party: <b>${battle.living().length}/${battle.heroes.length}</b> Standing</span>
          <span>·</span>
          <span>Elapsed: <b>${formatTime(battle.time)}</b></span>
        </div>
      </header>
      ${!offeredBoons.length ? '<button id="next-floor" class="gold-button">All boons collected · descend</button>' : ''}
      <div class="boon-draft-grid">
        ${cardsHtml}
      </div>
      <footer class="boon-modal-footer">
        <button id="result-town" class="secondary-button">Abandon Run & Return to Emberhollow</button>
      </footer>
    </div>`, false);
    animateBoonDraft();
  } else {
    const outcomeClass = won ? (moreWaves ? 'wave-clear' : 'victory') : 'defeat';
    const crestIcon = won ? (moreWaves ? '⚔️' : '🏆') : '💀';
    const eyebrowText = moreWaves ? `✦ STAGE ${battle.stage + 1} / ${battle.stageCount} CLEARED ✦` : (won ? '✦ EXPEDITION COMPLETE · VICTORY ✦' : '✦ EXPEDITION LOST · SLAIN IN COMBAT ✦');
    const titleText = won ? (moreWaves ? 'Keep moving.' : 'Bring the fire home.') : 'Rally. Adapt. Return.';
    const goldDisplay = won ? (moreWaves ? `${battle.gold}g` : `${battle.gold + (battle.mode === 'adventure' ? zone.reward : 0)}g`) : '0g';
    const goldLabel = moreWaves ? 'CARRIED · NOT BANKED' : 'GOLD BANKED';

    const xpCardsHtml = experienceRewards.length ? `
      <section class="xp-results">
        <div class="xp-section-header">
          <h3>Hero experience banked</h3>
          <span class="xp-section-tag">${experienceRewards.length} Bellkeepers</span>
        </div>
        <div class="xp-cards-grid">
          ${experienceRewards.map(r => {
            const isLevelUp = r.after > r.before;
            const hero = ROSTER[r.id];
            const roleIcon = hero.classId === 'warrior' ? '🛡️' : hero.classId === 'healer' ? '✨' : hero.classId === 'wizard' ? '🔮' : hero.classId === 'rogue' ? '🗡️' : '🏹';
            return `<p class="xp-card ${isLevelUp ? 'leveled-up' : ''}" data-xp-kind="${r.kind}">
              <span class="xp-hero-ident">
                <span class="xp-hero-icon">${roleIcon}</span>
                <span class="xp-hero-info">
                  <b class="xp-hero-name">${hero.name} · ${r.kind === 'bench' ? 'BENCH' : 'ACTIVE'}</b>
                  <span class="xp-role-badge ${r.kind}">${r.kind === 'bench' ? 'BENCH' : 'ACTIVE'}</span>
                </span>
              </span>
              <span class="xp-gain-group">
                <span class="xp-points">+${r.xp} XP${r.bonus ? ` <span class="xp-catchup">(catch-up +${r.bonus})</span>` : ''}</span>
                <span class="xp-level-badge ${isLevelUp ? 'lvl-glow' : ''}">
                  ${isLevelUp ? `⭐ LEVEL UP ${r.before} → ${r.after}` : `Lv.${r.after}`}
                </span>
              </span>
            </p>`;
          }).join('')}
        </div>
        <small class="xp-footnote">Hero tumbang mendapat 60% XP. Bonus stat baru aktif expedition berikutnya. ${QUESTS.filter(q=>questProgress(profile,q).ready).length} quest siap diklaim di town.</small>
      </section>` : '';

    openModal(`<div class="result-ceremony-modal ${outcomeClass}">
      <div class="ceremony-corner tl"></div>
      <div class="ceremony-corner tr"></div>
      <div class="ceremony-corner bl"></div>
      <div class="ceremony-corner br"></div>

      <div class="ceremony-crest-container">
        <div class="ceremony-crest ${outcomeClass}">
          <span class="ceremony-crest-aura"></span>
          <span class="ceremony-crest-icon">${crestIcon}</span>
        </div>
      </div>

      <header class="ceremony-header">
        <span class="eyebrow">${eyebrowText}</span>
        <h2 id="modal-title" class="ceremony-title">${titleText}</h2>
        <div class="ceremony-divider"><span class="ceremony-div-gem">◆</span></div>
        <p class="ceremony-desc">${description}</p>
        ${recruited.length ? `<p class="recruit-notice">${recruited.join(' dan ')} bergabung dengan Bellkeepers. Rekan baru mengikuti level tengah party.</p>` : ''}
      </header>

      ${xpCardsHtml}

      <div class="result-stats">
        <div class="stat-plaque">
          <span class="stat-icon">⏱️</span>
          <div class="stat-meta">
            <b>${formatTime(battle.time)}</b>
            <small>ELAPSED</small>
          </div>
        </div>
        <div class="stat-plaque">
          <span class="stat-icon">🛡️</span>
          <div class="stat-meta">
            <b>${battle.living().length}/${battle.heroes.length}</b>
            <small>STANDING</small>
          </div>
        </div>
        <div class="stat-plaque gold">
          <span class="stat-icon">🪙</span>
          <div class="stat-meta">
            <b>${goldDisplay}</b>
            <small>${goldLabel}</small>
          </div>
        </div>
      </div>

      <div class="ceremony-actions">
        ${moreWaves ? '<button id="next-wave" class="gold-button">Lanjut ke encounter berikutnya</button>' : '<button id="retry" class="secondary-button">Ulang expedition dari awal</button>'}
        <button id="result-town" class="${moreWaves ? 'secondary-button' : 'gold-button'}">${moreWaves ? 'Abandon loot & pulang' : 'Kembali ke Emberhollow'}</button>
      </div>
    </div>`, false);
    animateCeremony();
  }
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
    sound.unlock();
    sound.play('buff');
    closeWithoutResume();
    void nextFloor();
  }));
  $('next-floor')?.addEventListener('click',()=>{closeWithoutResume();void nextFloor();});
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
  $('retry')?.addEventListener('click', () => {
    const mode = battle.mode, floor = battle.mode === 'endless' ? 1 : battle.floor;
    runBoons = [];
    closeWithoutResume();
    boot(mode, floor);
    void clearEncounter();
  });
  $('result-town').addEventListener('click', () => {
    runBoons = [];
    const tab: TownTab = battle.mode === 'adventure' ? 'campaign' : battle.mode === 'raid' ? 'raid' : 'endless';
    if (battle.mode === 'adventure') {
      if (commander.document) activateCommander(commander.document, 'story');
      inTown = true;
      closeWithoutResume();
      showTown('campaign');
    } else {
      navigateTown(tab);
    }
  });
}

function makeEncounter(settled = false): NonNullable<typeof encounter> {
  return { runId: encounter?.runId ?? crypto.randomUUID(), seq: (encounter?.seq ?? 0) + 1, battle: battle.checkpoint(), purse: runWallet.crystal, boons: [...runBoons], seed: runSeed, settled };
}
async function checkpoint(terminal = false, slotId: SlotId = 'auto') {
  if (!terminal && battle.status === 'ready') encounter = makeEncounter();
  if (!encounter) return false;
  const frozen = structuredClone(encounter);
  return persist(slotId, document => {
    document.encounters ??= {};
    document.encounters[commander.mode] = frozen;
    if (commander.mode === 'story') {
      for (const slot of document.story.slots) if ((slot.slotId === slotId || slot.slotId === 'auto') && slot.state) {
        slot.state.encounter=structuredClone(frozen);
        slot.state.loadouts=structuredClone(profile.loadouts);
      }
    }
    if (commander.mode !== 'story') {
      for (const slot of document.story.slots) if (slot.state) {
        slot.state.loadouts = structuredClone(profile.loadouts);
        slot.state.ledger = structuredClone(profile.ledger);
        slot.state.wins = profile.wins;
        slot.state.receipts = [...profile.settlementReceipts];
      }
      const state = commander.mode === 'raid' ? document.raid : document.rogue;
      const run = createRunCheckpoint(commander.mode, { runId: frozen.runId, floor: battle.floor, seed: frozen.seed, purse: frozen.purse, boons: frozen.boons, checkpointSeq: frozen.seq, rogueBuild: battle.rogueBuild, raidBuild: battle.raidBuild, raidContract: battle.raidContract, raidSandbox: battle.raidSandbox });
      const finished = battle.status === 'defeat' || terminal && (battle.mode === 'raid' || battle.runFinalClear);
      if (finished) { state.lastRun = terminalRun(run, battle.status === 'defeat' ? 'defeat' : 'finished'); state.activeRun = undefined; }
      else state.activeRun = run;
      for (const slot of state.slots) if ((slot.slotId === slotId || slot.slotId === 'auto') && slot.state) {
        slot.state.runBookmark = structuredClone(state.activeRun ?? state.lastRun);
        slot.status = finished ? 'terminal-replay' : 'active-checkpoint';
      }
    }
  });
}
function restoreEncounter(savedEncounter: NonNullable<typeof encounter>) {
  if (!inTown || commander.stale || pendingSettlement || commander.busy || commander.dirty) return;
  const frozen = structuredClone(savedEncounter);
  boot(frozen.battle.mode, frozen.battle.floor);
  battle.restoreCheckpoint(frozen.battle);
  encounter = frozen;
  runWallet = createRunWallet(); runWallet.crystal = frozen.purse; battle.runWallet = runWallet;
  runBoons = [...frozen.boons]; runSeed = frozen.seed;
  recorded = frozen.settled;
  townState.rogueSetup = battle.rogueBuild ? structuredClone(battle.rogueBuild) : townState.rogueSetup;
  scene.replace(battle); makeUnits(); updateExpedition(); showReady();
  $('ready-copy').textContent = 'Resumes from encounter start with saved HP, supplies and RNG. Not a mid-frame save.';
  if (frozen.settled) result();
}
async function clearEncounter() {
  const ok = await persist('auto', document => {
    if (document.encounters) delete document.encounters[commander.mode];
    if (commander.mode === 'story' && document.story.slots[3].state) delete document.story.slots[3].state.encounter;
    if (commander.mode !== 'story') {
      const state = commander.mode === 'raid' ? document.raid : document.rogue;
      if (state.activeRun) state.lastRun = terminalRun(state.activeRun, 'abandoned');
      state.activeRun = undefined;
    }
  });
  if (ok) { encounter = undefined; resetRunWallet(runWallet); }
  return ok;
}
async function nextFloor() {
  if (pendingSettlement || commander.stale) return;
  const build = structuredClone(battle.rogueBuild ?? createRogueBuild());
  boot('endless', battle.floor + 1, { rogueBuild: build });
  townState.rogueSetup = build;
  await checkpoint();
}
function activateCommander(document: CommanderDocument, mode = document.activeMode) {
  profile = commander.select(document, mode);
  encounter = undefined; runBoons = []; runWallet = createRunWallet(); recorded = false; pendingSettlement = false;
  const rogue = storedStateFor(document, 'roguelike', 'auto');
  const raid = storedStateFor(document, 'raid', 'auto');
  townState.rogueSetup = rogue && 'bestFloor' in rogue ? structuredClone(rogue.build) : createRogueBuild();
  townState.raidBuild = raid && 'build' in raid && raid.build && 'slots' in raid.build ? structuredClone(raid.build) : createRaidBuild(profile.roster, Math.min(3,profile.roster.length,6));
  const contract = raid && 'contract' in raid ? raid.contract : undefined;
  townState.raid = contract?.bossId ?? 'golem'; townState.raidTier = contract?.tier ?? 'bronze'; townState.raidModifiers = [...(contract?.modifiers ?? [])];
  townState.raidSandbox = raid && 'sandbox' in raid ? raid.sandbox : undefined;
  townState.pendingGear = undefined; townState.hero = profile.roster[0]; townState.zone = Math.min(profile.cleared.length,CAMPAIGN.length-1);
  sound.enabled = profile.sound; scene.reducedMotion = !profile.motion;
  $('sound').setAttribute('aria-pressed', String(profile.sound)); window.document.body.classList.toggle('reduced-motion', !profile.motion);
  updateTitleStatus();
  if (inTown) showTown(mode === 'story' ? 'campaign' : mode === 'raid' ? 'raid' : 'endless');
}
async function leaveSafely(action: () => void | Promise<void>) {
  if (pendingSettlement || presentingResult || commander.stale) { storageStatus(); return; }
  if (!(await commander.flush())) { storageStatus(); return; }
  if (inTown || !commander.document) { inTown = true; closeWithoutResume(); await action(); return; }
  openModal('<h2 id="modal-title">Leave this encounter?</h2><p>Save & Suspend keeps the encounter-start checkpoint (same HP, supplies and RNG). Abandon ends this run without a new reward. Opening this menu changes nothing.</p><button id="suspend-run" class="gold-button">Save & Suspend</button><button id="abandon-run" class="secondary-button">Abandon run</button><button data-close class="secondary-button">Cancel</button>');
  $('suspend-run').onclick = async () => {
    if (commander.busy) return;
    if (await persist('auto', doc => { if (commander.mode !== 'story') { const state=commander.mode==='raid'?doc.raid:doc.rogue; if (state.activeRun) state.activeRun.status='suspended'; } })) { closeWithoutResume(); inTown = true; await action(); }
  };
  $('abandon-run').onclick = async () => {
    if (commander.busy) return;
    if (await clearEncounter()) { closeWithoutResume(); inTown = true; await action(); }
  };
}
function download(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data,null,2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function exportCommander() {
  download(commander.dirty || pendingSettlement ? { kind:'gridbound-recovery', document:commander.document, pendingProfile:profile, pendingEncounter:encounter } : commander.document, 'Gridbound-Commander.json');
}
import { STORY_CHOICES, narrativeChoice, epilogue } from './game/narrative';
async function storyJournal() {
  if (commander.document && commander.mode !== 'story') {
    commander.mode = 'story';
    commander.document.activeMode = 'story';
    profile = commander.select(commander.document, 'story');
  }
  if (!inTown || !(await commander.flush())) return;
 const state=profile.narrative??{};
 const scenes=STORY_CHOICES.filter(s=>Array.from({length:s.chapter},(_,i)=>i).every(i=>profile.cleared.includes(i)));
 const ending=epilogue(state,profile.cleared);
 openModal(`<h2 id="modal-title">Story journal</h2><p>Memory, loss, grief. Pilihan mengubah kehidupan kecil warga, bukan ending atau hadiah.</p>${scenes.length?'':'<p>Catatan pilihan pertama tersedia setelah Chapter 3. Story tetap linear.</p>'}${scenes.map(s=>`<section><h3>${s.title}</h3><p>${s.text}</p>${state[s.id]?`<p>${s.options.find(o=>o.id===state[s.id])?.outcome}</p>`:s.options.map(o=>`<button class="secondary-button" data-story-choice="${s.id}" data-story-option="${o.id}">${o.label}</button>`).join('')+`<button class="secondary-button" data-story-choice="${s.id}" data-story-option="${s.options[0].id}">Skip — ${s.options[0].label}</button>`}</section>`).join('')}${ending.map(text=>`<p>${text}</p>`).join('')}<button data-close>Back</button>`);
 modal.querySelectorAll<HTMLElement>('[data-story-choice]').forEach(button=>button.onclick=async()=>{
  if(commander.busy||commander.stale)return;
  profile.narrative??={};
  if(narrativeChoice(profile.narrative,button.dataset.storyChoice!,button.dataset.storyOption!,profile.cleared)&&await persist())await storyJournal();
 });
}
const journalButton=document.createElement('button');journalButton.textContent='Story journal';journalButton.className='secondary-button';journalButton.id='story-journal';journalButton.onclick=()=>{void storyJournal();};document.querySelector('.header-tools')!.prepend(journalButton);
async function profilesMenu() {
  openModal('<h2 id="modal-title">Commander profiles</h2><p>Loading local profiles…</p>');
  try {
    const documents = await commander.open();
    if (!commander.document && documents.length > 0) {
      const latest = [...documents].sort((a, b) => b.lastPlayed - a.lastPlayed)[0];
      activateCommander(latest);
    }
    const current = commander.document;
    const slots = current ? (commander.mode === 'story' ? current.story : commander.mode === 'raid' ? current.raid : current.rogue).slots : [];
    openModal(`<h2 id="modal-title">Commander profiles</h2><p>3 profiles. Each mode: 3 manual slots + 1 auto. Shared Challenge wallet belongs only to this Commander.</p>${documents.map((doc,index) => `<p><b>${escapeUI(doc.name)}</b> · Chapter ${doc.story.slots[3].state?.cleared.length ?? 0} · ${doc.shared.bankCrystal} Crystal · revision ${doc.revision}<br><button data-commander="${index}" class="secondary-button">${current?.commanderId === doc.commanderId ? 'Current Commander' : 'Switch Commander'}</button></p>`).join('') || '<p>No Commander yet. Create one below; no legacy data is migrated automatically.</p>'}<label>Commander name <input id="commander-name" maxlength="32" value="${escapeUI(current?.name ?? 'Commander')}"></label><button id="new-commander" class="gold-button" ${documents.length >= 3 ? 'disabled' : ''}>New Commander</button>${current ? '<button id="rename-commander" class="secondary-button">Rename current</button><button id="export-commander" class="secondary-button">Export Commander / recovery</button><button id="delete-commander" class="secondary-button">Delete current…</button><button id="save-retry" class="secondary-button">Retry save</button>' : ''}<button id="legacy-preview" class="secondary-button">Preview legacy copy</button>${current ? `<h3>${commander.mode} slots</h3><p>Loading never restores an older shared wallet or receipt ledger. Challenge bookmarks show builds only; Continue latest resumes the authoritative checkpoint.</p>${slots.map(slot => `<p><b>${slot.slotId}</b> · ${slot.status} · ${slot.savedAt ? new Date(slot.savedAt).toLocaleString() : 'empty'}<br>${slot.slotId !== 'auto' ? `<button data-save-slot="${slot.slotId}" class="secondary-button">Save checkpoint</button>` : ''}<button data-load-slot="${slot.slotId}" class="secondary-button" ${!slot.state ? 'disabled' : ''}>Preview / load</button></p>`).join('')}<button id="continue-latest" class="gold-button">Continue latest</button>` : ''}<p id="profile-error" role="status">${escapeUI(commander.error || commander.repository?.warning || '')}</p><button data-close class="secondary-button">Cancel / close</button>`);
    const attempt = async (task: () => Promise<void>) => { try { await task(); } catch(error) { $('profile-error').textContent = error instanceof Error ? error.message : String(error); } };
    modal.querySelectorAll<HTMLElement>('[data-commander]').forEach(button => button.onclick = () => { const target = documents[Number(button.dataset.commander)]; if (target.commanderId !== current?.commanderId) void leaveSafely(() => { activateCommander(target); closeWithoutResume(); }); else closeWithoutResume(); });
    $('new-commander').onclick = () => { const name = $<HTMLInputElement>('commander-name').value; void leaveSafely(() => attempt(async () => { activateCommander(await commander.create(name)); closeWithoutResume(); })); };
    $('rename-commander')?.addEventListener('click', () => { const name = $<HTMLInputElement>('commander-name').value.trim().slice(0,32); void attempt(async () => { if (!name) throw new Error('Enter a name.'); if (await persist('auto', doc => { doc.name=name; })) await profilesMenu(); }); });
    $('export-commander')?.addEventListener('click',exportCommander);
    $('save-retry')?.addEventListener('click', () => { if (pendingSettlement) { presentingResult=false; result(); } else void persist().then(() => profilesMenu()); });
    $('delete-commander')?.addEventListener('click', () => {
      openModal(`<h2 id="modal-title">Delete ${escapeUI(current!.name)}?</h2><p>This removes all Story, Rogue and Raid slots, active runs, ${current!.shared.bankCrystal} bank Crystal and ${current!.shared.settlementReceipts.length} receipts. Export first. Type DELETE to confirm.</p><input id="delete-word" aria-label="Type DELETE"><button id="delete-confirm" class="secondary-button" disabled>Delete permanently</button><button data-close class="secondary-button">Cancel</button>`);
      $('delete-word').oninput = () => { $<HTMLButtonElement>('delete-confirm').disabled = $<HTMLInputElement>('delete-word').value !== 'DELETE'; };
      $('delete-confirm').onclick = async () => { if (!inTown || pendingSettlement || commander.stale) return; try { await commander.flush(); await commander.repository!.remove(current!.commanderId,commander.document!.revision); commander.document=undefined; profile=createProfile(); showTown(); await profilesMenu(); } catch(error) { commander.error=String(error); storageStatus(); } };
    });
    $('legacy-preview').onclick = () => {
      let raw: string | null = null; try { raw=store.getItem('gridbound.v3'); } catch { /* source remains protected */ }
      openModal(`<h2 id="modal-title">Legacy copy preview</h2><p>Story Gold ${saved.profile.gold}; roster ${saved.profile.roster.length}; active ${saved.profile.storyActive.join(', ')}. Challenge bank resets to 0. Legacy bytes remain unchanged. Existing jobs and gear stay Classic-compatible; no R1 hero-path remapping is claimed.</p><p>${escapeUI(saved.warning)}</p><button id="legacy-export" class="secondary-button">Export original bytes</button><button id="legacy-confirm" class="gold-button" ${!raw || saved.readOnly || documents.length>=3 ? 'disabled' : ''}>Create R1 copy (explicit opt-in)</button><button data-close class="secondary-button">Cancel</button>`);
      $('legacy-export').onclick = () => download(raw ?? '', 'Gridbound-original-v3.json');
      $('legacy-confirm').onclick = () => { void leaveSafely(async () => { const candidate=copyLegacyToCommander(saved.profile,'Legacy copy'); candidate.legacySource=raw!; try { activateCommander(await commander.create('Legacy copy',candidate)); closeWithoutResume(); } catch(error) { commander.error=String(error); storageStatus(); } }); };
    };
    modal.querySelectorAll<HTMLElement>('[data-save-slot]').forEach(button => button.onclick = () => { void attempt(async () => { if (!inTown && encounter && !pendingSettlement) { const frozen=structuredClone(encounter); await persist(button.dataset.saveSlot as SlotId, doc => { const state=commander.mode==='story'?doc.story:commander.mode==='raid'?doc.raid:doc.rogue; const auto=state.slots[3]; const index=state.slots.findIndex(slot=>slot.slotId===button.dataset.saveSlot); state.slots[index]=structuredClone({...auto,slotId:button.dataset.saveSlot as SlotId}); doc.encounters ??={}; doc.encounters[commander.mode]=frozen; }); } else await persist(button.dataset.saveSlot as SlotId); await profilesMenu(); }); });
    modal.querySelectorAll<HTMLElement>('[data-load-slot]').forEach(button => button.onclick = () => {
      const slot=slots.find(item=>item.slotId===button.dataset.loadSlot)!;
      openModal(`<h2 id="modal-title">${slot.slotId} preview</h2><pre style="max-height:14rem;overflow:auto;white-space:pre-wrap">${escapeUI(JSON.stringify(slot.state,null,2))}</pre><p>Challenge run bookmarks cannot rewind rewards. Story load replaces only Story state.</p><button id="load-confirm" class="gold-button">Load selected slot</button><button data-close class="secondary-button">Cancel</button><p id="load-error" role="status"></p>`);
      $('load-confirm').onclick = async () => { if (!inTown || pendingSettlement) { $('load-error').textContent='Save & Suspend or abandon before loading.'; return; } try { profile=await commander.loadSlot(slot.slotId); activateCommander(commander.document!,commander.mode); closeWithoutResume(); } catch(error) { $('load-error').textContent=String(error); } };
    });
    $('continue-latest')?.addEventListener('click', () => { const savedEncounter=commander.document?.encounters?.[commander.mode]; if (!savedEncounter) { $('profile-error').textContent='No checkpoint in this mode. Depart from town to begin.'; return; } closeWithoutResume(); restoreEncounter(savedEncounter); });
  } catch(error) { console.error('PROFILES_MENU_ERROR:', error); openModal(`<h2 id="modal-title">Protected storage</h2><p>${escapeUI(String(error))}</p><p>No existing save was overwritten. Refresh with a compatible build.</p>`); }
}
commander.onStatus = () => { storageStatus(); if (commander.stale && battle.status === 'fighting') battle.pause(); };
$('profiles').onclick = () => { void profilesMenu(); };
window.addEventListener('beforeunload', () => {
  delete (window as unknown as { gridbound?: unknown }).gridbound;
});
if (typeof navigator !== 'undefined' && !navigator.webdriver) {
  window.addEventListener('beforeunload', event => { if (commander.busy || commander.dirty || pendingSettlement) event.preventDefault(); });
}
$('home').addEventListener('click', () => {
  if (inTown) {
    showTitleScreen();
  } else {
    navigateTown();
  }
});
$('title-enter').addEventListener('click', enterEmberhollow);
$('title-profiles').addEventListener('click', () => { void profilesMenu(); });
$('title-journal').addEventListener('click', () => { void storyJournal(); });
$('title-settings').addEventListener('click', settings);
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
$('combat-boons').addEventListener('click', showBoonTray);
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
  const titleScreen = $('title-screen');
  if (titleScreen && !titleScreen.hidden) {
    if (e.code === 'Enter' || e.code === 'Space') {
      const active = document.activeElement;
      const otherButton = active && active !== $('title-enter') && active.tagName === 'BUTTON';
      if (!otherButton) {
        e.preventDefault();
        enterEmberhollow();
      }
    }
    return;
  }
  if (modal.open) { if (modal.dataset.result === 'true' && !resultGate.allows(performance.now(), resultGeneration)) { e.preventDefault(); return; } if (e.code === 'Escape' || (e.code === 'KeyB' && modal.querySelector('.boon-tray-modal'))) { e.preventDefault(); modal.close(); } return; }
  if (inTown) return;
  const controlFocused = (e.target as HTMLElement).closest('button,a');
  if (e.code === 'Space' && !controlFocused) { e.preventDefault(); pauseMenu(); }
  if (e.code === 'Enter' && !controlFocused && battle.status === 'ready') begin();
  if (e.code === 'KeyB') { e.preventDefault(); showBoonTray(); }
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
if (typeof navigator !== 'undefined' && !navigator.webdriver) {
  showTitleScreen();
}
void commander.open().then(documents => { if (documents.length > 0) { const latest = [...documents].sort((a, b) => b.lastPlayed - a.lastPlayed)[0]; activateCommander(latest); } }).catch(error => { commander.error=String(error); storageStatus(); });
if (import.meta.env.DEV) Object.assign(window, { gridbound: {
  snapshot: () => battle.snapshot(), profile: () => structuredClone(profile),
  get battle() { return battle; }, get inTown() { return inTown; },
  get runBoons() { return runBoons; },
  setRunBoons: (b: string[]) => { runBoons = [...b]; battle.boons = [...b]; updateExpedition(); },
  step: (seconds: number) => { for (let t = 0; t < Math.min(600, Math.max(0, seconds)); t += 1 / 60) battle.tick(1 / 60); frame(1); },
  boot, scene, showTitle: showTitleScreen, hideTitle: enterEmberhollow, showBoonTray,
} });
