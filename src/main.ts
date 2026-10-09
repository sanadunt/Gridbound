import Phaser from 'phaser';
import gsap from 'gsap';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import './styles/base.css';
import './styles/title.css';
import './styles/town.css';
import './styles/screens.css';
import './styles/battle.css';
import './styles/result.css';
import './styles/dungeon.css';
import { currencyAmount } from './ui/currency';
import { townSceneCanvas } from './art/town-scene';
import { Battle, type BattleEvent, type BattleOptions } from './game/simulation';
import { KITS, ROSTER, type Mode } from './game/content';
import { CHARACTERS } from './game/characters';
import { CAMPAIGN, BOONS, boonChoices } from './game/world';
import { promote, equipGear, buyTalent, equipSkill, respecHero, moveFormation, completeZone, profileModifiers, canEnterZone, settleProgress, claimQuest, syncProfileEconomy, buyChallengeUnlock, refineGear, bankPouch, claimStarChest, recordChapterResult } from './game/profile';
import { startRun, enterNode, chooseEvent, openTreasure, campChoice, resolveFight, fightScale, dungeonXP, type Outcome } from './game/dungeon';
import { chapterStars } from './game/journey';
import { renderTown, routeTitle, portrait, type TownState, type TownTab } from './ui/town';
import { actArt } from './ui/world-map';
import { playDialogue, paginate } from './ui/dialogue';
import { BattleScene, ARENA, cell } from './render/BattleScene';
import { ResultGate, RESULT_INPUT_DELAY_MS, type ResultGateGeneration } from './ui/result-gate';
import { Sound } from './audio/sound';
import { loadSave, saveProfile } from './game/save';
import { createProfile } from './game/profile';
import { CommanderSession } from './game/commander-session';
import { copyLegacyToCommander, createCommanderDocument, createRunCheckpoint, terminalRun, storedStateFor, type CommanderDocument, type CommanderMode, type SlotId } from './game/commander';
import { storyBattleOptions, setStoryParty, normalizeStoryParty } from './game/story-party';
import { createRogueBuild, setRogueJobs, rogueUpgrades } from './game/roguelike-build';
import { JOBS } from './game/jobs';
import { createRaidBuild, setRaidJob, setRaidPartySize, normalizeRaidBuild } from './game/raid-build';
import { QUESTS, questProgress } from './game/quests';
import { CHALLENGE_SHOP, createRunWallet, creditRun, resetRunWallet, getRaidContractForEnemy, roguelikeMilestoneForFloor, buyRunItem, type RaidModifierId, type RaidSandbox, type RaidTier, type RunWallet } from './economy/challenge';
import { t, lang, setLang, gameText, type Lang } from './i18n';
import { localizeContent, eventText } from './i18n/content';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const store = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
localizeContent(lang());
document.documentElement.lang = lang();
const titleWorld = townSceneCanvas().toDataURL();
const saved=loadSave(store);
let profile = saved.profile;
const commander = new CommanderSession();
let encounter: NonNullable<CommanderDocument['encounters']>[CommanderMode];
let pendingSettlement = false;
if (matchMedia('(prefers-reduced-motion: reduce)').matches) profile.motion = false;
let storageFailed = false;
const heroName = (h: { name: string }) => eventText(h.name, lang());
const stageLabel = () => eventText(battle.stageName, lang());
const modeName = (mode: CommanderMode) => t(mode === 'story' ? 'mode.campaign' : mode === 'raid' ? 'mode.raid' : 'mode.endless');
function updateTitleStatus() {
  const nameEl = $('title-commander-name');
  if (!nameEl) return;
  nameEl.textContent = `${commander.document?.name || t('title.recruit')} · ${modeName(commander.mode)}`;
}
function titleMarkup() {
  return `<div class="title-backdrop" aria-hidden="true"><img class="title-world-art" src="${titleWorld}" alt="" /><div class="title-vignette"></div></div>
  <div class="title-content">
    <div class="title-brand"><span class="title-eyebrow">${t('title.eyebrow')}</span><h1 class="title-logo">GRIDBOUND</h1><div class="title-subtitle-wrap"><span class="title-flourish"></span><span>${t('title.subtitle')}</span><span class="title-flourish right"></span></div></div>
    <p class="title-press" aria-hidden="true">${t('title.press')}</p>
    <nav class="win title-menu menu-list" aria-label="${t('title.menu')}">
      <button id="title-enter" class="title-menu-item menu-item primary" type="button"><span class="menu-title">${t('title.enter')}</span><span class="menu-subtext">${t('title.enter.sub')}</span></button>
      <button id="title-profiles" class="title-menu-item menu-item" type="button"><span class="menu-title">${t('title.profiles')}</span><span class="menu-subtext">${t('title.profiles.sub')}</span></button>
      <button id="title-journal" class="title-menu-item menu-item" type="button"><span class="menu-title">${t('title.journal')}</span><span class="menu-subtext">${t('title.journal.sub')}</span></button>
      <button id="title-settings" class="title-menu-item menu-item" type="button"><span class="menu-title">${t('title.settings')}</span><span class="menu-subtext">${t('title.settings.sub')}</span></button>
    </nav>
    <div class="title-lang" role="group" aria-label="${t('settings.language')}">${(['en', 'id'] as Lang[]).map(code => `<button type="button" data-lang="${code}" aria-pressed="${lang() === code}">${code === 'en' ? 'English' : 'Indonesia'}</button>`).join('')}</div>
  </div>
  <footer class="title-footer"><div class="title-active-commander" id="title-commander-status"><b>${t('title.active')}</b> <span id="title-commander-name"></span></div><div class="title-meta-info"><span>© EMBERHOLLOW</span><span>v0.5</span></div></footer>`;
}
function showTitleScreen(animated = true) {
  const titleScreen = $('title-screen');
  if (!titleScreen) return;
  titleScreen.classList.remove('dismissing');
  titleScreen.hidden = false;
  updateTitleStatus();
  if (animated && profile.motion) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.fromTo('.title-logo', { opacity: 0, y: -30, scale: 1.4 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.6)' })
      .fromTo('.title-flourish', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'power3.out' }, '-=0.2')
      .fromTo('.title-menu', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, clearProps: 'transform' }, '-=0.1')
      .fromTo('.title-footer', { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'all' }, '-=0.2');
  }
  requestAnimationFrame(() => $('title-enter')?.focus({ preventScroll: true }));
}
function animateTownEntrance() {
  if (!profile.motion) return;
  const town = $('town-screen');
  if (!town || town.hidden) return;
  gsap.fromTo('.town-map', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out', clearProps: 'opacity' });
  gsap.fromTo('.camp-copy', { opacity: 0, y: 16 }, { opacity: 1, y: 0, delay: 0.25, duration: 0.3, ease: 'power2.out', clearProps: 'all' });
}
function enterEmberhollow() {
  const titleScreen = $('title-screen');
  if (!titleScreen || titleScreen.hidden) return;
  sound.unlock();
  sound.play('confirm');
  if (profile.motion) {
    const tl = gsap.timeline({
      onComplete: () => {
        titleScreen.hidden = true;
        titleScreen.classList.remove('dismissing');
        gsap.set([titleScreen, '.title-menu'], { clearProps: 'all' });
        animateTownEntrance();
      }
    });
    tl.to('#title-enter', { x: 8, duration: 0.08, yoyo: true, repeat: 1 })
      .to(titleScreen, { opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.12);
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
  const status = $('storage-status');
  const warning = saved.readOnly ? gameText(saved.warning) : commander.error ? gameText(commander.error) : commander.dirty ? t('storage.dirty') : '';
  status.textContent = warning || (!commander.document ? t('storage.none') : commander.busy ? t('storage.saving') : commander.repository?.persistent ? t('storage.saved', { n: commander.document.revision }) : t('storage.session'));
  status.dataset.level = warning || (commander.document && !commander.repository?.persistent) ? 'warn' : commander.busy ? 'busy' : 'ok';
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
/** Fate Rerolls bought for the current room; shifts the seed of the boon draft that follows it. */
let boonReroll = 0;
let offeredBoons: typeof BOONS = [];
let resumeOnClose = false;
let pauseForDetails = false;
type PartyHealthView = { button: HTMLButtonElement; hp: HTMLElement; shield: HTMLElement; cooldown: HTMLElement; healthFill: HTMLElement; shieldFill: HTMLElement; atb: HTMLElement };
type PartyHero = (typeof battle.heroes)[number];
const partyHealthViews = new Map<number, PartyHealthView[]>();
let resultGeneration: ResultGateGeneration | undefined;
const townState: TownState = {
  tab: 'camp', hero: 0, zone: Math.min(profile.cleared.length, CAMPAIGN.length - 1), raid: 'golem', raidTier: 'bronze', raidModifiers: [], raidBuild: createRaidBuild(profile.roster, Math.min(3, profile.roster.length, 6)), notice: '',
  trainingTab: 'formation', campaignPage: 0, questPage: 0, bestiaryPage: 0,
};

$('app').innerHTML = `
<section id="title-screen" class="title-screen" hidden>${titleMarkup()}</section>
<header class="site-header hud-bar">
  <button class="brand" id="home" aria-label="${t('hud.home')}"><span class="brand-back" aria-hidden="true">◀</span><span id="hud-title">${t('town.name')}</span></button>
  <div class="header-tools"><b id="wallet" class="wallet">${currencyAmount('gold', profile.gold)}</b><b id="bank-wallet" class="wallet bank-wallet">${currencyAmount('crystal', profile.economy.commanderCrystal)}</b><button id="sound" class="icon-button" aria-label="${t('hud.sound')}" aria-pressed="${profile.sound}">♫</button><button id="settings" class="icon-button" aria-label="${t('hud.settings')}">⚙</button><button id="menu-button" class="icon-button menu-button" data-facility="more" aria-label="${t('route.menu')}">${t('hud.menu')}</button></div>
</header>
  <main id="town-screen" class="town-screen"></main>
  <main id="battle-screen" class="game-layout" data-battle-view="arena" hidden>
    <div class="battle-top">
      <div class="battle-place"><b id="mode-label"></b><span id="encounter-label"></span></div>
      <nav class="battle-view-tabs" aria-label="${t('battle.views')}">
        <button type="button" data-battle-view="arena" aria-controls="battle-arena-panel" aria-pressed="true">${t('battle.view.arena')}</button>
        <button type="button" data-battle-view="hero" aria-controls="battle-details-panel" aria-pressed="false">${t('battle.view.hero')}</button>
        <button type="button" data-battle-view="log" aria-controls="battle-details-panel" aria-pressed="false">${t('battle.view.log')}</button>
      </nav>
      <div class="arena-heading-controls">
        <button id="combat-boons" class="icon-button combat-boons-btn" aria-label="${t('battle.boons')}" title="${t('battle.boons')} [B]">✦<span id="boon-count-badge" class="boon-count-badge" style="display:none">0</span></button>
        <button id="pause" class="icon-button" aria-label="${t('battle.pause')}">Ⅱ</button>
      </div>
    </div>
    <aside class="left-sidebar">
      <small id="expedition-label"></small>
      <h1 id="journey-title"></h1>
      <p class="intro-copy" id="journey-copy"></p>
      <ol id="stage-list" class="expedition-stages"></ol>
      <section class="run-boons"><h3>${t('battle.runboons')}</h3><div id="boon-list"></div></section>
      <section class="run-shop-panel"><h3>${t('shop.journey')}</h3><div id="run-shop-host"></div><small>${t('shop.journey.hint')}</small></section>
      <section class="field-guide"><button id="howto" class="btn">${t('battle.guide')}</button><button id="retreat" class="btn">${t('battle.retreat')}</button></section>
    </aside>
    <section id="battle-arena-panel" class="arena-column" aria-label="${t('battle.arena')}">
      <div class="threat-band" aria-label="${t('battle.enemy')}">
        <div class="win boss-hud">
          <div class="boss-hud-inner">
            <div class="boss-title"><h2 id="boss-name"></h2><span id="boss-title"></span><span id="phase" class="boss-phase-badge"></span></div>
            <div class="boss-meter"><div id="boss-hp-ghost" class="boss-hp-ghost"></div><div id="boss-hp"></div><div class="boss-phase-notch p1"></div><div class="boss-phase-notch p2"></div></div>
            <div class="stagger-row"><span id="boss-health"></span><span id="stagger-label">${t('battle.armor')}</span><div class="stagger-track"><i id="stagger"></i></div><span id="clock">00:00</span></div>
          </div>
        </div>
      </div>
      <div class="arena-slot">
      <div id="arena" class="arena">
        <div id="game-canvas"></div>
        <div id="intent" class="intent-panel msg-window" role="status" aria-live="polite"><b></b><span></span></div>
        <div id="banner" class="battle-banner" aria-live="polite"></div>
        <div class="lane-targets" aria-label="${t('battle.lanes')}">${[0, 1, 2].map(i => `<button data-lane="${i}" aria-label="${t('battle.lane', { n: i + 1 })}" aria-pressed="false"><span>${['I', 'II', 'III'][i]}</span></button>`).join('')}</div>
        <div id="unit-layer"></div>
        <div id="skill-picker" class="win skill-picker" role="dialog" hidden></div>
        <div class="board-bottom"><span id="standing"></span><span id="move-tip"></span></div>
        <section id="start-overlay" class="start-overlay" aria-labelledby="ready-title">
          <div class="win start-window">
            <small id="ready-label"></small>
            <h3 id="ready-title"></h3>
            <p id="ready-copy"></p>
            <button id="start" class="btn primary">${t('battle.begin')}</button>
          </div>
        </section>
      </div>
      </div>
      <button id="focus-bar" type="button" class="win focus-bar" aria-label="${t('battle.focus.aria')}"><img class="focus-face" alt=""/><span class="focus-id"><b class="focus-name"></b><small class="focus-skill"></small></span><span class="focus-stats"><span class="focus-hp">HP <b></b></span><span class="focus-status"></span></span></button>
      <div class="action-bar">
        <button id="guard" class="cmd guard-button"><span>${t('battle.guard')}<small id="guard-label"></small></span></button>
        <button id="potion" class="cmd potion-button"><span>${t('battle.potion')}<small id="potions"></small></span><b>2</b></button>
        <button id="ultimate" class="cmd ultimate-button" disabled><i id="resolve-fill"></i><span>${t('battle.ultimate')}<small id="resolve-label"></small></span></button>
      </div>
    </section>
    <aside id="battle-details-panel" class="right-sidebar">
      <p id="battle-detail-pause-note" class="msg-window battle-detail-pause-note" role="status" hidden>${t('battle.detailpause')} <button id="battle-detail-resume" class="btn" type="button">${t('battle.resume.arena')}</button></p>
      <section class="win battle-detail-panel battle-detail-health" aria-label="${t('battle.party')}"><h3 class="subheading">${t('battle.party')}</h3><div id="details-party-health-tray" class="party-health-tray"></div></section>
      <section id="battle-hero-panel" class="win battle-detail-panel"><h3 class="subheading">${t('battle.inspector')} <span id="party-size"></span></h3><div id="inspector"></div></section>
      <section id="battle-log-panel" class="win battle-detail-panel">
        <h3 class="subheading">${t('battle.log')}</h3><div id="combat-log"></div>
        <div class="session-stats"><div><small>${t('battle.stat.damage')}</small><b id="damage">0</b></div><div><small>${t('battle.stat.blocked')}</small><b id="blocked">0</b></div><div><small>${t('battle.stat.loot')}</small><b id="loot">0G</b></div></div>
      </section>
    </aside>
  </main>
  <main id="result-screen" class="result-screen" aria-labelledby="result-title" hidden></main>
  <footer id="storage-status" class="storage-status" role="status"></footer>
  <dialog id="modal" aria-labelledby="modal-title"></dialog>`;
const modal = $<HTMLDialogElement>('modal');
const resultScreen = $<HTMLElement>('result-screen');

function modeForTownTab(tab: TownTab, fallback = commander.mode): CommanderMode {
  if (tab === 'raid') return 'raid';
  if (tab === 'endless') return 'roguelike';
  if (tab === 'quests' || tab === 'dungeon') return 'story';
  if (tab === 'challenge-shop') return fallback === 'story' ? 'raid' : fallback;
  if (tab === 'camp' || tab === 'more' || tab === 'bestiary') return fallback;
  return 'story';
}

function showTown(tab: TownTab = townState.tab, notice = '', animate = false) {
  const routeChanged = tab !== townState.tab;
  const nextMode = modeForTownTab(tab);
  if (commander.document && nextMode !== commander.mode) {
    commander.mode = nextMode;
    commander.document.activeMode = nextMode;
    void persist();
  }
  inTown = true;
  pauseForDetails = false;
  if (battle.status === 'fighting') battle.pause();
  townState.tab = tab;
  townState.notice = notice;
  $('town-screen').hidden = false;
  $('battle-screen').hidden = true;
  document.body.dataset.screen = tab === 'camp' ? 'camp' : 'town';
  $('hud-title').textContent = routeTitle(tab);
  $('home').setAttribute('aria-label', tab === 'camp' ? t('menu.title.sub') : t('hud.home'));
  // Keep the scroll position when a panel re-renders in place (equipping, inspecting, learning).
  const oldPanel = $('town-screen').querySelector<HTMLElement>('[data-training-panel]');
  const keptScroll = !routeChanged && oldPanel ? { panel: oldPanel.dataset.trainingPanel, top: oldPanel.scrollTop } : undefined;
  renderTown($('town-screen'), profile, townState);
  const newPanel = $('town-screen').querySelector<HTMLElement>('[data-training-panel]');
  if (newPanel && keptScroll && newPanel.dataset.trainingPanel === keptScroll.panel) newPanel.scrollTop = keptScroll.top;
  if (routeChanged) {
    const scene = $('town-screen').querySelector<HTMLElement>('.town-scene');
    const heading = scene?.querySelector<HTMLElement>('h1') ?? scene;
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
  persist();
  if (animate && profile.motion) {
    if (tab === 'camp') animateTownEntrance();
    else {
      const panel = document.querySelector<HTMLElement>('.town-scene');
      if (panel) gsap.fromTo(panel, { opacity: 0.6 }, { opacity: 1, duration: 0.2, ease: 'power2.out', clearProps: 'opacity' });
    }
    if (tab === 'party' || tab === 'party-advanced') animateMirrorTalents();
    else if (tab === 'bestiary') animateCodexEntry();
    else if (tab === 'quests') animateProphecies();
    else if (tab === 'challenge-shop') animateChallengeShop();
    else if (tab === 'raid') animatePactRaid();
    else if (tab === 'endless') animateSunkenDescent();
  }
}
$('town-screen').addEventListener('click', event => {
  if (modal.open) modal.close();
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button || button.disabled || !inTown || commander.stale || pendingSettlement) return;
  sound.unlock();
  if (button.dataset.openAction) {
    if (button.dataset.openAction === 'journal') void storyJournal();
    else if (button.dataset.openAction === 'profiles') void profilesMenu();
    else if (button.dataset.openAction === 'settings') settings();
    else if (button.dataset.openAction === 'title') showTitleScreen();
    return;
  }
  if (button.dataset.storyToggle !== undefined) {
    const id=Number(button.dataset.storyToggle);
    const ids=profile.storyActive.includes(id)?profile.storyActive.filter(hero=>hero!==id):[...profile.storyActive,id];
    const ok=setStoryParty(profile,ids);
    showTown('party',ok?t('notice.story.saved'):t('notice.story.invalid'), true);
    return;
  }
  if (button.dataset.dungeonStart) {
    const depth = Number(button.dataset.dungeonStart);
    if (profile.journey.run?.status === 'active') return;
    profile.journey.run = startRun(depth, Math.floor(Math.random() * 1e9), normalizeStoryParty(profile.storyActive, profile.roster, profile.cleared));
    townState.dungeonOutcome = undefined; sound.play('confirm');
    showTown('dungeon', '', true);
    return;
  }
  if (button.dataset.dungeonNode && profile.journey.run) {
    if (enterNode(profile.journey.run, Number(button.dataset.dungeonNode))) { townState.dungeonOutcome = undefined; sound.play('cursor'); showTown('dungeon'); }
    return;
  }
  if (button.hasAttribute('data-dungeon-fight')) { startDungeonFight(); return; }
  if (button.dataset.dungeonChoice && profile.journey.run) {
    const out = chooseEvent(profile.journey.run, button.dataset.dungeonChoice);
    if (out) { townState.dungeonOutcome = describeOutcome(out); sound.play(out.fight ? 'threat' : out.hurt ? 'hurt' : 'buff'); showTown('dungeon'); }
    return;
  }
  if (button.hasAttribute('data-dungeon-open') && profile.journey.run) {
    const out = openTreasure(profile.journey.run);
    if (out) { townState.dungeonOutcome = describeOutcome(out); sound.play('coin'); showTown('dungeon'); }
    return;
  }
  if (button.dataset.dungeonCamp && profile.journey.run) {
    const run = profile.journey.run, choice = button.dataset.dungeonCamp as 'rest' | 'extract';
    if (campChoice(run, choice)) {
      if (choice === 'extract') bankPouch(profile, run.pouch);
      townState.dungeonOutcome = choice === 'rest' ? t('dungeon.out.rest') : undefined;
      sound.play(choice === 'rest' ? 'heal' : 'fanfare');
      showTown('dungeon');
    }
    return;
  }
  if (button.hasAttribute('data-dungeon-leave')) {
    openModal(`<h2 id="modal-title">${t('dungeon.leave.title')}</h2><p>${t('dungeon.leave.copy')}</p><button id="dungeon-abandon" class="btn danger">${t('dungeon.leave.yes')}</button><button class="btn" data-close>${t('common.cancel')}</button>`);
    $('dungeon-abandon').addEventListener('click', () => { modal.close(); delete profile.journey.run; showTown('dungeon'); });
    return;
  }
  if (button.hasAttribute('data-dungeon-close')) { delete profile.journey.run; townState.dungeonOutcome = undefined; showTown('dungeon'); return; }
  if (button.hasAttribute('data-star-chest')) {
    const reward = claimStarChest(profile);
    if (reward) { sound.play('fanfare'); showTown(townState.tab, t('stars.chest.got', { gold: reward.gold, mat: materialList(reward.materials) })); }
    return;
  }
  if (button.dataset.heroic !== undefined) { townState.heroic = button.dataset.heroic === '1'; showTown(townState.tab); return; }
  if (button.dataset.refine) {
    const ok = refineGear(profile, townState.hero, button.dataset.refine);
    const level = profile.loadouts[townState.hero]?.refine?.[button.dataset.refine] ?? 0;
    showTown('party', ok ? t('notice.refine.ok', { n: level }) : t('notice.refine.fail'), true);
    if (ok) celebrate(`[data-gear-open], .hero-sheet`);
    return;
  }
  if (button.dataset.facility) {
    townState.pendingGear = undefined;
    void navigateTown(button.dataset.facility as TownTab);
    return;
  }
  if (button.dataset.talent) {
    const id = button.dataset.talent;
    const ok = buyTalent(profile, townState.hero, id);
    showTown('party-advanced', ok ? t('notice.talent.ok') : t('notice.talent.fail'), true);
    if (ok) celebrate(`[data-inspect-talent="${id}"], [data-talent="${id}"], .hero-sheet`);
    return;
  }
  if (button.dataset.gearOpen) {
    townState.gearSlot = button.dataset.gearOpen as TownState['gearSlot'];
    townState.pendingGear = undefined;
    townState.trainingTab = 'gear';
    showTown('party', '', true);
    return;
  }
  if (button.dataset.gearItem) {
    const slot = button.dataset.gearSlotFor as 'weapon' | 'armor' | 'charm';
    townState.gearSlot = slot;
    townState.trainingTab = 'gear';
    townState.pendingGear = { hero: townState.hero, slot, gearId: button.dataset.gearItem };
    showTown('party', '', true);
    document.querySelector('[data-gear-preview]')?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (button.dataset.equipSkill !== undefined) {
    const ok = equipSkill(profile, townState.hero, Number(button.dataset.skillSlot), Number(button.dataset.equipSkill));
    showTown('party', ok ? t('notice.loadout') : '', true);
    if (ok) celebrate(`[data-loadout-slot="${button.dataset.skillSlot}"]`);
    return;
  }
  if (button.dataset.inspectTalent) {
    townState.selectedTalent = button.dataset.inspectTalent;
    showTown('party-advanced');
    return;
  }
  if (button.dataset.branch) { townState.talentBranch = button.dataset.branch; townState.selectedTalent = undefined; showTown('party-advanced', '', true); return; }
  if (button.dataset.trainingTab) {
    townState.trainingTab = button.dataset.trainingTab as TownState['trainingTab'];
    townState.tab = button.dataset.trainingTab === 'overview' || button.dataset.trainingTab === 'jobs' || button.dataset.trainingTab === 'talents' ? 'party-advanced' : 'party';
    showTown(townState.tab, '', true);
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
    showTown(townState.tab === 'party-advanced' ? 'party-advanced' : 'party', '', true);
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
  if (button.dataset.zone || button.dataset.mission) {
    townState.zone = Number(button.dataset.zone ?? button.dataset.mission);
    townState.campaignPage = townState.zone;
    sound.clink();
    showTown('mission', '', true);
    return;
  }
  if (button.dataset.raid) { townState.raid = button.dataset.raid; townState.raidSandbox = undefined; showTown('raid', '', true); return; }
  if (button.dataset.bankBuy) {
    const item = buyChallengeUnlock(profile, button.dataset.bankBuy);
    showTown(townState.tab, item ? t('notice.bank.ok', { name: item.name }) : t('notice.bank.fail'));
    return;
  }
  if (button.dataset.runBuy) {
    const item = buyForRun(button.dataset.runBuy);
    if (item && inTown) showTown(townState.tab, t('notice.run.ok', { name: item.name }));
    return;
  }
  if (button.hasAttribute('data-confirm-gear')) {
    const pending = townState.pendingGear;
    if (pending && pending.hero === townState.hero && pending.gearId) {
      const ok = equipGear(profile, pending.hero, pending.gearId);
      townState.pendingGear = undefined;
      showTown('party', ok ? t('notice.gear.ok') : t('notice.gear.fail'));
      if (ok) celebrate(`[data-gear-open="${pending.slot}"], .hero-sheet`);
    }
    return;
  }
  if (button.hasAttribute('data-cancel-gear')) {
    townState.pendingGear = undefined;
    showTown('party');
    return;
  }
  if (button.dataset.promote) { const job=button.dataset.promote;const ok=promote(profile,townState.hero,job);showTown('party-advanced',ok?t('notice.job.ok'):t('notice.job.fail'));if(ok)celebrate(`[data-promote="${job}"], .hero-sheet`); }

  if (button.dataset.formation) {
    moveFormation(profile, townState.hero, Number(button.dataset.formation));
    showTown('party', t('notice.formation'));
  }
  if (button.hasAttribute('data-respec')) {
    const reset = respecHero(profile, townState.hero);
    showTown('party-advanced', reset
      ? t('notice.respec.ok')
      : t('notice.respec.fail'));
  }
  if(button.dataset.claimQuest){
    const questId = button.dataset.claimQuest;
    const q=QUESTS.find(q=>q.id===questId);
    const ok=claimQuest(profile,questId,townState.hero);
    showTown('quests',ok?t('notice.quest.ok', { name: ROSTER[q?.heroId??townState.hero].name }):t('notice.quest.fail'), true);
    if (ok && profile.motion) {
      const entry = document.querySelector<HTMLElement>(`[data-quest="${questId}"]`);
      if (entry) gsap.fromTo(entry, { scale: 0.96, filter: 'brightness(1.5)' }, { scale: 1, filter: 'brightness(1)', duration: 0.35, ease: 'back.out(2)', clearProps: 'transform,filter' });
    }
  }
  if(button.dataset.trackQuest){const q=QUESTS.find(q=>q.id===button.dataset.trackQuest);if(q&&questProgress(profile,q).unlocked){profile.trackedQuest=q.id;showTown('quests',t('notice.quest.track'));}}
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
    showTown('raid',ok?t('notice.raid.party.ok'):t('notice.raid.party.fail'));return;
  }
  if(el.matches('[data-raid-job]')){
    const build=(townState.raidBuild&&normalizeRaidBuild(townState.raidBuild,profile.roster))??createRaidBuild(profile.roster,Math.min(3,profile.roster.length,6));
    const ok=setRaidJob(build,Number(el.dataset.raidJob),el.value);
    if(ok)townState.raidBuild=build;
    showTown('raid',ok?t('notice.raid.job.ok'):t('notice.raid.job.fail'));return;
  }
  if(el.matches('[data-raid-sandbox]')){
    const input=el as unknown as HTMLInputElement;
    const key=input.dataset.raidSandbox as keyof RaidSandbox;
    const current=townState.raidSandbox??{hpScale:1,damageScale:1,intervalScale:1};
    townState.raidSandbox={...current,[key]:Number(input.value)};
    showTown('raid',t('notice.raid.sandbox'));return;
  }
});
function materialList(materials: Record<string, number>) {
  return Object.entries(materials).filter(([, n]) => n > 0).map(([id, n]) => `${t(`material.${id}` as never)} ×${n}`).join(', ');
}
function describeOutcome(out: Outcome): string {
  const parts: string[] = [];
  if (out.fight) parts.push(t('dungeon.out.fight'));
  if (out.lore) parts.push(t('dungeon.out.lore'));
  if (out.heal) parts.push(t('dungeon.out.heal', { n: Math.round(out.heal * 100) }));
  if (out.hurt) parts.push(t('dungeon.out.hurt', { n: Math.round(out.hurt * 100) }));
  if (out.gold && out.gold > 0) parts.push(t('dungeon.out.gold', { n: out.gold }));
  if (out.gold && out.gold < 0) parts.push(t('dungeon.out.spent', { n: -out.gold }));
  for (const [id, n] of Object.entries(out.materials ?? {})) parts.push(t('dungeon.out.material', { n, name: t(`material.${id}` as never) }));
  if (out.power) parts.push(t('dungeon.out.power', { n: Math.round(out.power * 100) }));
  if (out.vitality) parts.push(t('dungeon.out.vitality', { n: Math.round(out.vitality * 100) }));
  if (out.potion) parts.push(t('dungeon.out.potion'));
  return parts.join(' ') || t('dungeon.out.nothing');
}
/** Fight the pending dungeon room with the party's carried HP, potions and blessings. */
function startDungeonFight() {
  const run = profile.journey.run, fight = run?.pendingFight;
  if (!run || !fight || run.status !== 'active') return;
  const scale = fightScale(run, fight.kind);
  commander.mode = 'story';
  runBoons = [];
  boot('dungeon', scale.chapter, { enemyId: fight.enemy, dungeon: { chapter: scale.chapter, hp: scale.hp, damage: scale.damage, xp: dungeonXP(run, fight.kind), startHp: { ...run.hp }, potions: run.potions, power: run.blessing.power, vitality: run.blessing.vitality } });
}
// Upgrade feedback: the changed element pops and the level-up jingle plays.
function celebrate(selector: string) {
  sound.play('levelup');
  document.querySelectorAll<HTMLElement>(selector).forEach(el => { el.classList.remove('just-upgraded'); void el.offsetWidth; el.classList.add('just-upgraded'); });
}

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

let playingScene = false;
const INTRO_KEY = 'gridbound.introsSeen';
/** Intros already shown in this browser; kept outside the save so retries after a defeat go straight to battle. */
function introSeen(zone: number) { try { return (JSON.parse(localStorage.getItem(INTRO_KEY) ?? '[]') as number[]).includes(zone); } catch { return false; } }
function markIntroSeen(zone: number) { try { const seen = JSON.parse(localStorage.getItem(INTRO_KEY) ?? '[]') as number[]; if (!seen.includes(zone)) localStorage.setItem(INTRO_KEY, JSON.stringify([...seen, zone])); } catch { /* storage blocked */ } }
/** Chapter intro as a JRPG scene: title card, then the speaker's lines in a message box. */
function chapterIntro(zoneIndex: number) {
  const zone = CAMPAIGN[zoneIndex];
  const [name, place] = zone.speaker.split(' · ');
  const hero = ROSTER.find(r => r.name.toUpperCase() === name?.trim().toUpperCase());
  const pages = paginate(zone.intro).map(text => ({ speaker: name?.trim(), place: place?.trim(), portrait: hero ? portrait(hero.classId) : undefined, text }));
  playingScene = true;
  return playDialogue($('app'), { kicker: t('battle.chapter', { n: zoneIndex + 1 }), title: zone.name, subtitle: zone.subtitle, backdrop: actArt(Math.floor(zoneIndex / 4)), pages, motion: profile.motion, onBlip: () => sound.play('text') })
    .finally(() => { playingScene = false; markIntroSeen(zoneIndex); });
}
let recruitedIds: number[] = [];
/** A short scene for a hero joining: their portrait and first words. */
function recruitScene(id: number, force = false) {
  const hero = CHARACTERS[id];
  // Skipped under automation like the title screen and chapter intros; QA plays it through window.gridbound.recruitScene.
  if (!hero || (!force && navigator.webdriver)) return Promise.resolve();
  playingScene = true;
  return playDialogue($('app'), { kicker: t('recruit.kicker'), title: t('recruit.title', { name: hero.name }), subtitle: KITS[hero.classId].name, backdrop: actArt(Math.min(3, Math.floor(hero.recruitChapter / 4))), pages: [{ speaker: hero.name, portrait: portrait(hero.classId), text: hero.joinLine }], motion: profile.motion, onBlip: () => sound.play('text') })
    .finally(() => { playingScene = false; });
}
function depart(mode: Mode) {
  if (playingScene) return;
  commander.mode = mode === 'raid' ? 'raid' : mode === 'endless' ? 'roguelike' : 'story';
  if (commander.document) commander.document.activeMode = commander.mode;
  if (mode === 'adventure' && !canEnterZone(profile, townState.zone)) return;
  const existing = commander.document?.encounters?.[commander.mode];
  if (existing && !existing.settled) { restoreEncounter(existing); return; }
  const firstVisit = mode === 'adventure' && !profile.cleared.includes(townState.zone) && !introSeen(townState.zone);
  if (firstVisit && typeof navigator !== 'undefined' && !navigator.webdriver) { sound.unlock(); void chapterIntro(townState.zone).then(() => startDeparture(mode)); return; }
  startDeparture(mode);
}
function startDeparture(mode: Mode) {
  runBoons = [];
  resetRunWallet(runWallet);
  runWallet = createRunWallet();
  runSeed = Date.now() % 1000000;
  const heroic = mode === 'adventure' && townState.heroic === true && profile.cleared.includes(townState.zone);
  boot(mode, mode === 'adventure' ? townState.zone + 1 : mode === 'raid' ? profile.cleared.length+1 : 1, mode === 'endless' ? { rogueBuild: structuredClone(townState.rogueSetup ?? createRogueBuild()) } : heroic ? { heroic: true } : {});
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
  pauseForDetails = false;
  $('battle-screen').dataset.battleView = 'arena';
  document.querySelectorAll<HTMLButtonElement>('.battle-view-tabs [data-battle-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.battleView === 'arena')));
  $('battle-detail-pause-note').hidden = true;
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
    ...(mode === 'adventure' || mode === 'dungeon' ? storyBattleOptions(profile) : {}),
  });
  recorded = false;
  experienceRewards=[];
  offeredBoons = [];
  lastStatus = 'ready';
  moveMode = false;
  touches.clear();
  if (initialized) { scene.dragId = -1; scene.dragPoint = undefined; scene.hoverSlot = -1; scene.replace(battle); }
  const fromTown = !$('town-screen').hidden;
  $('town-screen').hidden = true;
  $('battle-screen').hidden = false;
  document.body.dataset.screen = 'battle';
  if (fromTown) battleWipe();
  makeUnits();
  updateExpedition();
  showReady();
  $('combat-log').textContent = '';
  addLog(t('log.ready'));
  document.querySelectorAll<HTMLElement>('[data-lane]').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-pressed', 'false'); });
  frame(1);
  requestAnimationFrame(() => scene.scale?.refresh());
  $('battle-screen').scrollTop = 0;
}
/** Spend journey Crystal on a run item and apply its effect to the current battle. */
function buyForRun(id: string) {
  const item = buyRunItem(runWallet, id);
  if (!item) return undefined;
  // Bought before the room starts: heroes are at full HP, so the shard wards instead of healing.
  if (item.id === 'run-heal') battle.heroes.forEach(hero => { if (hero.hp > 0) hero.shield = Math.max(hero.shield, Math.round(hero.maxHp * .3)); });
  if (item.id === 'run-upgrade') battle.power *= 1.15;
  if (item.id === 'run-reroll') boonReroll++;
  sound.play('coin');
  updateExpedition();
  frame(1);
  return item;
}
/** Classic encounter transition: the screen shatters into blocks that fall away from the centre. */
function battleWipe() {
  sound.play('encounter');
  if (!profile.motion) return;
  const cols = 8, rows = 14, wipe = document.createElement('div');
  wipe.className = 'battle-wipe';
  wipe.setAttribute('aria-hidden', 'true');
  wipe.innerHTML = Array.from({ length: cols * rows }, (_, i) => { const x = i % cols, y = Math.floor(i / cols), d = Math.hypot(x - (cols - 1) / 2, (y - (rows - 1) / 2) * .6); return `<i style="animation-delay:${Math.round(d * 45)}ms"></i>`; }).join('');
  $('app').append(wipe);
  window.setTimeout(() => wipe.remove(), 900);
}
function updateExpedition() {
  const c = CAMPAIGN[battle.floor - 1];
  $('loot').textContent = battle.mode === 'endless' ? `${runWallet.crystal} ◇` : battle.mode === 'raid' ? (battle.raidContract?.sandbox ? t('raid.sandbox.short') : t(`raid.tier.${battle.raidContract?.tier ?? 'bronze'}` as never)) : `${battle.gold}G`;
  const runShopHost = document.getElementById('run-shop-host');
  if (runShopHost) runShopHost.innerHTML = battle.mode === 'endless' && battle.status === 'ready' ? CHALLENGE_SHOP.map(item => `<button class="btn" data-run-buy="${item.id}" ${runWallet.crystal < item.cost ? 'disabled' : ''}>${item.name} · ${item.cost} ◇</button>`).join('') : '';
  $('mode-label').textContent = battle.mode === 'adventure' ? `${battle.heroic ? `${t('heroic.badge')} · ` : ''}${t('battle.chapter', { n: battle.floor })}` : battle.mode === 'endless' ? t('battle.floor', { n: battle.floor }) : battle.mode === 'dungeon' ? t('dungeon.depth.label', { n: profile.journey.run?.depth ?? 1 }) : t('mode.raid');
  $('encounter-label').textContent = stageLabel();
  $('boss-name').textContent = battle.enemyName;
  $('boss-title').textContent = battle.enemyTitle;
  $('expedition-label').textContent = battle.mode === 'adventure' ? t('mode.campaign') : battle.mode === 'endless' ? t('route.endless') : battle.mode === 'dungeon' ? t('route.dungeon') : t('mode.raid');
  $('journey-title').textContent = battle.mode === 'adventure' ? c.name : battle.mode === 'endless' ? t('route.endless') : battle.enemyName;
  $('journey-copy').textContent = battle.mode === 'adventure' ? c.subtitle : t('battle.journey.copy');
  $('stage-list').innerHTML = battle.mode === 'adventure' ? c.stages.map((s, i) => `<li class="${i === battle.stage ? 'current' : i < battle.stage ? 'completed' : ''}"><small>${t('map.wave', { n: i + 1 })}</small> <span>${s.name}</span></li>`).join('') : '';
  $('boon-list').innerHTML = runBoons.length ? runBoons.map(id => { const b = BOONS.find(b => b.id === id)!; return `<p><b>${b.name}</b><small>${b.description}</small></p>`; }).join('') : `<p class="hint">${t('battle.noboons')}</p>`;
  const boonBadge = $('boon-count-badge');
  if (boonBadge) {
    boonBadge.textContent = String(runBoons.length);
    boonBadge.style.display = runBoons.length > 0 ? 'inline-block' : 'none';
  }
}
function showReady() {
  $('start-overlay').hidden = false;
  $('ready-label').textContent = battle.stageCount > 1 ? `${t('map.wave', { n: battle.stage + 1 })}/${battle.stageCount} · ${stageLabel()}` : stageLabel();
  $('ready-title').textContent = battle.stage > 0 ? t('ready.title.next') : t('ready.title.first', { name: battle.enemyName });
  const beat = battle.mode === 'adventure' ? CAMPAIGN[battle.floor - 1]?.stages[battle.stage]?.beat : undefined;
  $('ready-copy').textContent = beat ?? (battle.stage > 0 ? t('ready.copy.next') : battle.mode === 'adventure' ? t('ready.copy.story') : t('ready.copy.other'));
  $('ready-copy').classList.toggle('story-beat', Boolean(beat));
  $('start').textContent = t('battle.begin');
  if (profile.motion) {
    gsap.fromTo('#start-overlay .start-window', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,transform' });
  }
}
async function begin() {
  if (inTown) return;
  if (commander.stale || pendingSettlement) return;
  if (['victory', 'defeat'].includes(battle.status)) { result(); return; }
  encounter = makeEncounter();
  sound.unlock();
  battle.start();
  $('start-overlay').hidden = true;
  scene.encounterStart();
  addLog(t('log.begin'));
  void ensureCommander().then(() => commander.flush()).then(() => checkpoint(true));
}

function renderPartyHealthTray() {
  partyHealthViews.clear();
  for (const trayId of ['details-party-health-tray']) {
    const host = $(trayId);
    host.dataset.count = String(battle.heroes.length);
    host.innerHTML = battle.heroes.map(h => `<button type="button" class="party-health-card" data-party-hero="${h.id}" aria-pressed="false" aria-label="${heroName(h)}">
      <img class="party-face" src="${portrait(h.classId)}" alt=""/>
      <span class="party-hero-name">${heroName(h)}</span>
      <span class="party-health-values"><span class="party-hp"><small>HP</small> <b class="party-hp-value">${Math.ceil(h.hp)}</b><small>/${h.maxHp}</small></span><span class="party-sh">SH <b class="party-shield-value">${Math.round(h.shield)}</b></span></span>
      <span class="party-health-meter" aria-hidden="true"><i></i><em></em></span>
      <span class="party-atb" aria-hidden="true"><i></i></span><span class="party-cooldown"></span>
    </button>`).join('');
    host.querySelectorAll<HTMLButtonElement>('[data-party-hero]').forEach(button => {
      const id = Number(button.dataset.partyHero);
      const views = partyHealthViews.get(id) ?? [];
      views.push({
        button,
        hp: button.querySelector<HTMLElement>('.party-hp-value')!,
        shield: button.querySelector<HTMLElement>('.party-shield-value')!,
        cooldown: button.querySelector<HTMLElement>('.party-cooldown')!,
        healthFill: button.querySelector<HTMLElement>('.party-health-meter i')!,
        shieldFill: button.querySelector<HTMLElement>('.party-health-meter em')!,
        atb: button.querySelector<HTMLElement>('.party-atb i')!,
      });
      partyHealthViews.set(id, views);
      button.addEventListener('click', () => {
        battle.selected = id;
        renderInspector();
      });
    });
  }
}
function updatePartyHealthView(h: PartyHero) {
  const views = partyHealthViews.get(h.id);
  if (!views) return;
  const ratio = h.maxHp > 0 ? Math.min(1, Math.max(0, h.hp / h.maxHp)) : 0;
  const hp = Math.ceil(h.hp);
  const shield = Math.round(h.shield);
  const cooldownSeconds = h.remaining > 0 ? Math.max(.1, h.remaining).toFixed(1) : '';
  const charge = h.total > 0 ? Math.min(1, Math.max(0, 1 - h.remaining / h.total)) : 1;
  const status = h.hp <= 0 ? t('battle.down') : cooldownSeconds ? `${cooldownSeconds}s` : t('battle.ready');
  for (const view of views) {
    view.hp.textContent = String(hp);
    view.shield.textContent = String(shield);
    view.cooldown.textContent = status;
    view.healthFill.style.width = `${ratio * 100}%`;
    view.shieldFill.style.width = `${Math.min(1, Math.max(0, h.shield / Math.max(1, h.maxHp))) * 100}%`;
    view.atb.style.width = `${h.hp > 0 ? charge * 100 : 0}%`;
    view.button.classList.toggle('downed', h.hp <= 0);
    view.button.classList.toggle('low-health', h.hp > 0 && ratio <= .35);
    view.button.classList.toggle('charged', h.hp > 0 && charge > .97);
    view.button.setAttribute('aria-pressed', String(h.id === battle.selected));
    view.button.setAttribute('aria-label', t('battle.hero.aria', { name: heroName(h), hp, max: h.maxHp, shield, status }));
  }
}
function makeUnits() {
  $('unit-layer').innerHTML = battle.heroes.map(h => {
    const p = cell(h.slot);
    return `<div class="unit-card" data-hero="${h.id}" style="left:${p.x / 6}%;top:${p.y / 7.6}%;width:24%;height:${UNIT_H / 7.6}%;--class-color:${KITS[h.classId].color}"><button class="unit-tap" data-tap="${h.id}" aria-label="${t('battle.tap.aria', { name: heroName(h) })}"><span class="unit-name">${heroName(h)}</span><span class="tap-flash">${t('battle.tempo')}</span></button><span class="unit-hp" aria-hidden="true"><i></i><em></em></span><button type="button" class="unit-skill" data-skill-switch="${h.id}"><i class="unit-skill-fill"></i><span class="unit-skill-name"></span><span class="unit-skill-icon" aria-hidden="true"></span></button></div>`;
  }).join('');
  unitViews.clear();
  for (const h of battle.heroes) {
    const card = document.querySelector<HTMLElement>(`#unit-layer [data-hero="${h.id}"]`)!;
    const skill = card.querySelector<HTMLButtonElement>('.unit-skill')!;
    unitViews.set(h.id, { card, hp: card.querySelector('.unit-hp i')!, shield: card.querySelector('.unit-hp em')!, skill, fill: skill.querySelector('.unit-skill-fill')!, name: skill.querySelector('.unit-skill-name')!, icon: skill.querySelector('.unit-skill-icon')!, key: '' });
    skill.addEventListener('click', event => { event.stopPropagation(); switchSkill(h.id); });
  }
  closeSkillPicker();
  $('unit-layer').querySelectorAll<HTMLElement>('[data-tap]').forEach(el => bindPointer(el, Number(el.dataset.tap)));
  renderPartyHealthTray();
  $('party-size').textContent = `${battle.heroes.length}`;
  selectedKey = '';
  renderInspector();
}
// A unit card spans its 112px cell plus most of the row gap, so the skill chip sits under the portrait.
const UNIT_H = 122;
type UnitView = { card: HTMLElement; hp: HTMLElement; shield: HTMLElement; skill: HTMLButtonElement; fill: HTMLElement; name: HTMLElement; icon: HTMLElement; key: string };
const unitViews = new Map<number, UnitView>();
function updateUnitView(h: PartyHero) {
  const view = unitViews.get(h.id);
  if (!view) return;
  const ratio = h.maxHp > 0 ? Math.min(1, Math.max(0, h.hp / h.maxHp)) : 0;
  const charge = h.total > 0 ? Math.min(1, Math.max(0, 1 - h.remaining / h.total)) : 1;
  const skills = battle.availableSkills(h.id);
  const canSwitch = h.hp > 0 && skills.length > 1 && ['ready', 'fighting'].includes(battle.status);
  view.hp.style.width = `${ratio * 100}%`;
  view.shield.style.width = `${Math.min(1, Math.max(0, h.shield / Math.max(1, h.maxHp))) * 100}%`;
  view.fill.style.width = `${h.hp > 0 ? charge * 100 : 0}%`;
  view.card.classList.toggle('low-health', h.hp > 0 && ratio <= .35);
  view.card.classList.toggle('charged', h.hp > 0 && charge > .97);
  const key = `${h.stance}-${skills.length}-${canSwitch}-${h.hp > 0}`;
  if (key === view.key) return;
  if (view.key && view.key.split('-')[0] !== String(h.stance)) { view.card.classList.remove('switched'); void view.card.offsetWidth; view.card.classList.add('switched'); }
  view.key = key;
  const skill = KITS[h.classId].skills[h.stance];
  view.name.textContent = skill.name;
  view.icon.textContent = skills.length > 2 ? '▾' : '⇄';
  view.skill.disabled = !canSwitch;
  view.skill.setAttribute('aria-label', t('battle.skill.switch', { name: heroName(h), skill: skill.name }));
  view.skill.setAttribute('aria-haspopup', String(skills.length > 2));
}
function switchSkill(id: number) {
  const h = battle.hero(id);
  if (!h || h.hp <= 0 || inTown) return;
  const skills = battle.availableSkills(id);
  if (skills.length < 2) return;
  if (skills.length === 2) { closeSkillPicker(); cycleSkill(id); return; }
  if (pickerHero === id) { closeSkillPicker(); return; }
  openSkillPicker(id);
}
let pickerHero = -1;
function openSkillPicker(id: number) {
  const h = battle.hero(id);
  if (!h) return;
  const kit = KITS[h.classId];
  battle.selected = id;
  pickerHero = id;
  const picker = $('skill-picker');
  picker.setAttribute('aria-label', t('battle.skill.choose', { name: heroName(h) }));
  picker.innerHTML = `<h4>${t('battle.skill.choose', { name: heroName(h) })}</h4>${battle.availableSkills(id).map(i => { const s = kit.skills[i]; return `<button type="button" data-pick-skill="${i}" aria-pressed="${h.stance === i}"><span><b>${s.name}</b><small>${s.label}</small></span><em>${s.cooldown.toFixed(1)}s</em></button>`; }).join('')}`;
  const p = cell(h.slot);
  const width = Math.max(180, $('arena').clientWidth * .52) / $('arena').clientWidth * 100;
  picker.style.left = `${Math.min(98 - width, Math.max(2, (p.x + 72) / 6 - width / 2))}%`;
  picker.style.bottom = `${Math.min(70, (760 - p.y - 70) / 7.6)}%`;
  picker.hidden = false;
  picker.querySelectorAll<HTMLButtonElement>('[data-pick-skill]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    withDetailsPausedAction(() => battle.stance(id, Number(button.dataset.pickSkill)));
    sound.unlock();
    closeSkillPicker();
    renderInspector();
    frame(1);
  }));
  picker.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  renderInspector();
}
function closeSkillPicker() {
  pickerHero = -1;
  const picker = document.getElementById('skill-picker');
  if (picker) { picker.hidden = true; picker.innerHTML = ''; }
}
document.addEventListener('pointerdown', event => {
  if (pickerHero === -1) return;
  const target = event.target as HTMLElement;
  if (!target.closest('#skill-picker') && !target.closest('.unit-skill')) closeSkillPicker();
}, true);
function updateFocusBar() {
  const h = battle.hero(battle.selected);
  const bar = document.getElementById('focus-bar');
  if (!h || !bar) return;
  const ratio = h.maxHp > 0 ? h.hp / h.maxHp : 0;
  const skill = KITS[h.classId].skills[h.stance];
  const status = h.hp <= 0 ? t('battle.down') : h.remaining > 0 ? `${Math.max(.1, h.remaining).toFixed(1)}s` : t('battle.ready');
  const face = bar.querySelector<HTMLImageElement>('.focus-face')!;
  const src = portrait(h.classId);
  if (face.getAttribute('src') !== src) face.setAttribute('src', src);
  bar.querySelector('.focus-name')!.textContent = `${heroName(h)} · LV ${h.level}`;
  bar.querySelector('.focus-skill')!.textContent = skill.name;
  bar.querySelector('.focus-hp b')!.textContent = `${Math.ceil(Math.max(0, h.hp))}/${h.maxHp}${h.shield > 0 ? ` +${Math.round(h.shield)}` : ''}`;
  bar.querySelector('.focus-status')!.textContent = status;
  bar.classList.toggle('low-health', h.hp > 0 && ratio <= .35);
  bar.classList.toggle('downed', h.hp <= 0);
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
function setBattleView(view: 'arena' | 'hero' | 'log') {
  if (view !== 'arena' && battle.status === 'fighting') {
    battle.pause();
    pauseForDetails = true;
  } else if (view === 'arena' && pauseForDetails && battle.status === 'paused') {
    battle.pause();
    pauseForDetails = false;
  }
  $('battle-screen').dataset.battleView = view;
  document.querySelectorAll<HTMLButtonElement>('.battle-view-tabs [data-battle-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.battleView === view)));
  $('battle-detail-pause-note').hidden = !pauseForDetails || view === 'arena';
  if (view === 'hero') renderInspector();
  frame(1);
}
function cycleSkill(id: number, direction = 1) {
  const h = battle.hero(id);
  if (!h) return;
  const skills = battle.availableSkills(id);
  battle.selected = id;
  withDetailsPausedAction(() => battle.stance(id, skills[(skills.indexOf(h.stance) + direction + skills.length) % skills.length]));
  sound.unlock();
  renderInspector();
  frame(1);
}
function withDetailsPausedAction<T>(action: () => T): T {
  const restorePause = pauseForDetails && battle.status === 'paused';
  if (restorePause) battle.pause();
  try {
    return action();
  } finally {
    if (restorePause && battle.status === 'fighting') battle.pause();
  }
}
function renderInspector() {
  for (const hero of battle.heroes) updatePartyHealthView(hero);
  const h = battle.hero(battle.selected);
  if (!h) return;
  const k = KITS[h.classId];
  const canModify = ['ready', 'fighting'].includes(battle.status) || (battle.status === 'paused' && pauseForDetails);
  const key = `${h.id}-${h.stance}-${moveMode}-${battle.status}`;
  if (key === selectedKey) return;
  selectedKey = key;
  $('inspector').innerHTML = `<div class="hero-identity"><div class="portrait-frame"><img src="${portrait(h.classId)}" alt="${heroName(h)}"/><span>LV ${h.level}</span></div><div><small class="hero-class">${k.name}</small><h2>${heroName(h)}</h2><p>${k.role}</p></div></div><div class="hero-stats"><span>HP <b id="selected-hp"></b></span><span>SH <b id="selected-shield"></b></span></div><h4 class="subheading stance-label">${t('battle.skills')} <span>${t('battle.autocast')}</span></h4><div class="stance-options">${battle.availableSkills(h.id).map(i => { const s = k.skills[i]; return `<button data-select-stance="${i}" class="stance-option ${h.stance === i ? 'chosen' : ''}" aria-pressed="${h.stance === i}" ${!['ready', 'fighting'].includes(battle.status) || h.hp <= 0 ? 'disabled' : ''}><span><b>${s.name}</b><small>${s.label} · ${s.cooldown.toFixed(1)}s</small></span><i>${h.stance === i ? '●' : '○'}</i></button>`; }).join('')}</div><p class="skill-description">${k.skills[h.stance].description}</p><div class="focus-meter"><div><span>${t('battle.fatigue')}</span><span id="fatigue-label"></span></div><span class="gauge"><i id="fatigue-fill"></i></span></div><button id="move-selected" class="btn move-button">${moveMode ? t('battle.move.pick') : t('battle.move')}<small>+0.9s</small></button><div class="move-grid" ${moveMode ? '' : 'hidden'}>${Array.from({ length: 9 }, (_, i) => `<button data-move-slot="${i}" aria-label="${t('formation.tile', { n: i + 1 })}" ${i === h.slot ? 'disabled' : ''}>${i + 1}</button>`).join('')}</div>`;
  $('inspector').querySelectorAll<HTMLButtonElement>('[data-select-stance]').forEach(el => {
    el.disabled = !canModify || h.hp <= 0;
    el.addEventListener('click', () => {
      withDetailsPausedAction(() => battle.stance(h.id, Number(el.dataset.selectStance)));
      renderInspector();
      frame(1);
    });
  });
  $('move-selected').addEventListener('click', () => { moveMode = !moveMode; renderInspector(); });
  $('inspector').querySelectorAll<HTMLElement>('[data-move-slot]').forEach(el => el.addEventListener('click', () => {
    withDetailsPausedAction(() => battle.move(battle.selected, Number(el.dataset.moveSlot)));
    moveMode = false;
    renderInspector();
    frame(1);
  }));
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
  $('phase').textContent = t('battle.phase', { n: battle.phase });
  $('stagger').style.width = `${battle.breakLeft > 0 ? battle.breakLeft / 6 * 100 : battle.stagger / 800 * 100}%`;
  $('stagger-label').textContent = battle.breakLeft > 0 ? t('battle.break') : t('battle.armor');
  $('battle-screen').classList.toggle('boss-broken', battle.breakLeft > 0);
  $('clock').textContent = formatTime(battle.time);
  const threat = [...battle.threats].sort((a, b) => a.left - b.left)[0];
  const isDanger = Boolean(threat);
  const intent = $('intent');
  const wasDanger = intent.classList.contains('danger');
  intent.classList.toggle('danger', isDanger);
  intent.classList.toggle('guarding', !isDanger && battle.guardLeft > 0);
  if (isDanger && !wasDanger && profile.motion) {
    gsap.fromTo('#intent', { scale: 1.08 }, { scale: 1, duration: 0.25, ease: 'back.out(2)', clearProps: 'transform' });
  }
  intent.querySelector('b')!.textContent = threat ? `${eventText(threat.name, lang())} · ${Math.max(0, threat.left).toFixed(1)}s${threat.targetId !== undefined ? ` → ${battle.hero(threat.targetId)?.name ?? '?'}` : ''}` : battle.guardLeft > 0 ? t('battle.guarding', { s: battle.guardLeft.toFixed(1) }) : t('battle.watch');
  intent.querySelector('span')!.textContent = threat ? `${threat.counter ? eventText(threat.counter, lang()) : t('battle.counter.default')}${battle.threats.length > 1 ? ` (+${battle.threats.length - 1})` : ''}` : t('battle.watch.hint');
  $('damage').textContent = Math.round(battle.damage).toLocaleString();
  $('blocked').textContent = Math.round(battle.blocked).toLocaleString();
  $('loot').textContent = battle.mode === 'endless' ? `${runWallet.crystal} ◇` : battle.mode === 'raid' ? (battle.raidContract?.sandbox ? t('raid.sandbox.short') : t(`raid.tier.${battle.raidContract?.tier ?? 'bronze'}` as never)) : `${battle.gold}G`;
  $('standing').textContent = t('battle.standing', { n: battle.living().length, total: battle.heroes.length });
  $('move-tip').textContent = moveMode ? t('battle.move.pick') : t('battle.drag');
  $('resolve-fill').style.width = `${battle.resolve}%`;
  $('resolve-label').textContent = battle.resolve >= 100 ? t('battle.ult.ready') : t('battle.ult.charge', { n: Math.floor(battle.resolve) });
  const ultReady = battle.resolve >= 100 && battle.status === 'fighting';
  $<HTMLButtonElement>('ultimate').disabled = !ultReady;
  $('ultimate').classList.toggle('ready', ultReady);
  $<HTMLButtonElement>('potion').disabled = battle.potions <= 0 || battle.status !== 'fighting';
  $('potions').textContent = t('battle.potion.left', { n: battle.potions });
  $('potion').querySelector('b')!.textContent = String(battle.potions);
  $<HTMLButtonElement>('guard').disabled = battle.guardCooldown > 0 || battle.status !== 'fighting';
  $('guard-label').textContent = battle.guardLeft > 0 ? t('battle.guard.active', { s: battle.guardLeft.toFixed(1) }) : battle.guardCooldown > 0 ? t('battle.guard.cd', { s: battle.guardCooldown.toFixed(1) }) : t('battle.guard.ready');
  $('guard').classList.toggle('guarding', battle.guardLeft > 0);
  $('lane-targets-hint')?.remove();
  document.querySelector('.lane-targets')?.classList.toggle('has-minions', battle.minions.length > 0);
  for (const h of battle.heroes) {
    const el = document.querySelector<HTMLElement>(`[data-hero="${h.id}"]`);
    if (!el) continue;
    const p = cell(h.slot);
    el.style.left = `${p.x / 6}%`;
    el.style.top = `${p.y / 7.6}%`;
    el.classList.toggle('selected', h.id === battle.selected);
    el.classList.toggle('downed', h.hp <= 0);
    el.classList.toggle('buffed', h.buff > 0);
    updatePartyHealthView(h);
    updateUnitView(h);
  }
  updateFocusBar();
  if (pickerHero !== -1 && (battle.status !== 'fighting' && battle.status !== 'ready' || (battle.hero(pickerHero)?.hp ?? 0) <= 0)) closeSkillPicker();
  const h = battle.hero(battle.selected);
  if (h && $('selected-hp')) {
    $('selected-hp').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
    $('selected-shield').textContent = String(Math.round(h.shield));
    $('fatigue-label').textContent = h.fatigue > 70 ? t('battle.fatigue.tired') : h.fatigue > 40 ? t('battle.fatigue.warm') : t('battle.fatigue.fresh');
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
  while ($('combat-log').children.length > 8) $('combat-log').lastElementChild?.remove();
}
window.addEventListener('battle-banner', event => {
  if (inTown) return;
  const e = (event as CustomEvent<BattleEvent>).detail;
  const text = e.text ? eventText(e.text, lang()) : '';
  $('banner').textContent = text;
  $('banner').className = `battle-banner visible ${e.type === 'warning' ? 'danger' : e.type === 'ultimate' ? 'ultimate' : e.type === 'break' ? 'break' : ''}`;
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => {
    const banner = $('banner');
    banner.className = 'battle-banner';
    banner.textContent = '';
  }, 1800);
  if (text) addLog(text);
});

function openModal(content: string, pause = true) {
  const alreadyOpen = modal.open;
  if (!alreadyOpen) resumeOnClose = !inTown && pause && battle.status === 'fighting';
  if (!inTown && pause && battle.status === 'fighting') { resumeOnClose = true; battle.pause(); }
  modal.innerHTML = `${content}<button data-close class="modal-close icon-button" aria-label="${t('common.close')}">×</button>`;
  modal.scrollTop = 0;
  if (!alreadyOpen) {
    try { modal.showModal(); } catch { modal.show(); }
    sound.modalReveal();
    if (profile.motion) gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'power2.out', clearProps: 'opacity' });
  }
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.close()));
}
modal.addEventListener('close', () => { if (resumeOnClose && !inTown && battle.status === 'paused') battle.pause(); resumeOnClose = false; });
function closeWithoutResume() { resumeOnClose = false; clearResultState(); if (modal.open) modal.close(); }
function help() {
  const rows: [string, string][] = [['help.tap.title', 'help.tap'], ['help.skill.title', 'help.skill'], ['help.drag.title', 'help.drag'], ['help.guard.title', 'help.guard'], ['help.items.title', 'help.items'], ['help.lanes.title', 'help.lanes']];
  openModal(`<h2 id="modal-title">${t('help.title')}</h2><div class="help-rows">${rows.map(([title, body]) => `<p><b>${t(title as never)}</b><br>${t(body as never)}</p>`).join('')}</div><button class="btn primary" data-close>${t('help.close')}</button>`);
}
function settings() {
  openModal(`<h2 id="modal-title">${t('settings.title')}</h2>
    <div class="setting-row" role="group" aria-label="${t('settings.language')}"><span><b>${t('settings.language')}</b><small>${inTown ? t('settings.language.sub') : t('settings.language.town')}</small></span><span class="lang-switch">${(['en', 'id'] as Lang[]).map(code => `<button type="button" class="btn" data-lang="${code}" aria-pressed="${lang() === code}" ${inTown ? '' : 'disabled'}>${code === 'en' ? 'English' : 'Indonesia'}</button>`).join('')}</span></div>
    <label class="setting-row"><span><b>${t('settings.sound')}</b><small>${t('settings.sound.sub')}</small></span><input id="setting-sound" type="checkbox" ${profile.sound ? 'checked' : ''}></label>
    <label class="setting-row"><span><b>${t('settings.motion')}</b><small>${t('settings.motion.sub')}</small></span><input id="setting-motion" type="checkbox" ${profile.motion ? 'checked' : ''}></label>
    <p class="hint">${t('settings.save.note')}</p><button id="export-save" class="btn">${t('settings.export')}</button><button class="btn primary" data-close>${t('common.back')}</button>`);
  $('export-save').addEventListener('click',exportCommander);
  $('setting-sound').addEventListener('change', e => { profile.sound = (e.target as HTMLInputElement).checked; updateSound(); });
  $('setting-motion').addEventListener('change', e => { profile.motion = (e.target as HTMLInputElement).checked; scene.reducedMotion = !profile.motion; document.body.classList.toggle('reduced-motion', !profile.motion); persist(); });
}
function updateSound() { sound.enabled = profile.sound; if (profile.sound) sound.unlock(); $('sound').setAttribute('aria-pressed', String(profile.sound)); persist(); }
function pauseMenu() {
  if (inTown) return;
  if (['victory', 'defeat'].includes(battle.status)) { result(); return; }
  if (modal.open) { modal.close(); return; }
  openModal(`<h2 id="modal-title">${t('pause.title')}</h2><p class="hint">${t('pause.copy')}</p><nav class="menu-list"><button class="menu-item" data-close>${t('pause.resume')}</button><button id="pause-help" class="menu-item">${t('pause.controls')}</button><button id="pause-settings" class="menu-item">${t('pause.settings')}</button><button id="pause-retreat" class="menu-item">${t('pause.retreat')}</button></nav>`);
  $('pause-help').addEventListener('click', help);
  $('pause-settings').addEventListener('click', settings);
  $('pause-retreat').addEventListener('click', () => navigateTown());
}
const escapeUI = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
function showBoonTray() {
  if (inTown) return;
  if (modal.open && modal.querySelector('.boon-tray-modal')) { modal.close(); return; }
  sound.cardDeal();
  const activeBoonIds = (runBoons.length > 0 ? runBoons : battle.boons) ?? [];
  const boons = activeBoonIds.map(id => BOONS.find(b => b.id === id)).filter(Boolean) as typeof BOONS;
  const modeBadge = battle.mode === 'endless' ? t('battle.floor', { n: battle.floor }) : battle.mode === 'raid' ? t('mode.raid') : battle.mode === 'dungeon' ? t('route.dungeon') : stageLabel();
  const raidModifiers = battle.raidContract?.modifiers?.length ?? 0;
  openModal(`<div class="boon-tray-modal"><h2 id="modal-title">${t('boons.title', { n: boons.length })}</h2><p class="hint"><span class="boon-tray-mode-tag">${escapeUI(modeBadge)}</span>${raidModifiers ? ` · ${t('boons.pact', { n: raidModifiers })}` : ''}</p>
    ${boons.length ? `<div class="boon-tray-list">${boons.map(b => `<div class="boon-tray-card"><small class="boon-patron-badge">${escapeUI(b.patron)}</small><h3 class="boon-name">${escapeUI(b.name)}</h3><p class="boon-desc">${escapeUI(b.description)}</p></div>`).join('')}</div>` : `<div class="boon-tray-empty"><p>${t('boons.empty')}</p><small>${t('boons.empty.hint')}</small></div>`}
    <div class="boon-tray-footer"><div class="boon-tray-stats"><span>${t('boons.purse', { n: runWallet.crystal })}</span><span>${t('battle.standing', { n: battle.heroes.filter(h => h.hp > 0).length, total: battle.heroes.length })}</span></div><button class="btn primary" data-close>${t('boons.resume')}</button></div></div>`);
}
async function navigateTown(tab: TownTab = 'camp') {
  const activateTargetMode = () => {
    const activeCommander = commander.document;
    if (!activeCommander) return;
    const mode = modeForTownTab(tab);
    if (mode !== commander.mode) activateCommander(activeCommander, mode, false);
  };
  if (inTown) {
    if (commander.document) {
      if (!(await commander.flush())) { storageStatus(); return; }
      activateTargetMode();
    }
    showTown(tab, '', true);
    return;
  }
  void leaveSafely(async () => {
    activateTargetMode();
    showTown(tab, '', true);
  });
}
const resultGate = new ResultGate();
let presentingResult = false;
let resultRequest = 0;
function clearResultState() {
  delete resultScreen.dataset.result;
  delete resultScreen.dataset.detailsOpen;
  resultGeneration = undefined;
  resultGate.close();
  resultScreen.hidden = true;
  resultScreen.innerHTML = '';
  $('battle-screen').inert = false;
}
function showResultScreen(content: string) {
  clearResultState();
  resultScreen.innerHTML = content;
  resultScreen.hidden = false;
  resultScreen.tabIndex = -1;
  $('battle-screen').inert = true;
  resultScreen.focus({ preventScroll: true });
}
resultScreen.addEventListener('click', event => {
  if (resultScreen.dataset.result === 'true' && !resultGate.allows(performance.now(), resultGeneration)) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);

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
  const cards = resultScreen.querySelectorAll('.boon-card');
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
  const modalEl = resultScreen.querySelector('.result-ceremony-modal');
  if (!modalEl) return;
  const crest = modalEl.querySelector('.result-banner');
  const plaques = modalEl.querySelectorAll('.stat-plaque');
  const cards = modalEl.querySelectorAll('.xp-card');
  const tl = gsap.timeline();
  if (crest) {
    tl.fromTo(crest, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.2)', clearProps: 'opacity,transform' });
    tl.fromTo(modalEl.querySelectorAll('.win'), { opacity: 0, scaleY: 0.3 }, { opacity: 1, scaleY: 1, stagger: 0.08, duration: 0.2, ease: 'power2.out', clearProps: 'opacity,transform' }, '-=0.1');
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
  const deploy = document.querySelector<HTMLElement>('.secondary-deploy');
  if (deploy) gsap.fromTo(deploy, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'opacity,transform' });
}

function animateSunkenDescent() {
  if (!profile.motion) return;
  const pillars = document.querySelectorAll<HTMLElement>('.endless-rules p');
  if (pillars.length) {
    gsap.fromTo(pillars, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.24, ease: 'power2.out', clearProps: 'opacity,transform' });
  }
  const slots = document.querySelectorAll<HTMLElement>('.loadout-slots label');
  if (slots.length) {
    gsap.fromTo(slots, { opacity: 0 }, { opacity: 1, stagger: 0.06, duration: 0.25, ease: 'power2.out', clearProps: 'opacity' });
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
    resultScreen.dataset.result = 'true';
    const generation = resultGate.open(performance.now());
    resultGeneration = generation;
    const buttons = Array.from(resultScreen.querySelectorAll<HTMLButtonElement>('button'));
    buttons.forEach(button => { button.disabled = true; });
    const hint = document.createElement('p');
    hint.className = 'result-input-hint';
    hint.setAttribute('role', 'status');
    hint.textContent = t('result.preparing');
    resultScreen.append(hint);
    resultScreen.scrollTop = 0;
    window.setTimeout(() => {
      if (resultScreen.hidden || request !== resultRequest || battle !== current || battle.stage !== stage || !resultGate.allows(performance.now(), generation)) return;
      buttons.forEach(button => { button.disabled = false; });
      resultScreen.scrollTop = 0;
      delete resultScreen.dataset.result;
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
  if (battle.mode === 'dungeon') return presentDungeonResult();
  const won = battle.status === 'victory';
  const moreWaves = won && battle.mode === 'adventure' && battle.stage + 1 < battle.stageCount;
  const zone = CAMPAIGN[battle.floor - 1];
  let recruited: string[] = [];
  recruitedIds = [];
  let reward = 0;
  if (!recorded) chapterResult = undefined;
  if (!recorded) {
    pendingSettlement = true;
    if (won && !moreWaves && !encounter?.settled) {
      const candidate = structuredClone(profile);
      const wallet = structuredClone(runWallet);
      const rewards = settleProgress(candidate, battle, wallet);
      if (rewards === null) {
        commander.error = t('result.blocked.error');
        storageStatus();
        openModal(`<h2 id="modal-title">${t('result.blocked.title')}</h2><p>${t('result.blocked.copy')}</p>`);
        return false;
      }
      reward = battle.gold + (battle.mode === 'adventure' ? zone.reward : 0);
      if (battle.mode === 'adventure') {
        if (battle.heroic) reward = battle.gold;
        candidate.gold += reward;
        const before = new Set(candidate.roster);
        completeZone(candidate, battle.floor - 1);
        recruitedIds = candidate.roster.filter(id => !before.has(id));
        recruited = recruitedIds.map(id => ROSTER[id].name);
        chapterResult = { stars: chapterStars(battle.living().length === battle.heroes.length, battle.stageTime), ...recordChapterResult(candidate, battle.floor - 1, chapterStars(battle.living().length === battle.heroes.length, battle.stageTime), battle.heroic) };
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
      openModal(`<h2 id="modal-title">${t('result.unsaved.title')}</h2><p>${t('result.unsaved.copy')}</p><button id="retry-save" class="btn primary">${t('result.unsaved.retry')}</button><button id="pending-export" class="btn">${t('result.unsaved.export')}</button>`);
      $('retry-save').onclick = () => { presentingResult = false; result(); };
      $('pending-export').onclick = exportCommander;
      return false;
    }
    pendingSettlement = false;
    recorded = true;
  }
  if (won && battle.mode === 'endless') { offeredBoons = boonChoices(runBoons, runSeed + battle.floor * 7919 + boonReroll * 104729); boonReroll = 0; }
  $('start-overlay').hidden = false;
  $('ready-label').textContent = '';
  $('ready-title').textContent = won ? moreWaves ? t('ready.after.wave') : t('ready.after.win') : t('ready.after.lose');
  $('ready-copy').textContent = t('ready.after.copy');
  $('start').textContent = t('ready.after.button');
  const description = moreWaves ? t('result.desc.wave') : won && battle.mode === 'adventure' ? zone.outro : won && battle.mode === 'raid' ? (battle.raidContract?.sandbox ? t('result.desc.sandbox') : t('result.desc.raid', { tier: t(`raid.tier.${battle.raidContract?.tier ?? 'bronze'}` as never) })) : won ? t('result.desc.room', { n: runWallet.crystal }) : t('result.desc.defeat');
  if (won && battle.mode === 'endless') {
    const cardsHtml = offeredBoons.map(b => {
      const meta = getBoonMeta(b.id);
      return `<button class="boon-card" data-boon="${b.id}" style="--card-accent:${meta.color}" aria-label="${escapeUI(b.name)} - ${escapeUI(b.patron)}">
        <span class="boon-card-gem" aria-hidden="true"></span>
        <small class="boon-patron-badge boon-patron-name">${escapeUI(b.patron)}</small>
        <h4 class="boon-name">${escapeUI(b.name)}</h4>
        <p class="boon-desc">${escapeUI(b.description)}</p>
        <span class="boon-cta">${t('boon.take')}</span>
      </button>`;
    }).join('');
    showResultScreen(`<div class="boon-draft-modal">
      <header class="boon-modal-header">
        <p class="result-banner">${t('result.floor.clear', { n: battle.floor })}</p>
        <h2 id="result-title" class="boon-modal-title">${t('boon.choose')}</h2>
        <p class="boon-modal-subtitle">${t('boon.choose.sub')}</p>
        <p class="boon-run-wallet">${t('boons.purse', { n: runWallet.crystal })} · ${t('battle.standing', { n: battle.living().length, total: battle.heroes.length })} · ${formatTime(battle.time)}</p>
      </header>
      <section class="win rogue-promote" id="rogue-promote" aria-live="polite"></section>
      ${!offeredBoons.length ? `<button id="next-floor" class="btn primary">${t('boon.allcollected')}</button>` : ''}
      <div class="boon-draft-grid">${cardsHtml}</div>
      <footer class="boon-modal-footer"><button id="result-town" class="btn">${t('boon.abandon')}</button></footer>
    </div>`);
    renderRoguePromote();
    animateBoonDraft();
  } else {
    const outcomeClass = won ? (moreWaves ? 'wave-clear' : 'victory') : 'defeat';
    const banner = moreWaves ? t('result.banner.wave', { n: battle.stage + 1, total: battle.stageCount }) : won ? t('result.banner.win') : t('result.banner.lose');
    const titleText = won ? (moreWaves ? t('result.title.wave') : t('result.title.win')) : t('result.title.lose');
    const goldDisplay = won ? (moreWaves ? battle.gold : battle.gold + (battle.mode === 'adventure' ? zone.reward : 0)) : 0;
    const xpRows = experienceRewards.map(r => {
      const isLevelUp = r.after > r.before;
      const hero = ROSTER[r.id];
      return `<p class="xp-card ${isLevelUp ? 'leveled-up' : ''}" data-xp-kind="${r.kind}"><img src="${portrait(hero.classId)}" alt=""/><span class="xp-hero-info"><b class="xp-hero-name">${hero.name}</b><small class="xp-role-badge ${r.kind}">${r.kind === 'bench' ? t('result.bench') : t('result.active')}</small></span><span class="xp-points">+${r.xp} EXP${r.bonus ? ` <small class="xp-catchup">(+${r.bonus})</small>` : ''}</span><span class="xp-level-badge ${isLevelUp ? 'lvl-glow' : ''}">${isLevelUp ? t('result.levelup', { from: r.before, to: r.after }) : `LV ${r.after}`}</span></p>`;
    }).join('');
    const readyQuests = QUESTS.filter(q => questProgress(profile, q).ready).length;
    showResultScreen(`<div class="result-ceremony-modal ${outcomeClass}">
      <p class="result-banner" aria-hidden="true">${banner}</p>
      <header class="win ceremony-header">
        <h2 id="result-title" class="ceremony-title">${titleText}</h2>
        <p class="ceremony-desc">${escapeUI(description).replace(/\n/g, '<br>')}</p>
        ${recruited.length ? `<p class="recruit-notice">${t('result.recruited', { names: recruited.join(' & ') })}</p>` : ''}
        ${chapterResult && won && !moreWaves ? `<p class="result-stars"><span>${t('result.stars')}</span> <b class="star-row">${'★'.repeat(chapterResult.stars)}${'☆'.repeat(3 - chapterResult.stars)}</b>${chapterResult.improved ? ` <em>${t('result.stars.new')}</em>` : ''}</p>` : ''}
        ${chapterResult?.heroic ? `<p class="recruit-notice">${t('result.heroic', { gold: chapterResult.heroic.gold, mat: materialList(chapterResult.heroic.materials) })}</p>` : ''}
      </header>
      <section class="win result-summary" aria-label="${t('result.summary')}">
        <dl class="stat-table result-stats"><div class="stat-plaque"><dt>${t('result.survivors')}</dt><dd>${battle.living().length}/${battle.heroes.length}</dd></div><div class="stat-plaque gold"><dt>${moreWaves ? t('result.carried') : t('result.gold')}</dt><dd>${goldDisplay}G</dd></div><div class="stat-plaque"><dt>${t('result.time')}</dt><dd>${formatTime(battle.time)}</dd></div></dl>
        ${xpRows ? `<div class="xp-results">${xpRows}</div>` : ''}
        ${readyQuests && !moreWaves && won ? `<p class="hint">${t('result.quests', { n: readyQuests })}</p>` : ''}
      </section>
      <section class="win result-details" id="result-details" aria-label="${t('result.details')}" hidden>
        <p class="hint">${t('result.xp.note')}</p>
        <dl class="stat-table"><div><dt>${t('battle.stat.damage')}</dt><dd>${Math.round(battle.damage).toLocaleString()}</dd></div><div><dt>${t('battle.stat.blocked')}</dt><dd>${Math.round(battle.blocked).toLocaleString()}</dd></div></dl>
      </section>
      <div class="ceremony-actions">
        ${moreWaves ? `<button id="next-wave" class="btn primary">${t('result.next')} ▶</button>` : `<button id="retry" class="btn">${t('result.retry')}</button>`}
        <button id="result-town" class="btn ${moreWaves ? '' : 'primary'}">${moreWaves ? t('result.abandon') : t('result.town')}</button>
        <button id="result-details-toggle" class="btn result-details-toggle" type="button" aria-controls="result-details" aria-expanded="false">${t('result.details')}</button>
      </div>
    </div>`);
    const detailsToggle = resultScreen.querySelector<HTMLButtonElement>('#result-details-toggle');
    const detailsPanel = resultScreen.querySelector<HTMLElement>('#result-details');
    detailsToggle?.addEventListener('click', () => {
      const expanded = resultScreen.dataset.detailsOpen !== 'true';
      resultScreen.dataset.detailsOpen = String(expanded);
      detailsToggle.setAttribute('aria-expanded', String(expanded));
      detailsToggle.textContent = expanded ? t('result.details.back') : t('result.details');
      if (detailsPanel) detailsPanel.hidden = !expanded;
      if (!expanded) resultScreen.scrollTop = 0;
    });
    if (won && !moreWaves) sound.play('fanfare'); else if (!won) sound.play('defeat');
    if (experienceRewards.some(r => r.after > r.before)) window.setTimeout(() => sound.play('levelup'), 1300);
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
  resultScreen.querySelectorAll<HTMLElement>('[data-boon]').forEach(el => el.addEventListener('click', () => {
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
  $('retry')?.addEventListener('click', () => {
    const mode = battle.mode, floor = battle.mode === 'endless' ? 1 : battle.floor;
    runBoons = [];
    closeWithoutResume();
    boot(mode, floor);
    void clearEncounter();
  });
  $('result-town').addEventListener('click', () => {
    if (moreWaves || won && battle.mode === 'endless') {
      navigateTown('camp');
      return;
    }
    runBoons = [];
    if (battle.mode === 'adventure' && commander.document) activateCommander(commander.document, 'story');
    closeWithoutResume();
    inTown = true;
    showTown('camp', '', true);
    const joined = recruitedIds; recruitedIds = [];
    void joined.reduce((chain, id) => chain.then(() => recruitScene(id)), Promise.resolve());
  });
}

let chapterResult: { stars: number; improved: boolean; heroic?: { gold: number; materials: Record<string, number> } } | undefined;
/** Result of one Undercroft room: XP, carried HP and the pouch update, then back to the map. */
async function presentDungeonResult() {
  const won = battle.status === 'victory';
  let loot: { gold: number; materials: Record<string, number> } | undefined;
  if (!recorded) {
    pendingSettlement = true;
    const candidate = structuredClone(profile), run = candidate.journey.run;
    const rewards = won ? settleProgress(candidate, battle) ?? [] : [];
    if (run) {
      const hp = Object.fromEntries(battle.heroes.map(h => [h.id, h.maxHp > 0 ? h.hp / h.maxHp : 0]));
      loot = resolveFight(run, won, hp, battle.potions);
      if (run.status === 'cleared') { bankPouch(candidate, run.pouch); candidate.journey.depth = Math.max(candidate.journey.depth, run.depth); }
    }
    if (won) candidate.wins++;
    profile = candidate; experienceRewards = rewards; dungeonLoot = loot;
    await persist();
    pendingSettlement = false; recorded = true;
  }
  loot = dungeonLoot;
  const run = profile.journey.run, cleared = run?.status === 'cleared';
  const xpRows = experienceRewards.map(r => { const hero = ROSTER[r.id], up = r.after > r.before; return `<p class="xp-card ${up ? 'leveled-up' : ''}"><img src="${portrait(hero.classId)}" alt=""/><span class="xp-hero-info"><b class="xp-hero-name">${hero.name}</b></span><span class="xp-points">+${r.xp} EXP</span><span class="xp-level-badge">${up ? t('result.levelup', { from: r.before, to: r.after }) : `LV ${r.after}`}</span></p>`; }).join('');
  const desc = !won ? t('dungeon.end.wiped') : cleared ? t('dungeon.end.cleared') : loot ? `${t('dungeon.out.gold', { n: loot.gold })} ${Object.entries(loot.materials).map(([id, n]) => t('dungeon.out.material', { n, name: t(`material.${id}` as never) })).join(' ')}` : '';
  $('start-overlay').hidden = false;
  showResultScreen(`<div class="result-ceremony-modal ${won ? 'victory' : 'defeat'}">
    <p class="result-banner" aria-hidden="true">${won ? cleared ? t('dungeon.end.cleared.banner') : t('result.banner.win') : t('dungeon.end.wiped.banner')}</p>
    <header class="win ceremony-header"><h2 id="result-title" class="ceremony-title">${t('route.dungeon')} · ${t('dungeon.depth.label', { n: run?.depth ?? 1 })}</h2><p class="ceremony-desc">${escapeUI(desc)}</p></header>
    <section class="win result-summary"><dl class="stat-table result-stats"><div class="stat-plaque"><dt>${t('result.survivors')}</dt><dd>${battle.living().length}/${battle.heroes.length}</dd></div><div class="stat-plaque"><dt>${t('dungeon.pouch')}</dt><dd>${run?.pouch.gold ?? 0}G</dd></div><div class="stat-plaque"><dt>${t('result.time')}</dt><dd>${formatTime(battle.time)}</dd></div></dl>${xpRows ? `<div class="xp-results">${xpRows}</div>` : ''}</section>
    <div class="ceremony-actions"><button id="result-dungeon" class="btn primary">${t('dungeon.result.back')} ▶</button></div>
  </div>`);
  sound.play(won ? 'fanfare' : 'defeat');
  if (experienceRewards.some(r => r.after > r.before)) window.setTimeout(() => sound.play('levelup'), 1300);
  animateCeremony();
  $('result-dungeon').addEventListener('click', () => { closeWithoutResume(); inTown = true; townState.dungeonOutcome = undefined; showTown('dungeon', '', true); });
  return true;
}
let dungeonLoot: { gold: number; materials: Record<string, number> } | undefined;
function makeEncounter(settled = false): NonNullable<typeof encounter> {
  return { runId: encounter?.runId ?? crypto.randomUUID(), seq: (encounter?.seq ?? 0) + 1, battle: battle.checkpoint(), purse: runWallet.crystal, boons: [...runBoons], seed: runSeed, settled };
}
async function checkpoint(terminal = false, slotId: SlotId = 'auto') {
  if (battle.mode === 'dungeon') return persist(slotId);
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
  $('ready-copy').textContent = t('ready.resume');
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
  if (ok) { encounter = undefined; runBoons = []; resetRunWallet(runWallet); }
  return ok;
}
/** Spend the run's promotion points (one per room cleared) between floors. */
function renderRoguePromote() {
  const host = document.getElementById('rogue-promote'), build = battle.rogueBuild;
  if (!host) return;
  if (!build || build.points < 1 || battle.mode !== 'endless') { host.hidden = true; return; }
  const rows = build.recruits.map((recruit, i) => {
    const hero = battle.hero(i), options = rogueUpgrades(build, i);
    if (!hero) return '';
    const current = recruit.job ? JOBS[recruit.job]?.name : KITS[recruit.classId].name;
    return `<div class="rogue-promote-row"><span><b>${escapeUI(hero.name)}</b><small>${escapeUI(current ?? '')}</small></span><span class="rogue-promote-options">${options.length ? options.map(j => `<button class="btn" data-rogue-promote="${i}" data-job="${j.id}">${escapeUI(j.name)} ▲</button>`).join('') : `<small>${t('rogue.promote.max')}</small>`}</span></div>`;
  }).join('');
  host.hidden = false;
  host.innerHTML = `<h3>${t('rogue.promote.title', { n: build.points })}</h3><p class="hint">${t('rogue.promote.sub')}</p>${rows}`;
  host.querySelectorAll<HTMLElement>('[data-rogue-promote]').forEach(el => el.addEventListener('click', () => {
    if (battle.upgradeRogue(Number(el.dataset.roguePromote), el.dataset.job!)) { sound.play('levelup'); townState.rogueSetup = structuredClone(battle.rogueBuild); }
    renderRoguePromote();
  }));
}
async function nextFloor() {
  if (pendingSettlement || commander.stale) return;
  const build = structuredClone(battle.rogueBuild ?? createRogueBuild());
  boot('endless', battle.floor + 1, { rogueBuild: build });
  townState.rogueSetup = build;
  await checkpoint();
}
function activateCommander(document: CommanderDocument, mode = document.activeMode, renderTownAfterActivation = true) {
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
  if (inTown && renderTownAfterActivation) showTown(mode === 'story' ? 'camp' : mode === 'raid' ? 'raid' : 'endless');
}
async function leaveSafely(action: () => void | Promise<void>) {
  if (pendingSettlement || presentingResult || commander.stale) { storageStatus(); return; }
  if (!(await commander.flush())) { storageStatus(); return; }
  if (inTown || battle.mode === 'dungeon') { closeWithoutResume(); inTown = true; await action(); return; }
  const hasCommander = Boolean(commander.document);
  openModal(hasCommander
    ? `<h2 id="modal-title">${t('leave.title')}</h2><p>${t('leave.copy')}</p><nav class="menu-list"><button id="suspend-run" class="menu-item">${t('leave.suspend')}</button><button id="abandon-run" class="menu-item">${t('leave.abandon')}</button><button data-close class="menu-item">${t('common.cancel')}</button></nav>`
    : `<h2 id="modal-title">${t('leave.title')}</h2><p>${t('leave.copy.none')}</p><nav class="menu-list"><button id="abandon-run" class="menu-item">${t('leave.abandon')}</button><button data-close class="menu-item">${t('common.cancel')}</button></nav>`);
  $('suspend-run')?.addEventListener('click', async () => {
    if (!commander.document || commander.busy) return;
    if (await persist('auto', doc => { if (commander.mode !== 'story') { const state=commander.mode==='raid'?doc.raid:doc.rogue; if (state.activeRun) state.activeRun.status='suspended'; } })) { closeWithoutResume(); inTown = true; await action(); }
  });
  $('abandon-run').addEventListener('click', async () => {
    if (commander.busy) return;
    let cleared = true;
    if (commander.document) cleared = await clearEncounter();
    else {
      encounter = undefined;
      runBoons = [];
      offeredBoons = [];
      resetRunWallet(runWallet);
    }
    if (cleared) { closeWithoutResume(); inTown = true; await action(); }
  });
}
function download(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data,null,2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function exportCommander() {
  download(commander.dirty || pendingSettlement ? { kind:'gridbound-recovery', document:commander.document, pendingProfile:profile, pendingEncounter:encounter } : commander.document, 'Gridbound-Commander.json');
}
import { STORY_CHOICES, narrativeChoice, epilogue } from './game/narrative';
function chapterChronicle() {
  if (!profile.cleared.length) return '';
  return `<section class="journal-chronicle"><h3>${t('journal.chronicle', { n: profile.cleared.length })}</h3>${[...profile.cleared].sort((a, b) => a - b).map(i => `<details class="journal-entry-card"><summary>CH ${i + 1} · ${escapeUI(CAMPAIGN[i].name)}</summary><button class="btn journal-replay" data-replay-chapter="${i}">▶ ${t('journal.watch')}</button><p>${escapeUI(CAMPAIGN[i].intro).replace(/\n/g, '<br>')}</p><p>${escapeUI(CAMPAIGN[i].outro).replace(/\n/g, '<br>')}</p></details>`).join('')}</section>`;
}
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
 openModal(`<h2 id="modal-title">${t('journal.title')}</h2><p class="hint">${t('journal.intro')}</p>${scenes.length?'':`<p>${t('journal.locked')}</p>`}${scenes.map(s=>`<section class="journal-scene"><h3>${s.title}</h3><p>${s.text}</p>${state[s.id]?`<p class="journal-outcome">${s.options.find(o=>o.id===state[s.id])?.outcome}</p>`:`<nav class="menu-list">${s.options.map(o=>`<button class="menu-item" data-story-choice="${s.id}" data-story-option="${o.id}">${o.label}</button>`).join('')}<button class="menu-item" data-story-choice="${s.id}" data-story-option="${s.options[0].id}">${t('journal.skip', { label: s.options[0].label })}</button></nav>`}</section>`).join('')}${chapterChronicle()}${ending.map(text=>`<p>${text}</p>`).join('')}<button class="btn primary" data-close>${t('common.back')}</button>`);
 modal.querySelectorAll<HTMLElement>('[data-replay-chapter]').forEach(button=>button.onclick=()=>{ closeWithoutResume(); void chapterIntro(Number(button.dataset.replayChapter)); });
 modal.querySelectorAll<HTMLElement>('[data-story-choice]').forEach(button=>button.onclick=async()=>{
  if(commander.busy||commander.stale)return;
  profile.narrative??={};
  if(narrativeChoice(profile.narrative,button.dataset.storyChoice!,button.dataset.storyOption!,profile.cleared)&&await persist())await storyJournal();
 });
}
async function profilesMenu() {
  openModal(`<h2 id="modal-title">${t('profiles.title')}</h2><p>${t('profiles.loading')}</p>`);
  try {
    const documents = await commander.open();
    if (!commander.document && documents.length > 0) {
      const latest = [...documents].sort((a, b) => b.lastPlayed - a.lastPlayed)[0];
      activateCommander(latest);
    }
    const current = commander.document;
    const slots = current ? (commander.mode === 'story' ? current.story : commander.mode === 'raid' ? current.raid : current.rogue).slots : [];
    openModal(`<h2 id="modal-title">${t('profiles.title')}</h2><p class="hint">${t('profiles.intro')}</p>
      <div class="save-files">${documents.map((doc,index) => `<div class="save-file ${current?.commanderId === doc.commanderId ? 'current' : ''}"><div><b>${escapeUI(doc.name)}</b><small>${t('profiles.file', { ch: doc.story.slots[3].state?.cleared.length ?? 0, crystal: doc.shared.bankCrystal, rev: doc.revision })}</small></div><button data-commander="${index}" class="btn">${current?.commanderId === doc.commanderId ? t('profiles.current') : t('profiles.switch')}</button></div>`).join('') || `<p>${t('profiles.empty')}</p>`}</div>
      <label class="name-field">${t('profiles.name')} <input id="commander-name" maxlength="32" value="${escapeUI(current?.name ?? 'Commander')}"></label>
      <div class="departure-actions"><button id="new-commander" class="btn primary" ${documents.length >= 3 ? 'disabled' : ''}>${t('profiles.new')}</button>${current ? `<button id="rename-commander" class="btn">${t('profiles.rename')}</button><button id="export-commander" class="btn">${t('profiles.export')}</button><button id="delete-commander" class="btn danger">${t('profiles.delete')}</button><button id="save-retry" class="btn">${t('result.unsaved.retry')}</button>` : ''}<button id="legacy-preview" class="btn">${t('profiles.legacy')}</button></div>
      ${current ? `<h3 class="subheading">${t('profiles.slots', { mode: modeName(commander.mode) })}</h3><p class="hint">${t('profiles.slots.hint')}</p><div class="save-files">${slots.map(slot => `<div class="save-file"><div><b>${slot.slotId === 'auto' ? t('profiles.auto') : t('profiles.slot', { n: slot.slotId.slice(-1) })}</b><small>${t(`profiles.status.${slot.status}` as never)} · ${slot.savedAt ? new Date(slot.savedAt).toLocaleString() : t('profiles.emptyslot')}</small></div><span>${slot.slotId !== 'auto' ? `<button data-save-slot="${slot.slotId}" class="btn">${t('profiles.save')}</button>` : ''}<button data-load-slot="${slot.slotId}" class="btn" ${!slot.state ? 'disabled' : ''}>${t('profiles.load')}</button></span></div>`).join('')}</div><button id="continue-latest" class="btn primary">${t('profiles.continue')}</button>` : ''}
      <p id="profile-error" role="status">${escapeUI(gameText(commander.error || commander.repository?.warning || ''))}</p><button data-close class="btn">${t('common.close')}</button>`);
    const attempt = async (task: () => Promise<void>) => { try { await task(); } catch(error) { $('profile-error').textContent = error instanceof Error ? error.message : String(error); } };
    modal.querySelectorAll<HTMLElement>('[data-commander]').forEach(button => button.onclick = () => { const target = documents[Number(button.dataset.commander)]; if (target.commanderId !== current?.commanderId) void leaveSafely(() => { activateCommander(target); closeWithoutResume(); }); else closeWithoutResume(); });
    $('new-commander').onclick = () => { const name = $<HTMLInputElement>('commander-name').value; void leaveSafely(() => attempt(async () => { activateCommander(await commander.create(name)); closeWithoutResume(); })); };
    $('rename-commander')?.addEventListener('click', () => { const name = $<HTMLInputElement>('commander-name').value.trim().slice(0,32); void attempt(async () => { if (!name) throw new Error(t('profiles.name.required')); if (await persist('auto', doc => { doc.name=name; })) await profilesMenu(); }); });
    $('export-commander')?.addEventListener('click',exportCommander);
    $('save-retry')?.addEventListener('click', () => { if (pendingSettlement) { presentingResult=false; result(); } else void persist().then(() => profilesMenu()); });
    $('delete-commander')?.addEventListener('click', () => {
      openModal(`<h2 id="modal-title">${t('profiles.delete.title', { name: escapeUI(current!.name) })}</h2><p>${t('profiles.delete.copy', { crystal: current!.shared.bankCrystal, receipts: current!.shared.settlementReceipts.length })}</p><input id="delete-word" aria-label="DELETE"><button id="delete-confirm" class="btn danger" disabled>${t('profiles.delete.confirm')}</button><button data-close class="btn">${t('common.cancel')}</button>`);
      $('delete-word').oninput = () => { $<HTMLButtonElement>('delete-confirm').disabled = $<HTMLInputElement>('delete-word').value !== 'DELETE'; };
      $('delete-confirm').onclick = async () => { if (!inTown || pendingSettlement || commander.stale) return; try { await commander.flush(); await commander.repository!.remove(current!.commanderId,commander.document!.revision); commander.document=undefined; profile=createProfile(); showTown(); await profilesMenu(); } catch(error) { commander.error=String(error); storageStatus(); } };
    });
    $('legacy-preview').onclick = () => {
      let raw: string | null = null; try { raw=store.getItem('gridbound.v3'); } catch { /* source remains protected */ }
      openModal(`<h2 id="modal-title">${t('profiles.legacy.title')}</h2><p>${t('profiles.legacy.copy', { gold: saved.profile.gold, roster: saved.profile.roster.length })}</p><p>${escapeUI(gameText(saved.warning))}</p><button id="legacy-export" class="btn">${t('profiles.legacy.export')}</button><button id="legacy-confirm" class="btn primary" ${!raw || saved.readOnly || documents.length>=3 ? 'disabled' : ''}>${t('profiles.legacy.confirm')}</button><button data-close class="btn">${t('common.cancel')}</button>`);
      $('legacy-export').onclick = () => download(raw ?? '', 'Gridbound-original-v3.json');
      $('legacy-confirm').onclick = () => { void leaveSafely(async () => { const candidate=copyLegacyToCommander(saved.profile,'Legacy copy'); candidate.legacySource=raw!; try { activateCommander(await commander.create('Legacy copy',candidate)); closeWithoutResume(); } catch(error) { commander.error=String(error); storageStatus(); } }); };
    };
    modal.querySelectorAll<HTMLElement>('[data-save-slot]').forEach(button => button.onclick = () => { void attempt(async () => { if (!inTown && encounter && !pendingSettlement) { const frozen=structuredClone(encounter); await persist(button.dataset.saveSlot as SlotId, doc => { const state=commander.mode==='story'?doc.story:commander.mode==='raid'?doc.raid:doc.rogue; const auto=state.slots[3]; const index=state.slots.findIndex(slot=>slot.slotId===button.dataset.saveSlot); state.slots[index]=structuredClone({...auto,slotId:button.dataset.saveSlot as SlotId}); doc.encounters ??={}; doc.encounters[commander.mode]=frozen; }); } else await persist(button.dataset.saveSlot as SlotId); sound.play('save'); await profilesMenu(); }); });
    modal.querySelectorAll<HTMLElement>('[data-load-slot]').forEach(button => button.onclick = () => {
      const slot=slots.find(item=>item.slotId===button.dataset.loadSlot)!;
      openModal(`<h2 id="modal-title">${t('profiles.preview', { slot: slot.slotId === 'auto' ? t('profiles.auto') : t('profiles.slot', { n: slot.slotId.slice(-1) }) })}</h2><pre class="slot-preview">${escapeUI(JSON.stringify(slot.state,null,2))}</pre><p class="hint">${t('profiles.preview.hint')}</p><button id="load-confirm" class="btn primary">${t('profiles.load.confirm')}</button><button data-close class="btn">${t('common.cancel')}</button><p id="load-error" role="status"></p>`);
      $('load-confirm').onclick = async () => { if (!inTown || pendingSettlement) { $('load-error').textContent=t('profiles.load.blocked'); return; } try { profile=await commander.loadSlot(slot.slotId); activateCommander(commander.document!,commander.mode); closeWithoutResume(); } catch(error) { $('load-error').textContent=String(error); } };
    });
    $('continue-latest')?.addEventListener('click', () => { const savedEncounter=commander.document?.encounters?.[commander.mode]; if (!savedEncounter) { $('profile-error').textContent=t('profiles.nocheckpoint'); return; } closeWithoutResume(); restoreEncounter(savedEncounter); });
  } catch(error) { console.error('PROFILES_MENU_ERROR:', error); openModal(`<h2 id="modal-title">${t('profiles.protected')}</h2><p>${escapeUI(String(error))}</p><p>${t('profiles.protected.copy')}</p>`); }
}
commander.onStatus = () => { storageStatus(); if (commander.stale && battle.status === 'fighting') battle.pause(); };
window.addEventListener('beforeunload', () => {
  delete (window as unknown as { gridbound?: unknown }).gridbound;
});
if (typeof navigator !== 'undefined' && !navigator.webdriver) {
  window.addEventListener('beforeunload', event => { if (commander.busy || commander.dirty || pendingSettlement) event.preventDefault(); });
}
 $('home').addEventListener('click', () => {
  if (inTown && townState.tab === 'camp') showTitleScreen();
  else if (inTown) showTown('camp');
  else navigateTown('camp');
});
$('title-enter').addEventListener('click', enterEmberhollow);
$('title-profiles').addEventListener('click', () => { void profilesMenu(); });
$('title-journal').addEventListener('click', () => { void storyJournal(); });
$('title-settings').addEventListener('click', settings);
$('menu-button').addEventListener('click', () => { sound.play('confirm'); void navigateTown('more'); });
document.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-lang]');
  if (!button || button.dataset.lang === lang()) return;
  if (!inTown || pendingSettlement || commander.busy) { storageStatus(); return; }
  const next = button.dataset.lang as Lang;
  void commander.flush().then(saved => {
    if (!saved) { storageStatus(); return; }
    const apply = () => { setLang(next); location.reload(); };
    if (commander.document && !commander.repository?.persistent) {
      openModal(`<h2 id="modal-title">${t('lang.session.title')}</h2><p>${t('lang.session.copy')}</p><button id="lang-export" class="btn">${t('profiles.export')}</button><button id="lang-anyway" class="btn danger">${t('lang.session.confirm')}</button><button data-close class="btn primary">${t('common.cancel')}</button>`, false);
      $('lang-export').addEventListener('click', exportCommander);
      $('lang-anyway').addEventListener('click', apply);
      return;
    }
    apply();
  });
});
document.addEventListener('pointerdown', event => {
  const target = (event.target as HTMLElement).closest('button,[role="button"]');
  if (target && !(target as HTMLButtonElement).disabled && !target.closest('#unit-layer')) sound.play('cursor');
}, true);
const titleScreenEl = $('title-screen');
const leavePressPhase = () => { if (!titleScreenEl.classList.contains('press-phase')) return false; titleScreenEl.classList.remove('press-phase'); sound.unlock(); sound.play('confirm'); requestAnimationFrame(() => $('title-enter').focus({ preventScroll: true })); return true; };
titleScreenEl.addEventListener('pointerdown', event => { if (titleScreenEl.classList.contains('press-phase')) { event.preventDefault(); leavePressPhase(); } });
$('retreat').addEventListener('click', () => navigateTown());
$('battle-screen').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-run-buy]');
  if (button && !button.disabled && !inTown) buyForRun(button.dataset.runBuy!);
});
document.querySelectorAll<HTMLButtonElement>('.battle-view-tabs [data-battle-view]').forEach(button => button.addEventListener('click', () => setBattleView(button.dataset.battleView as 'arena' | 'hero' | 'log')));
$('battle-detail-resume').addEventListener('click', () => setBattleView('arena'));
$('focus-bar').addEventListener('click', () => setBattleView('hero'));
// Expedition and preparation routes are handled by the Town screen's delegated actions.
$('start').addEventListener('click', begin);
$('pause').addEventListener('click', pauseMenu);
$('combat-boons').addEventListener('click', showBoonTray);
$('howto').addEventListener('click', help);
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
    if (leavePressPhase()) { e.preventDefault(); return; }
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      const items = Array.from(titleScreen.querySelectorAll<HTMLButtonElement>('.title-menu-item'));
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(index + (e.code === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
      sound.play('cursor');
      e.preventDefault();
      return;
    }
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
  if (modal.open) { if (e.code === 'Escape' || (e.code === 'KeyB' && modal.querySelector('.boon-tray-modal'))) { e.preventDefault(); modal.close(); } return; }
  if (!resultScreen.hidden) {
    if (e.code === 'Escape' && resultScreen.dataset.detailsOpen === 'true') resultScreen.querySelector<HTMLButtonElement>('#result-details-toggle')?.click();
    return;
  }
  if (inTown) return;
  const controlFocused = (e.target as HTMLElement).closest('button,a');
  if (e.code === 'Space' && !controlFocused) { e.preventDefault(); pauseMenu(); }
  if (e.code === 'Enter' && !controlFocused && battle.status === 'ready') begin();
  if (e.code === 'KeyB') { e.preventDefault(); showBoonTray(); }
  if (e.code === 'KeyH') battle.potion();
  if (e.code === 'KeyG') battle.guard();
  if (e.code === 'KeyR') battle.ultimate();
  if (e.code === 'Escape') { moveMode = false; closeSkillPicker(); renderInspector(); }
  if (/^Digit[1-9]$/.test(e.code)) { const h = battle.heroes.find(h => h.slot === Number(e.code.slice(-1)) - 1); if (h) { sound.unlock(); tapHero(h.id); } }
  if (e.code === 'KeyQ' || e.code === 'KeyE') cycleSkill(battle.selected, e.code === 'KeyE' ? 1 : -1);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !inTown && battle.status === 'fighting') pauseMenu(); });
scene = new BattleScene(battle, sound, frame);
scene.reducedMotion = !profile.motion;
document.body.classList.toggle('reduced-motion', !profile.motion);
new Phaser.Game({ type: Phaser.AUTO, parent: 'game-canvas', width: ARENA.width, height: ARENA.height, backgroundColor: '#0e1e19', pixelArt: true, roundPixels: true, antialias: false, scene: [scene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 3 }, audio: { noAudio: true }, render: { preserveDrawingBuffer: true }, banner: false });
initialized = true;
showTown();
if (typeof navigator !== 'undefined' && !navigator.webdriver) {
  titleScreenEl.classList.add('press-phase');
  showTitleScreen();
}
void commander.open().then(documents => { if (documents.length > 0) { const latest = [...documents].sort((a, b) => b.lastPlayed - a.lastPlayed)[0]; activateCommander(latest); } }).catch(error => { commander.error=String(error); storageStatus(); });
if (import.meta.env.DEV) Object.assign(window, { gridbound: {
  snapshot: () => battle.snapshot(), profile: () => structuredClone(profile),
  get battle() { return battle; }, get inTown() { return inTown; },
  get runBoons() { return runBoons; },
  setRunBoons: (b: string[]) => { runBoons = [...b]; battle.boons = [...b]; updateExpedition(); },
  step: (seconds: number) => { for (let t = 0; t < Math.min(600, Math.max(0, seconds)); t += 1 / 60) battle.tick(1 / 60); frame(1); },
  boot, scene, showTitle: showTitleScreen, hideTitle: enterEmberhollow, showBoonTray, chapterIntro, recruitScene: (id: number) => recruitScene(id, true),
} });
