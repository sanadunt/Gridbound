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
import { townSceneDataURL } from './art/town-scene';
import { Battle, GUARD_DURATION, ENRAGE_WARN, ENRAGE_AT, ENRAGE_DMG, BREAK_SECONDS, MOVE_PENALTY, MARK_DAMAGE, WEAKEN_DAMAGE, type BattleEvent, type BattleOptions } from './game/simulation';
import { KITS, ROSTER, type Mode } from './game/content';
import { CHARACTERS } from './game/characters';
import { CAMPAIGN, BOONS, ENEMIES, boonChoices } from './game/world';
import { promote, equipGear, buyTalent, equipSkill, respecHero, moveFormation, completeZone, profileModifiers, canEnterZone, settleProgress, claimQuest, syncProfileEconomy, buyChallengeUnlock, ownsChallengeUnlock, refineGear, bankPouch, claimStarChest, recordChapterResult, chapterReward } from './game/profile';
import { DEPTHS, startRun, enterNode, chooseEvent, openTreasure, campChoice, resolveFight, fleeFight, interruptFight, noteFight, dungeonBattleOptions, type Outcome, type Pouch } from './game/dungeon';
import { chapterStars, STAR_PAR_SECONDS } from './game/journey';
import { renderTown, routeTitle, portrait, type TownState, type TownTab } from './ui/town';
import { partyPower, powerVerdict, recommendedHeroicPower, recommendedPower } from './game/power';
import { claimAllQuests, questGearText } from './ui/quests';
import { UNLOCKS, isFeature, markIntro, markVisited, noteModesInUse, pendingIntros, routeLocked, type Feature } from './ui/unlocks';
import { menuBadge } from './ui/badges';
import { pushRoute, backRoute } from './ui/route-stack';
import { defeatFixes, xpSummary } from './ui/result-help';
import { COACH_STEPS, Coach, coachEnabled, coachDone, markCoach, resetCoach, setCoachEnabled, skipCoach, type CoachStep } from './ui/coach';
import { actArt, starRow } from './ui/world-map';
import { playDialogue, paginate, type DialoguePage } from './ui/dialogue';
import { BattleScene, ARENA, cell } from './render/BattleScene';
import { ResultGate, RESULT_INPUT_DELAY_MS, type ResultGateGeneration } from './ui/result-gate';
import { Sound } from './audio/sound';
import { loadSave, saveProfile, backupLegacy, legacyBackup, commanderFromBackup, isCompleteV3, SAVE_KEY } from './game/save';
import { createProfile, FALLEN_XP, type Profile } from './game/profile';
import { heroProgress } from './game/levels';
import { CommanderSession } from './game/commander-session';
import { CommanderError, copyLegacyToCommander, createCommanderDocument, createRunCheckpoint, errorCode, terminalRun, storedStateFor, materializeProfile, type CommanderDocument, type CommanderMode, type SlotId } from './game/commander';
import { storyBattleOptions, setStoryParty, normalizeStoryParty, storyPartyCap, storyPartyLocked } from './game/story-party';
import { createRogueBuild, setRogueJobs, rogueUpgrades } from './game/roguelike-build';
import { JOBS, GEAR } from './game/jobs';
import { defaultRaidBuild, setRaidJob, setRaidHero, setRaidPartySize, normalizeRaidBuild, openRaidQuarry, raidQuarryUnlocked } from './game/raid-build';
import { QUESTS, questProgress } from './game/quests';
import { BELL_TONIC, CHALLENGE_SHOP, RELIC_IDS, bankShopItem, createRunWallet, resetRunWallet, getRaidContractForEnemy, sandboxRaidContract, roguelikeMilestoneForFloor, buyRunItem, buyBellTonic, boonDraftSize, raidModifierAvailable, type RaidModifierId, type RaidSandbox, type RaidTier, type RunWallet } from './economy/challenge';
import { t, lang, setLang, errorText, fmtInt, fmtDec, fmtSec, fmtDateTime, type Lang } from './i18n';
import { localizeContent, eventText } from './i18n/content';
import { version } from '../package.json';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const store = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
localizeContent(lang());
document.documentElement.lang = lang();
const saved=loadSave(store);
let profile = saved.profile;
const commander = new CommanderSession();
let encounter: NonNullable<CommanderDocument['encounters']>[CommanderMode];
let pendingSettlement = false;
const reduceMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
/** Effective motion: the player's Motion setting, unless the device asks for reduced motion (the saved setting is never overwritten). */
const motionOn = () => profile.motion && !reduceMotionQuery.matches;
let storageFailed = false;
const heroName = (h: { name: string }) => eventText(h.name, lang());
const stageLabel = () => eventText(battle.stageName, lang());
/** A battle hero's portrait: roster heroes keep their own look (also on a Raid class swap); Roguelike recruits use the class sprite. */
const face = (h: { id: number; classId: keyof typeof KITS }) => portrait(h.classId, 0, battle.mode === 'endless' ? undefined : h.id);
const modeName = (mode: CommanderMode) => t(mode === 'story' ? 'mode.campaign' : mode === 'raid' ? 'mode.raid' : 'mode.endless');
function updateTitleStatus() {
  const nameEl = $('title-commander-name');
  if (!nameEl) return;
  nameEl.textContent = `${commander.document?.name || t('title.recruit')} · ${modeName(commander.mode)}`;
  // A brand-new save has nothing to continue: the first option reads Begin.
  const fresh = !hasProgress(profile), enter = $('title-enter');
  setText(enter.querySelector('.menu-title')!, t(fresh ? 'title.begin' : 'title.enter'));
  setText(enter.querySelector('.menu-subtext')!, t(fresh ? 'title.begin.sub' : 'title.enter.sub'));
}
function titleMarkup() {
  return `<div class="title-backdrop" aria-hidden="true"><img class="title-world-art" alt="" /><div class="title-vignette"></div></div>
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
  <footer class="title-footer"><div class="title-active-commander" id="title-commander-status"><b>${t('title.active')}</b> <span id="title-commander-name"></span></div><div class="title-meta-info"><span>© EMBERHOLLOW</span><span>v${version.split('.').slice(0, 2).join('.')}</span></div></footer>`;
}
function showTitleScreen(animated = true) {
  const titleScreen = $('title-screen');
  if (!titleScreen) return;
  titleScreen.classList.remove('dismissing');
  // The backdrop is drawn on the first showing (never under automation, which skips the title), from the camp's cached scene.
  const art = titleScreen.querySelector<HTMLImageElement>('.title-world-art');
  if (art && !art.src) art.src = townSceneDataURL();
  titleScreen.hidden = false;
  updateTitleStatus();
  if (animated && motionOn()) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.fromTo('.title-logo', { opacity: 0, y: -30, scale: 1.4 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.6)' })
      .fromTo('.title-flourish', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'power3.out' }, '-=0.2')
      .fromTo('.title-menu', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, clearProps: 'transform' }, '-=0.1')
      .fromTo('.title-footer', { opacity: 0 }, { opacity: 1, duration: 0.3, clearProps: 'all' }, '-=0.2');
  }
  requestAnimationFrame(() => $('title-enter')?.focus({ preventScroll: true }));
}
function animateTownEntrance() {
  if (!motionOn()) return;
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
  if (motionOn()) {
    const tl = gsap.timeline({
      onComplete: () => {
        titleScreen.hidden = true;
        titleScreen.classList.remove('dismissing');
        gsap.set([titleScreen, '.title-menu'], { clearProps: 'all' });
        animateTownEntrance();
        if (inTown && townState.tab === 'camp') void playCampScenes();
      }
    });
    tl.to('#title-enter', { x: 8, duration: 0.08, yoyo: true, repeat: 1 })
      .to(titleScreen, { opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.12);
  } else {
    titleScreen.classList.add('dismissing');
    setTimeout(() => {
      titleScreen.hidden = true;
      titleScreen.classList.remove('dismissing');
      if (inTown && townState.tab === 'camp') void playCampScenes();
    }, 250);
  }
}
/** HUD wallet: Story gold and challenge Crystal in every mode. Each mode's profile zeroes the currency it cannot spend, so the other one comes from the Commander document. */
function walletAmounts() {
  const doc = commander.document;
  return { gold: doc && commander.mode !== 'story' ? doc.story.slots.find(slot => slot.slotId === 'auto')?.state?.gold ?? 0 : profile.gold, crystal: doc && commander.mode === 'story' ? doc.shared.bankCrystal : profile.economy.commanderCrystal };
}
function storageStatus() {
  const wallet = walletAmounts();
  $('wallet').innerHTML = currencyAmount('gold', wallet.gold);
  $('bank-wallet').innerHTML = currencyAmount('crystal', wallet.crystal);
  const status = $('storage-status');
  // Warn only after a failed, stale or blocked save; a save in flight is the quiet 'busy' level.
  const warning = saved.readOnly && saved.warning ? errorText(saved.warning) : commander.error ? errorText(commander.error) : commander.failed || (!commander.document && storageFailed) ? t('storage.dirty') : '';
  status.textContent = warning || (!commander.document ? t('storage.none') : commander.dirty ? t('storage.saving') : commander.repository?.persistent ? t('storage.saved') : legacyMirrored() ? t('storage.session.kept') : t('storage.session'));
  status.dataset.level = warning || (commander.document && !commander.repository?.persistent) ? 'warn' : commander.dirty ? 'busy' : 'ok';
  // The revision stays out of the visible text (developer jargon) but is kept on the element for bug reports and tests.
  status.dataset.revision = commander.document ? String(commander.document.revision) : '';
  updateTitleStatus();
}
/** A storage failure the player must see: its code goes to the status bar (errorText), the raw message only to the console. */
function storageError(error: unknown) {
  commander.error = errorCode(error); commander.errorDetail = error instanceof Error ? error.message : String(error);
  console.warn('Commander storage:', error);
  storageStatus();
}
function context(slotId: SlotId = 'auto') {
  return { mode: commander.mode, slotId, profile, rogueBuild: townState.rogueSetup, raidBuild: townState.raidBuild, raidContract: getRaidContractForEnemy(townState.raid,townState.raidTier,townState.raidModifiers), raidSandbox: townState.raidSandbox };
}
/** Session-only Commander whose Story progress and bank reached gridbound.v3 (mirrorLegacy), so a reload keeps them. */
const legacyMirrored = () => !saved.readOnly && !storageFailed;
function writeLegacy(source: Profile) {
  try { saveProfile(store, source, saved.readOnly); storageFailed = false; } catch { storageFailed = true; }
}
/** Session-only Commander (no IndexedDB): keep its Story progress and bank in gridbound.v3, so progress never lives only in RAM and the next visit migrates it again. Challenge profiles (0 gold) never reach the key. */
function mirrorLegacy() {
  const doc = commander.document;
  if (!doc || saved.readOnly || commander.repository?.persistent) return;
  const story = materializeProfile(doc, 'story');
  story.economy.commanderCrystal = doc.shared.bankCrystal; story.challengeUnlocks = [...doc.shared.challengeUnlocks];
  writeLegacy(story);
}
/** Commander lookup/migration at boot has finished; until then gridbound.v3 is not rewritten. */
let commanderChecked = false;
/** Revision and context of the last successful save: re-rendering an unchanged town does not commit a new revision. */
let savedSignature = '';
function persist(slotId: SlotId = 'auto', edit?: (document: CommanderDocument) => void) {
  if (pendingSettlement && !edit) return Promise.resolve(false);
  if (saved.readOnly && !commander.document) { storageStatus(); return Promise.resolve(false); }
  syncProfileEconomy(profile);
  const doc = commander.document;
  // A browser-persistent Commander holds the progress: gridbound.v3 stays the untouched migration source.
  if (!doc) { if (commanderChecked) writeLegacy(profile); storageStatus(); return Promise.resolve(false); }
  const runtime = context(slotId), json = JSON.stringify(runtime);
  if (!edit && !commander.dirty && !commander.stale && savedSignature === `${doc.commanderId}:${doc.revision}:${json}`) { storageStatus(); return Promise.resolve(true); }
  return commander.save(runtime, edit).then(ok => {
    storageFailed = !ok;
    if (ok && commander.document) { savedSignature = `${commander.document.commanderId}:${commander.document.revision}:${json}`; mirrorLegacy(); }
    return ok;
  });
}
const sound = new Sound();
sound.enabled = profile.sound;
let battle = new Battle('adventure', 1, profileModifiers(profile), storyBattleOptions(profile));
let scene: BattleScene;
let inTown = true;
let initialized = false;
let engine: Phaser.Game | undefined;
/** The Phaser loop runs only while a fight is on screen: in town (once the result screen is closed) it sleeps, so the hidden arena is not redrawn every frame; boot() wakes it. */
function engineAwake(awake: boolean) { const loop = engine?.loop; if (!loop?.started) return; if (awake) loop.wake(); else if (resultScreen.hidden && $('battle-screen').hidden) loop.sleep(); }
let recorded = false;
let chapterResult: { stars: number; improved: boolean; heroic?: { gold: number; materials: Record<string, number> } } | undefined;
/** What the last settled result credited (gold for Story, bank Crystal otherwise) and the party cap it unlocked (0 = unchanged). */
let resultReward: { gold: number; crystal: number; partyCap: number; firstClear?: boolean } | undefined;
/** The current adventure battle's start checkpoint ('Retry this battle'); cleared whenever a new battle is booted. */
let stageStart: NonNullable<typeof encounter> | undefined;
let experienceRewards:NonNullable<ReturnType<typeof settleProgress>>=[];
let lastStatus = battle.status;
let drawIn = 0;
/** DOM writes that skip unchanged values, so a label or text is only touched (and re-read by assistive tech) when it changes. */
const setText = (el: Element, text: string) => { if (el.textContent !== text) el.textContent = text; };
const setAttr = (el: Element, name: string, value: string) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
/** Heroes seen down in this battle (frame() announces one that gets back up). */
const downed = new Set<number>();
/** One visually hidden polite live region (#battle-announcer) speaks the fight's meaningful moments: a threat's onset with its target and
 *  seconds, a hero down or back up, a boss phase, an armour break, victory and defeat. At most one message per ANNOUNCE_GAP_MS; a burst keeps
 *  the newest ANNOUNCE_QUEUE messages (urgent ones clear the queue). The per-frame HUD text (countdowns, banners) is not live. */
const ANNOUNCE_GAP_MS = 1500, ANNOUNCE_QUEUE = 2;
/** A message, or a function that builds it when it is spoken (and returns '' when it is no longer true). */
type Announcement = string | (() => string);
let announceQueue: Announcement[] = [], announceTimer = 0, lastAnnounce = -Infinity;
function announce(text: Announcement, urgent = false) {
  if (inTown || !text) return;
  if (urgent) announceQueue = [];
  announceQueue.push(text);
  announceQueue.splice(0, Math.max(0, announceQueue.length - ANNOUNCE_QUEUE));
  flushAnnounce();
}
function flushAnnounce() {
  if (inTown) { announceQueue = []; return; }
  if (announceTimer || !announceQueue.length) return;
  const wait = lastAnnounce + ANNOUNCE_GAP_MS - performance.now();
  if (wait > 0) { announceTimer = window.setTimeout(() => { announceTimer = 0; flushAnnounce(); }, wait); return; }
  const next = announceQueue.shift()!, text = typeof next === 'function' ? next() : next, el = $('battle-announcer');
  if (!text) { flushAnnounce(); return; }
  // The same sentence twice in a row is still news: a trailing no-break space makes it a change screen readers speak.
  el.textContent = el.textContent === text ? `${text}\u00a0` : text;
  lastAnnounce = performance.now();
  flushAnnounce();
}
function clearAnnouncer() { announceQueue = []; window.clearTimeout(announceTimer); announceTimer = 0; downed.clear(); const el = document.getElementById('battle-announcer'); if (el) el.textContent = ''; }
/** A new telegraph, spoken once: who it targets (a marked hero, or whoever stands on the marked tiles) and in how many whole seconds.
 *  The sentence is built when it is spoken (a queued message can wait ~3 s), and a threat that has landed or lands within a second is dropped. */
function announceThreat(e: BattleEvent) {
  const id = [...battle.threats].reverse().find(v => v.name === e.text)?.id;
  if (id === undefined) return;
  announce(() => {
    const threat = battle.threats.find(v => v.id === id);
    if (!threat || threat.left < 1) return '';
    const name = eventText(threat.name, lang()), s = Math.floor(threat.left), time = t('a11y.seconds', { s });
    if (threat.type === 'all') return t('a11y.threat.all', { name, time });
    const ids = threat.targetId !== undefined ? [threat.targetId] : battle.living().filter(h => threat.slots.includes(h.slot)).map(h => h.id);
    return ids.length ? t('a11y.threat', { name, time, targets: ids.map(id => heroLabel(id)).join(', ') }) : t('a11y.threat.none', { name, time });
  });
}
let moveMode = false;
let selectedKey = '';
let bannerTimer = 0;
let runBoons: string[] = [];
let runWallet: RunWallet = createRunWallet();
let runSeed = Date.now() % 1000000;
/** Fate Rerolls bought for the current room; shifts the seed of the boon draft that follows it. */
let boonReroll = 0;
let huntTarget: string | undefined;
let offeredBoons: typeof BOONS = [];
let resumeOnClose = false;
let pauseForDetails = false;
type PartyHealthView = { button: HTMLButtonElement; hp: HTMLElement; shield: HTMLElement; cooldown: HTMLElement; healthFill: HTMLElement; shieldFill: HTMLElement; atb: HTMLElement };
type PartyHero = (typeof battle.heroes)[number];
const partyHealthViews = new Map<number, PartyHealthView[]>();
let resultGeneration: ResultGateGeneration | undefined;
const townState: TownState = {
  tab: 'camp', hero: 0, zone: Math.min(profile.cleared.length, CAMPAIGN.length - 1), raid: 'golem', raidTier: 'bronze', raidModifiers: [], raidBuild: defaultRaidBuild(profile), notice: '',
  trainingTab: 'formation', campaignPage: 0,
};
/** Town routes visited since the camp, for the HUD ◀ (see ui/route-stack). */
let routeStack: TownTab[] = ['camp'];
/** First-battle coach state (see coachFrame). */
let coachForced = false, coachThreat = -1, coachHero = -1, coachUntil = 0;
const coach = new Coach(document.body, () => { skipCoach(); endCoachStep(); });
/** The first hero to fall in the current battle and stage, for the defeat screen. */
let firstFall: { battle: Battle; stage: number; name: string; cause: string } | undefined;
/** Selecting another chapter drops the Heroic toggle: Heroic is chosen per chapter, never carried over. */
function selectZone(zone: number) { if (zone !== townState.zone) townState.heroic = false; townState.zone = zone; }

$('app').innerHTML = `
<section id="title-screen" class="title-screen" hidden>${titleMarkup()}</section>
<header class="site-header hud-bar">
  <button class="brand" id="home" aria-label="${t('hud.home')}"><span class="brand-back" aria-hidden="true">◀</span><span id="hud-title">${t('town.name')}</span></button>
  <div class="header-tools"><b id="wallet" class="wallet">${currencyAmount('gold', walletAmounts().gold)}</b><b id="bank-wallet" class="wallet bank-wallet">${currencyAmount('crystal', walletAmounts().crystal)}</b><button id="sound" class="icon-button" aria-label="${t('hud.sound')}" aria-pressed="${profile.sound}">♫</button><button id="settings" class="icon-button" aria-label="${t('hud.settings')}">⚙</button><button id="menu-button" class="icon-button menu-button" data-facility="more" aria-label="${t('route.menu')}">${t('hud.menu')}</button></div>
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
      <div class="arena-intel">
        <div id="boss-status" class="boss-status" aria-label="${t('battle.status.aria')}"></div>
        <div id="intent" class="intent-panel msg-window"><b></b><span></span></div>
      </div>
      <div id="arena" class="arena">
        <div id="game-canvas" aria-hidden="true"></div>
        <div id="banner" class="battle-banner" aria-hidden="true"></div>
        <div id="skill-toast" class="skill-toast" role="status" aria-live="polite" hidden></div>
        <div class="lane-targets" aria-label="${t('battle.lanes')}">${[0, 1, 2].map(i => `<button data-lane="${i}" aria-label="${t('battle.lane', { n: i + 1 })}" aria-pressed="false"><span>${['I', 'II', 'III'][i]}</span></button>`).join('')}</div>
        <div id="unit-layer"></div>
        <div id="skill-picker" class="win skill-picker" role="dialog" hidden></div>
        <div class="board-bottom"><span id="standing"></span><span id="move-tip"></span></div>
        <section id="start-overlay" class="start-overlay" aria-labelledby="ready-title">
          <div class="win start-window">
            <small id="ready-label"></small>
            <h3 id="ready-title"></h3>
            <p id="ready-copy"></p>
            <p id="ready-tip" class="ready-tip" hidden>${t('ready.copy.story')}</p>
            <button id="start" class="btn primary">${t('battle.begin')}</button>
          </div>
        </section>
      </div>
      </div>
      <button id="focus-bar" type="button" class="win focus-bar" aria-label="${t('battle.focus.aria')}"><img class="focus-face" alt=""/><span class="focus-id"><b class="focus-name"></b><small class="focus-skill"></small></span><span class="focus-stats"><span class="focus-hp">HP <b></b></span><span class="focus-status"></span></span></button>
      <div class="action-bar">
        <button id="guard" class="cmd guard-button"><span>${t('battle.guard')}<small><kbd class="key-hint">G</kbd><span id="guard-label"></span></small></span></button>
        <button id="potion" class="cmd potion-button"><span>${t('battle.potion')}<small><kbd class="key-hint">H</kbd></small></span><b>2</b></button>
        <button id="ultimate" class="cmd ultimate-button" disabled><i id="resolve-fill"></i><span>${t('battle.ultimate')}<small><kbd class="key-hint">R</kbd><span id="resolve-label"></span></small></span></button>
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
  <div id="battle-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  <dialog id="modal" aria-labelledby="modal-title"></dialog>`;
const modal = $<HTMLDialogElement>('modal');
const resultScreen = $<HTMLElement>('result-screen');

/** Unsettled Raid and Bell Trials encounters of the open file: what Depart would resume. */
function suspendedRuns(): NonNullable<TownState['suspended']> {
  const encounters = commander.document?.encounters, raid = encounters?.raid && !encounters.raid.settled ? encounters.raid.battle : undefined, rogue = encounters?.roguelike && !encounters.roguelike.settled ? encounters.roguelike.battle : undefined;
  return { ...(raid ? { raid: { enemy: raid.enemyId, tier: raid.raidContract?.tier ?? 'bronze', practice: Boolean(raid.raidContract?.sandbox) } } : {}), ...(rogue ? { roguelike: { floor: rogue.floor } } : {}) };
}
function modeForTownTab(tab: TownTab, fallback = commander.mode): CommanderMode {
  if (tab === 'raid') return 'raid';
  if (tab === 'endless') return 'roguelike';
  if (tab === 'camp' || tab === 'quests' || tab === 'dungeon') return 'story';
  if (tab === 'challenge-shop') return fallback === 'story' ? 'raid' : fallback;
  if (tab === 'more' || tab === 'bestiary') return fallback;
  return 'story';
}

function showTown(tab: TownTab = townState.tab, notice = '', animate = false) {
  // A mode the story has not reached yet is never shown (a restored Raid/Trials mode, a stale link): the camp explains when it opens.
  // A Commander with a run in that mode (an older file, a suspended run) keeps it reachable.
  noteModesInUse(commander.document);
  if (routeLocked(profile, tab)) { notice = lockNotice(tab as Feature); tab = 'camp'; }
  const routeChanged = tab !== townState.tab;
  const nextMode = modeForTownTab(tab);
  // Re-materialize the target mode's profile; persisting the previous mode's profile under the new mode would write challenge zeros into Story (or Story's 0 Crystal into the bank).
  // With an unsaved, in-flight or stale save the current mode stays (navigateTown flushes first), so a failed write is retried rather than dropped.
  if (commander.document && nextMode !== commander.mode && !commander.dirty && !commander.busy && !commander.stale) activateCommander(commander.document, nextMode, false);
  // An Undercroft fight a reload cut short resolves as a flee when the Undercroft opens (saved by the persist below).
  if (tab === 'dungeon') settleInterruptedFight();
  inTown = true;
  clearAnnouncer();
  pauseForDetails = false;
  if (battle.status === 'fighting') battle.pause();
  if (coach.step) endCoachStep();
  townState.tab = tab;
  townState.notice = notice;
  // A locked quarry (unseen boss, chapter not cleared) is never offered: fall back to the first open one.
  if (tab === 'raid') { townState.raid = openRaidQuarry(profile, townState.raid) ?? townState.raid; huntTarget = undefined; }
  // A suspended Raid or Bell Trials run locks its setup and names itself on the departure button (Depart resumes it).
  townState.suspended = suspendedRuns();
  if ((tab === 'raid' && townState.suspended.raid) || (tab === 'endless' && townState.suspended.roguelike)) townState.tonic = false;
  $('town-screen').hidden = false;
  $('battle-screen').hidden = true;
  engineAwake(false);
  document.body.dataset.screen = tab === 'camp' ? 'camp' : 'town';
  routeStack = pushRoute(routeStack, tab);
  if (isFeature(tab)) markVisited(tab);
  const title = routeTitle(tab);
  $('hud-title').textContent = title;
  $('home').dataset.long = String(title.length > 10);
  // ◀ goes back one route; on the camp the title opens the MENU (the Title screen is MENU → Title).
  $('home').setAttribute('aria-label', tab === 'camp' ? t('route.menu') : t('hud.home'));
  const waiting = menuBadge(profile), menuButton = $('menu-button');
  menuButton.dataset.badge = waiting ? String(waiting) : '';
  menuButton.setAttribute('aria-label', waiting ? t('hud.menu.waiting', { n: waiting }) : t('route.menu'));
  // Keep the scroll position when a screen re-renders in place (equipping, inspecting, learning, claiming).
  const scrollers = '[data-training-panel], .party-scene, .secondary-content, .more-scene, .world-map-wrapper';
  const oldPanel = $('town-screen').querySelector<HTMLElement>('[data-training-panel]');
  const kept = routeChanged ? [] : Array.from($('town-screen').querySelectorAll<HTMLElement>(scrollers), el => ({ key: el.dataset.trainingPanel ?? el.className, top: el.scrollTop }));
  const keptPanel = oldPanel?.dataset.trainingPanel;
  renderTown($('town-screen'), profile, townState);
  $('town-screen').querySelectorAll<HTMLElement>(scrollers).forEach(el => { const old = kept.find(k => k.key === (el.dataset.trainingPanel ?? el.className)); if (old && (!el.dataset.trainingPanel || el.dataset.trainingPanel === keptPanel)) el.scrollTop = old.top; });
  if (routeChanged) {
    const scene = $('town-screen').querySelector<HTMLElement>('.town-scene');
    const heading = scene?.querySelector<HTMLElement>('h1') ?? scene;
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    // Back in the Undercroft with news (a fled or interrupted fight): open on the room panel that explains it.
    if (tab === 'dungeon' && townState.dungeonOutcome) scene?.querySelector('.room-panel')?.scrollIntoView({ block: 'end' });
  }
  persist();
  if (animate && motionOn()) {
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
  if (tab === 'camp') void playCampScenes().then(() => unlockIntro());
}
const lockNotice = (feature: Feature) => t('unlock.locked', { name: routeTitle(feature), n: UNLOCKS[feature] });
let unlockShowing = false;
/** A one-time card when the story opens a mode (Undercroft, Raids, Bell Trials); skipped under automation like the camp scenes. */
function unlockIntro(force = false) {
  if (unlockShowing || (!force && navigator.webdriver) || !commanderChecked || !inTown || townState.tab !== 'camp' || playingScene || campScenesRunning || modal.open || commander.stale || pendingSettlement || $('title-screen')?.hidden === false) return;
  const features = pendingIntros(profile);
  if (!features.length) return;
  features.forEach(markIntro);
  unlockShowing = true;
  openModal(`<div class="unlock-card"><small class="unlock-kicker">${t('unlock.kicker')}</small>${features.map((f, i) => `<section class="unlock-entry" data-unlock="${f}"><h2 ${i ? '' : 'id="modal-title"'}>${t(`unlock.${f}.title` as never)}</h2><p>${t(`unlock.${f}.body` as never)}</p><button class="btn primary" data-unlock-go="${f}">${t('unlock.go')} ▶</button></section>`).join('')}<button class="btn" data-close>${t('unlock.later')}</button></div>`);
  modal.querySelectorAll<HTMLButtonElement>('[data-unlock-go]').forEach(button => button.addEventListener('click', () => { modal.close(); void navigateTown(button.dataset.unlockGo as TownTab); }));
  modal.addEventListener('close', () => { unlockShowing = false; }, { once: true });
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
    // The Undercroft run fights with the party it set out with; it is locked until the run ends.
    if (storyPartyLocked(profile)) { showTown('party', t('dungeon.party.locked')); return; }
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
    townState.dungeonOutcome = townState.dungeonLetter = undefined; sound.play('confirm');
    showTown('dungeon', '', true);
    return;
  }
  if (button.dataset.dungeonNode && profile.journey.run) {
    if (enterNode(profile.journey.run, Number(button.dataset.dungeonNode))) { townState.dungeonOutcome = townState.dungeonLetter = undefined; sound.play('cursor'); showDungeonRoom(); }
    return;
  }
  if (button.hasAttribute('data-dungeon-fight')) { startDungeonFight(); return; }
  if (button.dataset.dungeonChoice && profile.journey.run) {
    const out = chooseEvent(profile.journey.run, button.dataset.dungeonChoice);
    if (out) { townState.dungeonOutcome = describeOutcome(out); townState.dungeonLetter = out.lore; sound.play(out.fight ? 'threat' : out.hurt ? 'hurt' : 'buff'); showDungeonRoom(); }
    return;
  }
  if (button.hasAttribute('data-dungeon-open') && profile.journey.run) {
    const out = openTreasure(profile.journey.run);
    if (out) { townState.dungeonOutcome = describeOutcome(out); townState.dungeonLetter = undefined; sound.play('coin'); showDungeonRoom(); }
    return;
  }
  if (button.dataset.dungeonCamp && profile.journey.run) {
    const run = profile.journey.run, choice = button.dataset.dungeonCamp as 'rest' | 'extract';
    if (campChoice(run, choice)) {
      if (choice === 'extract') bankPouch(profile, run.pouch);
      townState.dungeonOutcome = choice === 'rest' ? t('dungeon.out.rest') : undefined; townState.dungeonLetter = undefined;
      sound.play(choice === 'rest' ? 'heal' : 'fanfare');
      showDungeonRoom();
    }
    return;
  }
  if (button.hasAttribute('data-dungeon-leave')) {
    openModal(`<h2 id="modal-title">${t('dungeon.leave.title')}</h2><p>${t('dungeon.leave.copy')}</p><button id="dungeon-abandon" class="btn danger">${t('dungeon.leave.yes')}</button><button class="btn" data-close>${t('common.cancel')}</button>`);
    $('dungeon-abandon').addEventListener('click', () => { modal.close(); delete profile.journey.run; showTown('dungeon'); });
    return;
  }
  if (button.hasAttribute('data-dungeon-close')) { delete profile.journey.run; townState.dungeonOutcome = townState.dungeonLetter = undefined; showTown('dungeon'); return; }
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
  // A locked hotspot or gate tab explains which chapter opens it.
  if (button.dataset.locked) { sound.play('cursor'); showTown(townState.tab, lockNotice(button.dataset.locked as Feature)); return; }
  // Camp → the next chapter's dossier in one tap.
  if (button.dataset.continueStory !== undefined) {
    const zone = Number(button.dataset.continueStory);
    if (!canEnterZone(profile, zone)) return;
    selectZone(zone); townState.campaignPage = zone; sound.play('confirm');
    void navigateTown('mission');
    return;
  }
  if (button.hasAttribute('data-claim-all')) {
    const { claimed, gold, gear } = claimAllQuests(profile, townState.hero);
    if (claimed.length) sound.play('coin');
    showTown('quests', claimed.length ? t(gear.length ? 'notice.quest.all.gear' : 'notice.quest.all', { n: claimed.length, gold, gear: questGearText(gear) }) : t('notice.quest.fail'), true);
    $('town-screen').querySelector('.secondary-content')?.scrollTo({ top: 0 });
    return;
  }
  if (button.dataset.facility) {
    townState.pendingGear = undefined;
    if (button.dataset.trainingTab) townState.trainingTab = button.dataset.trainingTab as TownState['trainingTab'];
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
    showTown('party', ok ? t('notice.loadout') : t('notice.loadout.fail'), true);
    if (ok) celebrate(`[data-loadout-slot="${button.dataset.skillSlot}"]`);
    return;
  }
  if (button.dataset.inspectTalent) {
    townState.selectedTalent = button.dataset.inspectTalent;
    showTown('party-advanced');
    // The inspector (with its Learn button) sits below the tree: bring it on screen, as gear selection does with its preview.
    document.querySelector('.talent-inspector-section')?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (button.dataset.branch) { townState.talentBranch = button.dataset.branch; townState.selectedTalent = undefined; showTown('party-advanced', '', true); return; }
  if (button.dataset.trainingTab) {
    townState.trainingTab = button.dataset.trainingTab as TownState['trainingTab'];
    townState.tab = button.dataset.trainingTab === 'overview' || button.dataset.trainingTab === 'jobs' || button.dataset.trainingTab === 'talents' ? 'party-advanced' : 'party';
    showTown(townState.tab, '', true);
    return;
  }
  if (button.dataset.campaignPage) {
    const delta = Number(button.dataset.campaignPage);
    selectZone(Math.max(0, Math.min(CAMPAIGN.length - 1, townState.zone + delta)));
    townState.campaignPage = townState.zone;
    sound.clink();
    showTown('campaign', '', true);
    return;
  }
  if (button.dataset.bestiaryPick) {
    townState.bestiaryPick = button.dataset.bestiaryPick;
    sound.play('cursor');
    showTown('bestiary');
    document.querySelector('.bestiary-detail')?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (button.dataset.townHero) {
    townState.hero = Number(button.dataset.townHero);
    townState.pendingGear = undefined;
    showTown(townState.tab === 'party-advanced' ? 'party-advanced' : 'party', '', true);
    if (motionOn()) {
      const heroBtn = document.querySelector<HTMLElement>(`[data-town-hero="${townState.hero}"]`);
      if (heroBtn) gsap.fromTo(heroBtn, { scale: 0.93 }, { scale: 1, duration: 0.22, ease: 'back.out(2)', clearProps: 'transform' });
    }
  }
  if (button.dataset.act !== undefined) {
    const actId = Number(button.dataset.act);
    const startZone = actId * 4;
    const actZones = [startZone, startZone + 1, startZone + 2, startZone + 3];
    const target = actZones.find(z => !profile.cleared.includes(z)) ?? startZone;
    selectZone(target);
    townState.campaignPage = target;
    sound.clink();
    showTown('campaign', '', true);
    return;
  }
  if (button.dataset.zone || button.dataset.mission) {
    selectZone(Number(button.dataset.zone ?? button.dataset.mission));
    townState.campaignPage = townState.zone;
    sound.clink();
    showTown('mission', '', true);
    return;
  }
  if (button.dataset.raid) { townState.raid = button.dataset.raid; townState.raidSandbox = undefined; showTown('raid', '', true); return; }
  if (button.dataset.raidVariant) { townState.raid = button.dataset.raidVariant; townState.raidSandbox = undefined; showTown('raid'); return; }
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
    const ok=claimQuest(profile,questId,townState.hero);
    const gearName = ok && ok.gear ? GEAR.find(g => g.id === ok.gear)?.name ?? ok.gear : '';
    showTown('quests',ok?t(!ok.gear ? 'notice.quest.ok' : ok.refund ? 'notice.quest.gear.refund' : 'notice.quest.ok.gear', { name: ROSTER[ok.hero].name, gear: gearName, gold: ok.refund }):t('notice.quest.fail'), true);
    if (ok && motionOn()) {
      const entry = document.querySelector<HTMLElement>(`[data-quest="${questId}"]`);
      if (entry) gsap.fromTo(entry, { scale: 0.96, filter: 'brightness(1.5)' }, { scale: 1, filter: 'brightness(1)', duration: 0.35, ease: 'back.out(2)', clearProps: 'transform,filter' });
    }
  }
  if(button.dataset.trackQuest){const q=QUESTS.find(q=>q.id===button.dataset.trackQuest);if(q&&questProgress(profile,q).unlocked){profile.trackedQuest=q.id;showTown('quests',t('notice.quest.track'));}}
  // The hunt target survives the switch into Raid mode (activateCommander would restore the stored contract's boss).
  if(button.dataset.questHunt){townState.raid=huntTarget=button.dataset.questHunt;townState.raidSandbox=undefined;navigateTown('raid');}
  if (button.dataset.depart) {
    depart(button.dataset.depart as Mode);
  }
  if (button.dataset.abandonRun) abandonSuspended(button.dataset.abandonRun as 'raid' | 'roguelike');
});
/** Abandon a suspended Raid or Bell Trials run from its setup (confirmed): it ends with no reward and the setup opens again. */
function abandonSuspended(mode: 'raid' | 'roguelike') {
  const tab: TownTab = mode === 'raid' ? 'raid' : 'endless';
  openModal(`<h2 id="modal-title">${t('run.abandon.title')}</h2><p>${t('run.abandon.copy')}</p><button id="abandon-suspended" class="btn danger">${t('run.abandon')}</button><button class="btn" data-close>${t('common.cancel')}</button>`);
  $('abandon-suspended').addEventListener('click', () => {
    modal.close();
    if (!ensureMode(mode, () => abandonSuspended(mode))) return;
    void clearEncounter().then(ok => { if (ok) showTown(tab, t('run.abandon.done')); else if (!commander.stale) unsavedTownModal(() => abandonSuspended(mode)); else storageStatus(); });
  });
}
$('town-screen').addEventListener('change', event => {
  const el = event.target as HTMLSelectElement;
  if (!inTown || commander.stale || pendingSettlement) return;
  if(el.matches('[data-quest-filter]')){townState.questFilter=el.value as 'available'|'all'|'claimed';showTown('quests');return;}
  if(el.matches('[data-quest-recipient]')){townState.hero=Number(el.value);showTown('quests');return;}
  if(el.matches('[data-rogue-slot]')){
    const build=townState.rogueSetup??createRogueBuild();
    const jobs=build.recruits.map(r=>r.classId);
    const slot=Number(el.dataset.rogueSlot);
    if(Number.isInteger(slot)&&slot>=0&&slot<3){jobs[slot]=el.value as never;if(setRogueJobs(build,jobs))townState.rogueSetup=build;}
    showTown('endless');return;
  }
  if(el.matches('[data-bell-tonic]')){const item=bankShopItem(BELL_TONIC)!;townState.tonic=(el as unknown as HTMLInputElement).checked;showTown(townState.tab,townState.tonic?t('notice.tonic.on',{n:item.cost}):t('notice.tonic.off'));return;}
  if(el.matches('[data-raid-hero]')){
    const build=(townState.raidBuild&&normalizeRaidBuild(townState.raidBuild,profile.roster))??defaultRaidBuild(profile);
    const ok=setRaidHero(build,Number(el.dataset.raidHero),Number(el.value),profile.roster);
    if(ok)townState.raidBuild=build;
    showTown('raid',ok?t('notice.raid.hero.ok'):t('notice.raid.hero.fail'));return;
  }
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
    // At most three pacts at once (the contract format's limit); unbuilt pacts are never applied.
    if(!raidModifierAvailable(id)||input.checked&&townState.raidModifiers.length>=3){showTown('raid');return;}
    townState.raidModifiers=input.checked?[...townState.raidModifiers,id]:townState.raidModifiers.filter(value=>value!==id);
    const certified=getRaidContractForEnemy(townState.raid,townState.raidTier,townState.raidModifiers);
    const sandbox=townState.raidSandbox;
    const neutral=!sandbox||([sandbox.hpScale,sandbox.damageScale,sandbox.intervalScale].every(value=>value===1));
    townState.raidSandbox=certified&&neutral?undefined:sandbox??{hpScale:1,damageScale:1,intervalScale:1};
    showTown('raid');return;
  }
  if(el.matches('[data-raid-party-size]')){
    const build=(townState.raidBuild&&normalizeRaidBuild(townState.raidBuild,profile.roster))??defaultRaidBuild(profile);
    const ok=setRaidPartySize(build,Number(el.value),profile.roster);
    if(ok)townState.raidBuild=build;
    showTown('raid',ok?t('notice.raid.party.ok'):t('notice.raid.party.fail'));return;
  }
  if(el.matches('[data-raid-job]')){
    const build=(townState.raidBuild&&normalizeRaidBuild(townState.raidBuild,profile.roster))??defaultRaidBuild(profile);
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
/** Re-render the Undercroft with the current room's panel (outcome and actions) on screen: on a phone it sits below the map. */
function showDungeonRoom() { showTown('dungeon'); $('town-screen').querySelector('.room-panel')?.scrollIntoView({ block: 'end' }); }
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
/** What a flee or a wipe left behind, for notices and the result card. */
function lostText(lost: Pouch) {
  return [lost.gold > 0 ? `${fmtInt(lost.gold)}G` : '', materialList(lost.materials)].filter(Boolean).join(', ') || t('dungeon.lost.none');
}
/** A dungeon battle is on screen and has no result yet (a flee is still possible). */
const dungeonFightLive = () => !inTown && battle.mode === 'dungeon' && ['ready', 'fighting', 'paused'].includes(battle.status);
/** Each hero's HP ratio in the current battle. */
const heroRatios = () => Object.fromEntries(battle.heroes.map(h => [h.id, h.maxHp > 0 ? h.hp / h.maxHp : 0]));
/** Last noted state of the dungeon fight in progress: standing heroes, potions and 10 s of battle time. */
let fightNote = '';
const fightNoteKey = () => `${battle.living().length}:${battle.potions}:${Math.floor(battle.time / 10)}`;
/** A dungeon fight in progress saves its state on every fall, potion and every 10 s, so a reload costs at least as much as fleeing then. */
function noteDungeonFight() {
  const run = profile.journey.run, key = fightNoteKey();
  if (key === fightNote || !run) return;
  fightNote = key;
  if (!pendingSettlement && !commander.stale && noteFight(run, heroRatios(), battle.potions)) persist();
}
/** A fight still marked in progress outside a live battle was cut short (reload, closed tab): it resolves as a flee
 *  once, when the Undercroft is opened (not at boot, so a second tab does not flee the first tab's fight). */
function settleInterruptedFight() {
  const run = profile.journey.run, lost = run && commander.mode === 'story' && !dungeonFightLive() ? interruptFight(run) : undefined;
  if (lost) { townState.dungeonOutcome = t('dungeon.interrupted', { lost: lostText(lost) }); townState.dungeonLetter = undefined; }
  return lost;
}
/** Fight the pending dungeon room with the run's own party, its carried HP, potions and blessings. */
function startDungeonFight() {
  if (!ensureMode('story', startDungeonFight)) return;
  const run = profile.journey.run;
  if (!run?.pendingFight || run.status !== 'active') return;
  if (settleInterruptedFight()) { showTown('dungeon'); return; }
  const options = dungeonBattleOptions(profile, run)!;
  runBoons = [];
  boot('dungeon', options.dungeon!.chapter, options);
}
/** Flee a dungeon fight in progress: wounds and potions used carry over, the room's fight waits and half the pouch is lost. */
function fleeDungeonModal() {
  openModal(`<h2 id="modal-title">${t('dungeon.flee.title')}</h2><p>${t('dungeon.flee.copy')}</p><button id="dungeon-flee" class="btn danger">${t('dungeon.flee.yes')}</button><button class="btn" data-close>${t('common.cancel')}</button>`);
  $('dungeon-flee').addEventListener('click', () => {
    const run = profile.journey.run;
    if (!dungeonFightLive() || !run || pendingSettlement || commander.stale) { modal.close(); return; }
    const lost = fleeFight(run, heroRatios(), battle.potions);
    closeWithoutResume(); inTown = true; townState.dungeonOutcome = townState.dungeonLetter = undefined;
    sound.play('hurt');
    showTown('dungeon', lost ? t('dungeon.fled', { lost: lostText(lost) }) : '', true);
  });
}
// Upgrade feedback: the changed element pops and the level-up jingle plays.
function celebrate(selector: string) {
  sound.play('levelup');
  document.querySelectorAll<HTMLElement>(selector).forEach(el => { el.classList.remove('just-upgraded'); void el.offsetWidth; el.classList.add('just-upgraded'); });
}

let ensureCommanderPromise: Promise<CommanderDocument | undefined> | undefined;
/** Activate the latest Commander, or move the live progress into a new one when there is none (first visit or a pre-Commander save). Concurrent callers share one attempt; a failed attempt is retried by the next caller. */
async function ensureCommander() {
  if (commander.document) return commander.document;
  if (ensureCommanderPromise) return ensureCommanderPromise;
  ensureCommanderPromise = (async () => {
    try {
      const docs = (await commander.open()).sort((a, b) => b.lastPlayed - a.lastPlayed);
      if (!commander.document) {
        if (docs.length > 0) activateCommander(docs[0], undefined, true, true);
        else await migrateLegacy();
      }
      return commander.document;
    } catch (error) { storageError(error); } finally {
      ensureCommanderPromise = undefined;
    }
    return undefined;
  })();
  return ensureCommanderPromise;
}
const legacyRaw = () => { try { return store.getItem(SAVE_KEY) ?? store.getItem('gridbound.v2'); } catch { return null; } };
/** Copy the raw gridbound.v3 to a timestamped backup key (newest 3 kept) before a Commander takes the progress over. */
function backupLegacyNow() { try { return backupLegacy(localStorage, new Date().toISOString()); } catch { return undefined; } }
let migration: Promise<CommanderDocument | undefined> | undefined;
/** Migration: back up gridbound.v3, then create a Commander from the live profile (bank included: there is no other Commander to duplicate it into). At boot a corrupt or blocked legacy save stays read-only and untouched; `manual` (Continue my progress) keeps the live progress anyway, since creating a Commander never writes gridbound.v3. */
function migrateLegacy(name = t('profiles.default.name'), manual = false) {
  // One migration at a time: a Continue click during the boot migration waits for it instead of creating a second copy (and a second bank).
  return migration ??= (async () => {
    if (commander.document || (saved.readOnly && !manual)) return commander.document;
    const run = async () => {
      // Tabs that boot together migrate one at a time: a tab that finds another tab's fresh Commander takes it over instead of creating a second copy and bank.
      const docs = (await commander.open()).sort((a, b) => b.lastPlayed - a.lastPlayed);
      if (commander.document) return;
      if (docs.length > 0 && !manual) { activateCommander(docs[0], undefined, true, true); return; }
      backupLegacyNow();
      syncProfileEconomy(profile);
      const candidate = createCommanderDocument(structuredClone(profile), name);
      if (docs.length > 0) { candidate.shared.bankCrystal = 0; candidate.shared.challengeUnlocks = []; }
      const raw = legacyRaw();
      if (raw) candidate.legacySource = raw;
      const created = await commander.create(candidate.name, candidate);
      if (!commander.document) await adoptCommander(created);
    };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) await locks.request('gridbound.commander-migration', run); else await run();
    return commander.document;
  })().finally(() => { migration = undefined; });
}
/** Attach a Commander created from the live profile without dropping anything done meanwhile: save the live state into it first, then re-materialize when the player is idle in town. */
async function adoptCommander(document: CommanderDocument) {
  commander.select(document, commander.mode);
  savedSignature = '';
  const ok = await persist('auto', () => {});
  if (ok && inTown && !pendingSettlement && !presentingResult && commander.document) { activateCommander(commander.document, commander.mode, false, true); showTown(townState.tab); }
  else storageStatus();
}

let playingScene = false;
const INTRO_KEY = 'gridbound.introsSeen';
/** Intros already shown in this browser; kept outside the save so retries after a defeat go straight to battle. */
function introSeen(zone: number) { try { return (JSON.parse(localStorage.getItem(INTRO_KEY) ?? '[]') as number[]).includes(zone); } catch { return false; } }
function markIntroSeen(zone: number) { try { const seen = JSON.parse(localStorage.getItem(INTRO_KEY) ?? '[]') as number[]; if (!seen.includes(zone)) localStorage.setItem(INTRO_KEY, JSON.stringify([...seen, zone])); } catch { /* storage blocked */ } }
/** A story page: narration gets the CHRONICLE nameplate; only quoted speech shows the chapter speaker (and their portrait when they are a hero). */
function storyPage(text: string, speaker: string | undefined, place: string | undefined): DialoguePage {
  const hero = ROSTER.find(r => r.name.toUpperCase() === speaker?.toUpperCase());
  return /^[“"]/.test(text) && speaker ? { speaker, place, portrait: hero ? portrait(hero.classId, 0, ROSTER.indexOf(hero)) : undefined, text } : { speaker: t('story.chronicle'), place, text };
}
/** Chapter intro as a JRPG scene: title card, then the chronicle in a message box. */
function chapterIntro(zoneIndex: number) {
  const zone = CAMPAIGN[zoneIndex];
  const [name, place] = zone.speaker.split(' · ').map(part => part.trim());
  const pages = paginate(zone.intro).map(text => storyPage(text, name, place));
  playingScene = true;
  return playDialogue($('app'), { kicker: t('battle.chapter', { n: zoneIndex + 1 }), title: zone.name, subtitle: zone.subtitle, backdrop: actArt(Math.floor(zoneIndex / 4)), pages, motion: motionOn(), onBlip: () => sound.play('text') })
    .finally(() => { playingScene = false; markIntroSeen(zoneIndex); });
}
/** Recruits of the chapter just cleared, for the result screen's notice (their join scenes are queued in the journey). */
let recruitedIds: number[] = [];
/** A short scene for a hero joining: their portrait and first words. */
function recruitScene(id: number, force = false) {
  const hero = CHARACTERS[id];
  // Skipped under automation like the title screen and chapter intros; QA plays it through window.gridbound.recruitScene.
  if (!hero || (!force && navigator.webdriver)) return Promise.resolve();
  playingScene = true;
  return playDialogue($('app'), { kicker: t('recruit.kicker'), title: t('recruit.title', { name: hero.name }), subtitle: KITS[hero.classId].name, backdrop: actArt(Math.min(3, Math.floor(hero.recruitChapter / 4))), pages: [{ speaker: hero.name, portrait: portrait(hero.classId, 0, id), text: hero.joinLine }], motion: motionOn(), onBlip: () => sound.play('text') })
    .finally(() => { playingScene = false; });
}
/** A story choice as a scene: its question, its options and 'Decide later' (which leaves it open in the Journal). */
async function choiceScene(scene: (typeof STORY_CHOICES)[number]) {
  playingScene = true;
  const choices = [...scene.options.map(o => ({ value: o.id, label: o.label, reply: o.outcome })), { value: '', label: t('journal.later') }];
  const value = await playDialogue($('app'), { kicker: t('choice.kicker'), title: scene.title, backdrop: actArt(Math.min(3, Math.floor((scene.chapter - 1) / 4))), pages: [{ speaker: t('story.chronicle'), place: scene.title, text: scene.text, choices, safeChoice: choices.length - 1 }], motion: motionOn(), onBlip: () => sound.play('text') })
    .finally(() => { playingScene = false; });
  if (!value || commander.stale) return;
  profile.narrative ??= {};
  if (narrativeChoice(profile.narrative, scene.id, value, profile.cleared)) await persist();
}
/** The finale: the last outro (as the story choices shaped it), one line per hero, the epilogue and the choices' outcomes, then a closing title card. */
function endingScene() {
  const last = CAMPAIGN.length - 1, zone = CAMPAIGN[last], state = profile.narrative ?? {};
  const chronicle = (place: string | undefined, text: string): DialoguePage => ({ speaker: t('story.chronicle'), place, text });
  const pages: DialoguePage[] = [
    ...paginate(storyOutro(last, state)).map(text => chronicle(zone.speaker.split(' · ')[1]?.trim(), text)),
    ...[...profile.roster].sort((a, b) => a - b).map(id => ({ speaker: CHARACTERS[id].name, place: t('ending.fate'), portrait: portrait(CHARACTERS[id].classId, 0, id), text: CHARACTERS[id].fateLine })),
    chronicle(t('journal.epilogue'), t('journal.epilogue.lead')),
    ...STORY_CHOICES.filter(s => Object.hasOwn(state, s.id)).map(s => chronicle(s.title, s.options.find(o => o.id === state[s.id])!.outcome)),
    { text: '', card: { kicker: t('ending.card.kicker'), title: t('town.name'), subtitle: t('ending.card.subtitle') } },
  ];
  playingScene = true;
  return playDialogue($('app'), { kicker: t('ending.kicker'), title: zone.name, subtitle: zone.subtitle, backdrop: actArt(3), pages, motion: motionOn(), onBlip: () => sound.play('text') })
    .finally(() => { playingScene = false; });
}
let campScenesRunning = false;
/**
 * Scenes the camp owes after a first clear, saved in the journey so a Retry or a reload keeps them: each join scene, then the
 * chapter's story choice, then the finale. Each one is dropped (and saved) once it has played. Skipped under automation like the
 * chapter intros; QA plays them through window.gridbound.campScenes.
 */
async function playCampScenes(force = false) {
  const owed = () => Boolean(profile.journey.pendingRecruitScenes?.length || profile.journey.pendingChapterScenes?.length);
  if (campScenesRunning || playingScene || (!force && navigator.webdriver) || !owed()) return;
  // Not before the boot step has settled (the title screen is not up yet and the boot-time profile may be replaced), nor over the title screen.
  if (!commanderChecked || !inTown || commander.stale || pendingSettlement || (commander.document && commander.mode !== 'story') || $('title-screen')?.hidden === false) return;
  campScenesRunning = true;
  try {
    while (inTown && !commander.stale && owed()) {
      const journey = profile.journey, id = journey.pendingRecruitScenes?.[0];
      if (id !== undefined) {
        await recruitScene(id, true);
        const rest = (profile.journey.pendingRecruitScenes ?? []).filter(other => other !== id);
        if (rest.length) profile.journey.pendingRecruitScenes = rest; else delete profile.journey.pendingRecruitScenes;
      } else {
        const chapter = journey.pendingChapterScenes![0];
        for (const scene of pendingChoices(profile.narrative ?? {}, profile.cleared).filter(s => s.chapter === chapter + 1)) await choiceScene(scene);
        if (chapter === CAMPAIGN.length - 1) await endingScene();
        const rest = (profile.journey.pendingChapterScenes ?? []).filter(other => other !== chapter);
        if (rest.length) profile.journey.pendingChapterScenes = rest; else delete profile.journey.pendingChapterScenes;
      }
      await persist();
    }
  } finally { campScenesRunning = false; }
  // The guide may now point at a choice left for later.
  if (inTown && townState.tab === 'camp') showTown('camp');
}
/**
 * Make `target` the Commander's mode before a departure. The town normally did so already (showTown); a switch it skipped (a save was in
 * flight or had failed) happens here, re-materializing that mode's profile so a Story profile is never saved as a challenge (or the reverse).
 * The setup picks (quarry, tier, pacts, parties, tonic) survive the switch. With a save in flight it waits and runs `retry`; a failed save
 * gets the retry/export prompt. Returns false when the caller must stop.
 */
function ensureMode(target: CommanderMode, retry: () => void) {
  const doc = commander.document;
  if (!doc || commander.mode === target) return true;
  if (commander.stale) { storageStatus(); return false; }
  if (commander.dirty || commander.busy) { void commander.flush().then(ok => { if (ok) retry(); else if (!commander.stale) unsavedTownModal(retry, 'storage.unsaved.leave'); else storageStatus(); }); return false; }
  const { raid, raidTier, raidModifiers, raidBuild, raidSandbox, rogueSetup, tonic, hero, zone, heroic } = townState;
  activateCommander(doc, target, false);
  Object.assign(townState, { raid, raidTier, raidModifiers, raidBuild, raidSandbox, rogueSetup, tonic, hero, zone, heroic });
  return true;
}
function depart(mode: Mode) {
  if (playingScene || campScenesRunning) return;
  if (!ensureMode(mode === 'raid' ? 'raid' : mode === 'endless' ? 'roguelike' : 'story', () => depart(mode))) return;
  if (commander.document) commander.document.activeMode = commander.mode;
  if (mode === 'adventure' && !canEnterZone(profile, townState.zone)) return;
  const existing = commander.document?.encounters?.[commander.mode];
  if (existing && !existing.settled) { void restoreEncounter(existing); return; }
  if (mode === 'raid' && !raidQuarryUnlocked(profile, townState.raid)) return;
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
  // A ticked Bell Tonic adds one potion to this raid or the run's first floor; its bank Crystal is paid only once the battle exists.
  const tonic = (mode === 'raid' || mode === 'endless') && townState.tonic === true && profile.economy.commanderCrystal >= bankShopItem(BELL_TONIC)!.cost;
  townState.tonic = false;
  boot(mode, mode === 'adventure' ? townState.zone + 1 : mode === 'raid' ? profile.cleared.length+1 : 1, { ...(mode === 'endless' ? { rogueBuild: structuredClone(townState.rogueSetup ?? createRogueBuild()) } : heroic ? { heroic: true } : {}), ...(tonic ? { extraPotions: 1 } : {}) });
  if (tonic) { if (buyBellTonic(profile.economy, mode === 'raid' ? 'raid' : 'roguelike')) syncProfileEconomy(profile); else battle.potions = Math.max(0, battle.potions - 1); }
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
  const milestone = mode === 'endless' ? roguelikeMilestoneForFloor(floor) : undefined;
  // A raid build that no longer fits the roster falls back to the default party instead of failing the departure.
  if (mode === 'raid') townState.raidBuild = (townState.raidBuild && normalizeRaidBuild(townState.raidBuild, profile.roster)) ?? defaultRaidBuild(profile);
  // Build the battle before leaving town, so a refused setup leaves the town (and any unpaid tonic) untouched.
  const next = new Battle(mode, floor, profileModifiers(profile), {
    roster: [...profile.roster], loadouts: structuredClone(profile.loadouts),
    boons: [...runBoons], settlementId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...(mode === 'raid' ? {
      enemyId: townState.raid,
      // An uncertified pact combo still plays its pacts, as practice (no Crystal).
      raidContract: getRaidContractForEnemy(townState.raid, townState.raidTier, townState.raidModifiers) ?? sandboxRaidContract({ bossId: townState.raid, tier: townState.raidTier, modifiers: townState.raidModifiers }),
      raidBuild: structuredClone(townState.raidBuild),
      raidSandbox: townState.raidSandbox ? structuredClone(townState.raidSandbox) : undefined,
    } : {}),
    ...(mode === 'endless' && milestone ? { runWallet, runAct: milestone.act, runActClear: milestone.actClear, runFinalClear: milestone.finalClear, relics: RELIC_IDS.filter(id => ownsChallengeUnlock(profile, id)) } : {}),
    // A dungeon fight brings its own roster (the run's party), so the story options go first and the passed options win.
    ...(mode === 'dungeon' ? storyBattleOptions(profile) : {}), ...options,
    ...(mode === 'adventure' ? storyBattleOptions(profile) : {}),
  });
  inTown = false;
  clearAnnouncer();
  resultRequest++;
  presentingResult = false;
  resultGeneration = undefined;
  pauseForDetails = false;
  $('battle-screen').dataset.battleView = 'arena';
  document.querySelectorAll<HTMLButtonElement>('.battle-view-tabs [data-battle-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.battleView === 'arena')));
  $('battle-detail-pause-note').hidden = true;
  battle = next;
  recorded = false;
  chapterResult = undefined; resultReward = undefined; stageStart = undefined; firstFall = undefined;
  if (coach.step) endCoachStep();
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
  // Waking runs one engine step at once (scene.update → frame()), so it comes after the new battle's unit layer and ready window exist.
  engineAwake(true);
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
  if (!motionOn()) return;
  const cols = 8, rows = 14, wipe = document.createElement('div');
  wipe.className = 'battle-wipe';
  wipe.setAttribute('aria-hidden', 'true');
  wipe.innerHTML = Array.from({ length: cols * rows }, (_, i) => { const x = i % cols, y = Math.floor(i / cols), d = Math.hypot(x - (cols - 1) / 2, (y - (rows - 1) / 2) * .6); return `<i style="animation-delay:${Math.round(d * 45)}ms"></i>`; }).join('');
  $('app').append(wipe);
  window.setTimeout(() => wipe.remove(), 900);
}
function updateExpedition() {
  const c = CAMPAIGN[battle.floor - 1];
  $('loot').textContent = battle.mode === 'endless' ? `${fmtInt(runWallet.crystal)} ◇` : battle.mode === 'raid' ? (battle.raidContract?.sandbox ? t('raid.sandbox.short') : t(`raid.tier.${battle.raidContract?.tier ?? 'bronze'}` as never)) : `${fmtInt(battle.gold)}G`;
  const runShopHost = document.getElementById('run-shop-host');
  if (runShopHost) runShopHost.innerHTML = battle.mode === 'endless' && battle.status === 'ready' ? CHALLENGE_SHOP.map(item => `<button class="btn" data-run-buy="${item.id}" ${runWallet.crystal < item.cost ? 'disabled' : ''}>${item.name} · ${fmtInt(item.cost)} ◇</button>`).join('') : '';
  $('mode-label').textContent = battle.mode === 'adventure' ? `${battle.heroic ? `${t('heroic.badge')} · ` : ''}${t('battle.chapter', { n: battle.floor })}` : battle.mode === 'endless' ? t('battle.floor', { n: battle.floor }) : battle.mode === 'dungeon' ? t('dungeon.depth.label', { n: profile.journey.run?.depth ?? 1 }) : t('mode.raid');
  $('encounter-label').textContent = stageLabel();
  $('boss-name').textContent = battle.enemyName;
  $('boss-title').textContent = battle.enemyTitle;
  $('retreat').textContent = battle.mode === 'dungeon' ? t('dungeon.flee.label') : t('battle.retreat');
  $('expedition-label').textContent = battle.mode === 'adventure' ? t('mode.campaign') : battle.mode === 'endless' ? t('route.endless') : battle.mode === 'dungeon' ? t('route.dungeon') : t('mode.raid');
  $('journey-title').textContent = battle.mode === 'adventure' ? c.name : battle.mode === 'endless' ? t('route.endless') : battle.enemyName;
  $('journey-copy').textContent = battle.mode === 'adventure' ? c.subtitle : t('battle.journey.copy');
  $('stage-list').innerHTML = battle.mode === 'adventure' ? c.stages.map((s, i) => `<li class="${i === battle.stage ? 'current' : i < battle.stage ? 'completed' : ''}"><small>${t('map.wave', { n: i + 1 })}</small> <span>${s.name}</span></li>`).join('') : '';
  // Run boons and the Journey shop only exist in a Roguelike run.
  document.querySelectorAll<HTMLElement>('#battle-screen .run-boons, #battle-screen .run-shop-panel').forEach(panel => { panel.hidden = battle.mode !== 'endless'; });
  $('boon-list').innerHTML = runBoons.length ? runBoons.map(id => { const b = BOONS.find(b => b.id === id)!; return `<p><b>${b.name}</b><small>${b.description}</small></p>`; }).join('') : `<p class="hint">${t('battle.noboons')}</p>`;
  // Boons belong to Bell Trials (raids list their pacts there): a Story or Undercroft fight without boons has no tray button.
  $('combat-boons').hidden = !runBoons.length && battle.mode !== 'endless' && battle.mode !== 'raid';
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
  // The very first wave keeps its how-to-play tip under the story beat.
  $('ready-tip').hidden = !(beat && battle.floor === 1 && battle.stage === 0 && !battle.heroic);
  $('start').textContent = t('battle.begin');
  if (motionOn()) {
    gsap.fromTo('#start-overlay .start-window', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,transform' });
  }
}
/** The battle-start checkpoint save; leaving the battle waits for it, so an abandoned run is never written back afterwards. */
let startCheckpoint: Promise<unknown> = Promise.resolve();
async function begin() {
  if (inTown) return;
  if (commander.stale || pendingSettlement) return;
  if (['victory', 'defeat'].includes(battle.status)) { result(); return; }
  encounter = makeEncounter();
  stageStart = battle.mode === 'adventure' ? structuredClone(encounter) : undefined;
  // From here a dungeon fight counts: leaving is a flee, and the saved flag makes a reload one too.
  if (battle.mode === 'dungeon' && profile.journey.run?.pendingFight) { profile.journey.run.pendingFight.started = true; fightNote = fightNoteKey(); }
  sound.unlock();
  battle.start();
  $('start-overlay').hidden = true;
  if (initialized) scene.encounterStart();
  addLog(t('log.begin'));
  startCheckpoint = ensureCommander().then(() => commander.flush()).then(() => checkpoint(true));
}

function renderPartyHealthTray() {
  partyHealthViews.clear();
  for (const trayId of ['details-party-health-tray']) {
    const host = $(trayId);
    host.dataset.count = String(battle.heroes.length);
    host.innerHTML = battle.heroes.map(h => `<button type="button" class="party-health-card" data-party-hero="${h.id}" aria-pressed="false" aria-label="${heroName(h)}">
      <img class="party-face" src="${face(h)}" alt=""/>
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
  const cooldownSeconds = h.remaining > 0 ? fmtSec(Math.max(.1, h.remaining)) : '';
  const charge = h.total > 0 ? Math.min(1, Math.max(0, 1 - h.remaining / h.total)) : 1;
  const status = h.hp <= 0 ? t('battle.down') : cooldownSeconds || t('battle.ready');
  // The label counts whole seconds (the visible text keeps tenths), so it changes about once a second, not on every frame.
  const label = t('battle.hero.aria', { name: heroName(h), hp, max: h.maxHp, shield, status: h.hp > 0 && h.remaining > 0 ? fmtSec(Math.ceil(h.remaining), 0) : status });
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
    setAttr(view.button, 'aria-pressed', String(h.id === battle.selected));
    setAttr(view.button, 'aria-label', label);
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
    // A chip tap right after a tap on the same hero is a mash that slipped, not a skill change.
    skill.addEventListener('click', event => { event.stopPropagation(); if (performance.now() - (lastHeroTap.get(h.id) ?? -Infinity) < CHIP_GUARD_MS) return; switchSkill(h.id); });
  }
  closeSkillPicker();
  $('skill-toast').hidden = true; lastHeroTap.clear();
  $('unit-layer').querySelectorAll<HTMLElement>('[data-tap]').forEach(el => bindPointer(el, Number(el.dataset.tap)));
  renderPartyHealthTray();
  $('party-size').textContent = `${battle.heroes.length}`;
  selectedKey = '';
  renderInspector();
}
// A unit card spans its 112px cell plus most of the row gap, so the skill chip sits under the portrait.
const UNIT_H = 122;
const CHIP_GUARD_MS = 300, GUARD_MARGIN = 0.05;
/** Touch players have no G key: counter texts drop their '(G)' hints there, like the action bar drops its key letters. */
const coarsePointer = window.matchMedia('(pointer: coarse)');
const touchText = (text: string) => coarsePointer.matches ? text.replace(/ \(G\)/g, '') : text;
const lastHeroTap = new Map<number, number>();
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
  // An interrupt in hand glows while a ritual or channel can still be cut.
  view.card.classList.toggle('interrupt-ready', h.hp > 0 && KITS[h.classId].skills[h.stance].kind === 'interrupt' && battle.threats.some(v => v.type === 'all' || v.type === 'channel'));
  const key = `${h.stance}-${skills.length}-${canSwitch}-${h.hp > 0}`;
  if (key === view.key) return;
  if (view.key && view.key.split('-')[0] !== String(h.stance)) { view.card.classList.remove('switched'); void view.card.offsetWidth; view.card.classList.add('switched'); }
  view.key = key;
  const skill = KITS[h.classId].skills[h.stance];
  setText(view.name, skill.name);
  setText(view.icon, skills.length > 2 ? '▾' : '⇄');
  view.skill.disabled = !canSwitch;
  setAttr(view.skill, 'aria-label', t('battle.skill.switch', { name: heroName(h), skill: skill.name }));
  setAttr(view.skill, 'aria-haspopup', String(skills.length > 2));
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
/** The control that opened the skill picker (its chip): focus returns there when the picker closes with the focus inside it. */
let pickerReturn: HTMLElement | null = null;
function openSkillPicker(id: number) {
  const h = battle.hero(id);
  if (!h) return;
  const kit = KITS[h.classId];
  battle.selected = id;
  pickerHero = id;
  const picker = $('skill-picker');
  const active = document.activeElement;
  pickerReturn = active instanceof HTMLElement && active !== document.body && !picker.contains(active) ? active : document.querySelector<HTMLElement>(`[data-skill-switch="${id}"]`);
  picker.setAttribute('aria-label', t('battle.skill.choose', { name: heroName(h) }));
  picker.innerHTML = `<h4>${t('battle.skill.choose', { name: heroName(h) })}</h4>${battle.availableSkills(id).map(i => { const s = kit.skills[i]; return `<button type="button" data-pick-skill="${i}" aria-pressed="${h.stance === i}"><span><b>${s.name}</b><small>${s.label}</small></span><em>${fmtSec(s.cooldown)}</em></button>`; }).join('')}`;
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
  const picker = document.getElementById('skill-picker'), back = pickerReturn;
  pickerReturn = null;
  if (!picker || picker.hidden) return;
  const hadFocus = picker.contains(document.activeElement);
  picker.hidden = true; picker.innerHTML = '';
  // A disabled chip (the hero just fell) cannot take the focus: fall back to that hero's card.
  if (hadFocus && back?.isConnected) { back.focus({ preventScroll: true }); if (document.activeElement !== back) back.closest('.unit-card')?.querySelector<HTMLElement>('.unit-tap')?.focus({ preventScroll: true }); }
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
  const status = h.hp <= 0 ? t('battle.down') : h.remaining > 0 ? fmtSec(Math.max(.1, h.remaining)) : t('battle.ready');
  const img = bar.querySelector<HTMLImageElement>('.focus-face')!;
  const src = face(h);
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
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
  lastHeroTap.set(id, performance.now());
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
    lastHeroTap.set(id, performance.now());
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
  if (withDetailsPausedAction(() => battle.stance(id, skills[(skills.indexOf(h.stance) + direction + skills.length) % skills.length]))) skillToast(h);
  sound.unlock();
  renderInspector();
  frame(1);
}
/** A short 'Skill: X (tap again to undo)' note after a one-tap switch, so a stray tap is noticed and undone. */
let skillToastTimer = 0;
function skillToast(h: PartyHero) {
  const toast = $('skill-toast');
  toast.textContent = `${heroName(h)} · ${t('battle.skill.toast', { skill: KITS[h.classId].skills[h.stance].name })}`;
  toast.hidden = false;
  window.clearTimeout(skillToastTimer);
  skillToastTimer = window.setTimeout(() => { toast.hidden = true; }, 1800);
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
  $('inspector').innerHTML = `<div class="hero-identity"><div class="portrait-frame"><img src="${face(h)}" alt="${heroName(h)}"/><span>LV ${h.level}</span></div><div><small class="hero-class">${k.name}</small><h2>${heroName(h)}</h2><p>${k.role}</p></div></div><div class="hero-stats"><span>HP <b id="selected-hp"></b></span><span>SH <b id="selected-shield"></b></span></div><h4 class="subheading stance-label">${t('battle.skills')} <span>${t('battle.autocast')}</span></h4><div class="stance-options">${battle.availableSkills(h.id).map(i => { const s = k.skills[i]; return `<button data-select-stance="${i}" class="stance-option ${h.stance === i ? 'chosen' : ''}" aria-pressed="${h.stance === i}" ${!['ready', 'fighting'].includes(battle.status) || h.hp <= 0 ? 'disabled' : ''}><span><b>${s.name}</b><small>${s.label} · ${fmtSec(s.cooldown)}</small></span><i>${h.stance === i ? '●' : '○'}</i></button>`; }).join('')}</div><p class="skill-description">${k.skills[h.stance].description}</p><div class="focus-meter"><div><span>${t('battle.fatigue')}</span><span id="fatigue-label"></span></div><span class="gauge"><i id="fatigue-fill"></i></span></div><button id="move-selected" class="btn move-button">${moveMode ? t('battle.move.pick') : t('battle.move')}<small>+${fmtSec(MOVE_PENALTY)}</small></button><div class="move-grid" ${moveMode ? '' : 'hidden'}>${Array.from({ length: 9 }, (_, i) => `<button data-move-slot="${i}" aria-label="${t('formation.tile', { n: i + 1 })}" ${i === h.slot ? 'disabled' : ''}>${i + 1}</button>`).join('')}</div>`;
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
  if (battle.status !== lastStatus) {
    lastStatus = battle.status; renderInspector();
    if (battle.status === 'victory' || battle.status === 'defeat') { announce(t(battle.status === 'victory' ? 'a11y.victory' : 'a11y.defeat', { name: battle.enemyName }), true); result(); }
  }
  for (const h of battle.heroes) { if (h.hp <= 0) downed.add(h.id); else if (downed.delete(h.id)) announce(t('a11y.revived', { name: heroName(h) })); }
  if (battle.mode === 'dungeon' && battle.status === 'fighting') noteDungeonFight();
  $('boss-health').textContent = `${fmtInt(Math.ceil(battle.bossHp))} / ${fmtInt(battle.bossMax)}`;
  const hpPercent = `${battle.bossHp / battle.bossMax * 100}%`;
  $('boss-hp').style.width = hpPercent;
  const ghost = document.getElementById('boss-hp-ghost');
  if (ghost) ghost.style.width = hpPercent;
  $('phase').textContent = t('battle.phase', { n: battle.phase });
  $('stagger').style.width = `${Math.min(100, battle.breakLeft > 0 ? battle.breakLeft / BREAK_SECONDS * 100 : battle.stagger / battle.staggerThreshold() * 100)}%`;
  $('stagger-label').textContent = battle.breakLeft > 0 ? t('battle.break') : t('battle.armor');
  $('battle-screen').classList.toggle('boss-broken', battle.breakLeft > 0);
  $('clock').textContent = formatTime(battle.time);
  renderBossStatus();
  const threat = [...battle.threats].sort((a, b) => a.left - b.left)[0];
  const isDanger = Boolean(threat);
  const intent = $('intent');
  const wasDanger = intent.classList.contains('danger');
  intent.classList.toggle('danger', isDanger);
  intent.classList.toggle('guarding', !isDanger && battle.guardLeft > 0);
  if (isDanger && !wasDanger && motionOn()) {
    gsap.fromTo('#intent', { scale: 1.08 }, { scale: 1, duration: 0.25, ease: 'back.out(2)', clearProps: 'transform' });
  }
  setText(intent.querySelector('b')!, threat ? `${t('battle.intent.time', { name: eventText(threat.name, lang()), s: fmtDec(Math.max(0, threat.left)) })}${threat.targetId !== undefined ? ` → ${heroLabel(threat.targetId)}` : ''}` : battle.guardLeft > 0 ? t('battle.guarding', { s: fmtDec(battle.guardLeft) }) : t('battle.watch'));
  setText(intent.querySelector('span')!, threat ? `${threat.counter ? touchText(eventText(threat.counter, lang())) : t('battle.counter.default')}${battle.threats.length > 1 ? ` (+${battle.threats.length - 1})` : ''}` : t('battle.watch.hint'));
  placeBanner();
  $('damage').textContent = fmtInt(battle.damage);
  $('blocked').textContent = fmtInt(battle.blocked);
  $('loot').textContent = battle.mode === 'endless' ? `${fmtInt(runWallet.crystal)} ◇` : battle.mode === 'raid' ? (battle.raidContract?.sandbox ? t('raid.sandbox.short') : t(`raid.tier.${battle.raidContract?.tier ?? 'bronze'}` as never)) : `${fmtInt(battle.gold)}G`;
  $('standing').textContent = t('battle.standing', { n: battle.living().length, total: battle.heroes.length });
  $('move-tip').textContent = moveMode ? t('battle.move.pick') : t('battle.drag');
  $('resolve-fill').style.width = `${battle.resolve}%`;
  $('resolve-label').textContent = battle.resolve >= 100 ? t('battle.ult.ready') : t('battle.ult.charge', { n: Math.floor(battle.resolve) });
  const ultReady = battle.resolve >= 100 && battle.status === 'fighting';
  $<HTMLButtonElement>('ultimate').disabled = !ultReady;
  $('ultimate').classList.toggle('ready', ultReady);
  $<HTMLButtonElement>('potion').disabled = battle.potions <= 0 || battle.status !== 'fighting';
  $('potion').querySelector('b')!.textContent = String(battle.potions);
  $<HTMLButtonElement>('guard').disabled = battle.guardCooldown > 0 || battle.status !== 'fighting';
  // Guard only helps if it is still up at impact: cue the window once an all-grid hit is within GUARD_DURATION
  // (minus a few frames, since guardLeft ticks down before the impact resolves).
  const guardWindow = battle.status === 'fighting' && battle.guardCooldown <= 0 && battle.guardLeft <= 0 && battle.threats.some(v => v.type === 'all' && v.left <= GUARD_DURATION - GUARD_MARGIN);
  $('guard').classList.toggle('ready-window', guardWindow);
  $('guard-label').textContent = guardWindow ? t('battle.guard.now') : battle.guardLeft > 0 ? t('battle.guard.active', { s: fmtDec(battle.guardLeft) }) : battle.guardCooldown > 0 ? t('battle.guard.cd', { s: fmtDec(battle.guardCooldown) }) : t('battle.guard.ready');
  $('guard').classList.toggle('guarding', battle.guardLeft > 0);
  coachFrame(guardWindow);
  $('lane-targets-hint')?.remove();
  document.querySelector('.lane-targets')?.classList.toggle('has-minions', battle.minions.length > 0);
  for (const h of battle.heroes) {
    const el = document.querySelector<HTMLElement>(`[data-hero="${h.id}"]`);
    if (!el) continue;
    const p = cell(h.slot);
    el.style.left = `${p.x / 6}%`;
    el.style.top = `${p.y / 7.6}%`;
    el.style.setProperty('--row', String(3 - Math.floor(h.slot / 3))); // upper rows on top: a chip's tap area reaches into the card below
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
/**
 * The first-battle coach: Chapter 1 until it is cleared, each tip once (stored in localStorage), Config → Battle tips turns it off.
 * Driven by the battle state the HUD already reads (threats, Guard window, resolve); while a drag is explained it slows the fight to 30%
 * (BattleScene.timeScale: fewer fixed 1/60 s ticks per frame, never a different tick). Skipped under automation unless QA forces it
 * with window.gridbound.coach(true).
 */
function endCoachStep(step?: CoachStep) { if (step) markCoach(step); coach.hide(); if (initialized) scene.timeScale = 1; }
const coachOn = () => battle.mode === 'adventure' && battle.floor === 1 && !battle.heroic && battle.status === 'fighting' && !COACH_STEPS.every(coachDone) && (coachForced || (!navigator.webdriver && coachEnabled() && !profile.cleared.includes(0)));
function coachFrame(guardWindow: boolean) {
  if (!coachOn()) { if (coach.step) endCoachStep(); return; }
  const card = (id: number) => () => unitViews.get(id)?.card ?? null;
  // Finish the current tip once the player did it (or the moment passed).
  if (coach.step === 'tap' && (battle.taps >= 2 || battle.time > coachUntil)) endCoachStep('tap');
  else if (coach.step === 'drag') { const threat = battle.threats.find(v => v.id === coachThreat), h = battle.hero(coachHero); if (!threat || !h || h.hp <= 0 || !threat.slots.includes(h.slot)) endCoachStep('drag'); }
  else if (coach.step === 'guard' && (battle.guardLeft > 0 || !battle.threats.some(v => v.type === 'all'))) endCoachStep('guard');
  else if (coach.step === 'ult' && (battle.resolve < 100 || battle.time > coachUntil)) endCoachStep('ult');
  // A telegraph to dodge or a ritual to Guard takes over from the calmer tips.
  const calm = coach.step !== 'drag' && coach.step !== 'guard';
  const ground = calm && !coachDone('drag') ? battle.threats.find(v => (v.type === 'front' || v.type === 'breath' || v.type === 'meteor') && v.left > .6 && battle.living().some(h => v.slots.includes(h.slot))) : undefined;
  const victim = ground && battle.living().find(h => ground.slots.includes(h.slot));
  if (ground && victim) {
    if (coach.step) endCoachStep(coach.step);
    coachThreat = ground.id; coachHero = victim.id;
    coach.show('drag', t('coach.drag', { name: heroName(victim) }), card(victim.id));
    if (initialized) scene.timeScale = .3;
  } else if (calm && !coachDone('guard') && guardWindow) {
    if (coach.step) endCoachStep(coach.step);
    coach.show('guard', t('coach.guard'), () => $('guard'));
  } else if (!coach.step && !coachDone('ult') && battle.resolve >= 100) {
    coachUntil = battle.time + 8;
    coach.show('ult', t('coach.ult', { name: t('battle.ultimate') }), () => $('ultimate'));
  } else if (!coach.step && !coachDone('tap') && battle.stage === 0 && battle.stageTime < 15) {
    const first = battle.living()[0];
    if (first) { coachUntil = battle.time + 8; coach.show('tap', t('coach.tap', { name: heroName(first) }), card(first.id)); }
  }
  coach.place();
}
/** Boss status chips (Mark, Weaken, Curse, the last stun's DELAYED/RESISTED note and the soft enrage) with a countdown fill.
 *  They live in the intel band, which is never covered, instead of the crowded stagger row or the canvas above the boss. */
let bossStatusKey = '';
let stunNote: { battle: Battle; text: string; until: number } | undefined;
const STUN_NOTE_S = 1.6;
function renderBossStatus() {
  const curse = battle.curses.reduce((left, c) => Math.max(left, c.left), 0);
  const chips: [string, string, number][] = [];
  if (battle.markLeft > 0) chips.push(['mark', t('battle.status.mark', { n: Math.round((MARK_DAMAGE - 1) * 100) }), battle.markLeft / 4]);
  if (battle.weakenLeft > 0) chips.push(['weaken', t('battle.status.weaken', { n: Math.round((1 - WEAKEN_DAMAGE) * 100) }), battle.weakenLeft / 5]);
  if (curse > 0) chips.push(['curse', `${t('battle.status.curse')}${battle.curses.length > 1 ? ` ×${battle.curses.length}` : ''}`, curse / 6]);
  const stunLeft = stunNote?.battle === battle ? stunNote.until - battle.time : 0;
  if (stunNote && stunLeft > 0 && stunLeft <= STUN_NOTE_S) chips.push(['delay', stunNote.text, stunLeft / STUN_NOTE_S]);
  // Soft enrage: a countdown from ENRAGE_WARN, then ENRAGED for the rest of the stage.
  if (battle.stageTime >= ENRAGE_WARN) chips.push(battle.enraged() ? ['enrage on', t('battle.enraged'), 0] : ['enrage', t('battle.enrage.in', { s: Math.ceil(ENRAGE_AT - battle.stageTime) }), (ENRAGE_AT - battle.stageTime) / (ENRAGE_AT - ENRAGE_WARN)]);
  const host = $('boss-status'), key = chips.map(([id]) => id).join('|');
  if (key !== bossStatusKey) { bossStatusKey = key; host.innerHTML = chips.map(([id]) => `<span class="status-chip ${id}" data-status="${id.split(' ')[0]}"><i></i><b></b></span>`).join(''); }
  chips.forEach(([, label, ratio], i) => {
    const chip = host.children[i] as HTMLElement, text = chip.querySelector('b')!;
    if (text.textContent !== label) text.textContent = label;
    chip.querySelector<HTMLElement>('i')!.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  });
}
/** Banners belong in the boss area, but on short phones the intel band (statuses + intent) overlays the arena top and its
 *  counter text matters most while a warning banner shows: keep the banner just below the band and above the front row. */
function placeBanner() {
  const banner = $('banner');
  if (!banner.classList.contains('visible')) return;
  const arena = $('arena').getBoundingClientRect(), intel = document.querySelector('.arena-intel')!.getBoundingClientRect();
  const frontRow = arena.height * ARENA.y / ARENA.height, top = Math.max(arena.height * .27, intel.bottom - arena.top + 4);
  banner.style.top = `${Math.round(Math.min(top, frontRow - banner.offsetHeight - 2))}px`;
}
function addLog(text: string) {
  const p = document.createElement('p');
  p.className = 'log-entry';
  const time = document.createElement('span');
  time.textContent = formatTime(battle.time);
  p.append(time, document.createTextNode(text));
  $('combat-log').prepend(p);
  while ($('combat-log').children.length > 30) $('combat-log').lastElementChild?.remove();
}
const heroLabel = (id?: number) => { const h = battle.hero(id ?? -1); return h ? heroName(h) : '?'; };
/** What downed a hero (the claw, a minion, or the named attack), for the log and the defeat screen. */
const downCause = (e: BattleEvent) => e.kind === 'claw' ? t('log.cause.claw') : e.kind === 'minion' ? t('log.cause.minion') : e.name ? eventText(e.name, lang()) : '';
window.addEventListener('battle-banner', event => {
  if (inTown) return;
  const e = (event as CustomEvent<BattleEvent>).detail;
  if (e.type === 'warning') announceThreat(e);
  else if (e.type === 'down') announce(t('a11y.down', { name: heroLabel(e.source) }));
  else if (e.type === 'phase') announce(t('a11y.phase', { name: battle.enemyName, n: battle.phase }));
  else if (e.type === 'break') announce(t('a11y.break', { s: BREAK_SECONDS }));
  const text = e.type === 'down' ? t('battle.ko', { name: heroLabel(e.source) }) : e.text ? eventText(e.text, lang()) : '';
  // The stage name already headlines the ready window: log it, but keep the arena clear for the FIGHT! cue.
  if (e.kind !== 'stage') {
    $('banner').textContent = text;
    $('banner').className = `battle-banner visible ${['warning', 'down', 'enrage'].includes(e.type) ? 'danger' : e.type === 'ultimate' ? 'ultimate' : e.type === 'break' ? 'break' : e.type === 'interrupt' ? 'interrupt' : ''}`;
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => {
      const banner = $('banner');
      banner.className = 'battle-banner';
      banner.textContent = '';
    }, 1800);
  }
  if (e.type === 'down') {
    const cause = downCause(e);
    if (!(firstFall?.battle === battle && firstFall.stage === battle.stage)) firstFall = { battle, stage: battle.stage, name: heroLabel(e.source), cause };
    addLog(cause ? t('log.ko', { name: heroLabel(e.source), cause }) : t('log.ko.plain', { name: heroLabel(e.source) }));
    const card = unitViews.get(e.source ?? -1)?.card;
    if (card) { card.classList.remove('ko-flash'); void card.offsetWidth; card.classList.add('ko-flash'); }
  } else if (e.type === 'interrupt') {
    const h = battle.hero(e.source ?? -1);
    addLog(t('log.interrupt', { hero: heroLabel(e.source), skill: h ? KITS[h.classId].skills[h.stance].name : '?', name: (e.name ?? '').split(' · ').map(name => eventText(name, lang())).join(' · ') }));
  } else if (e.kind === 'potion') addLog(t('log.potion', { n: battle.potions }));
  else if (text) addLog(text);
});
// Telegraph impacts go to the log only: who was hit and for how much. A finished channel hits nobody by design (its heal has its own banner).
// Stuns put their DELAYED/RESISTED note in the boss status strip (never covered, unlike the canvas above the boss) and the log.
window.addEventListener('battle-log', event => {
  if (inTown) return;
  const e = (event as CustomEvent<BattleEvent>).detail, name = eventText(e.name ?? '', lang());
  if (e.type === 'stun') {
    const text = eventText(e.text ?? '', lang()), h = battle.hero(e.source ?? -1);
    stunNote = { battle, text, until: battle.time + STUN_NOTE_S };
    addLog(t('log.stun', { hero: heroLabel(e.source), skill: h ? KITS[h.classId].skills[h.stance].name : '?', text }));
    return;
  }
  if (e.kind === 'channel') return;
  addLog(e.hit?.length ? t('log.impact', { name, heroes: e.hit.map(id => heroLabel(id)).join(', '), n: Math.round(e.amount ?? 0) }) : t('log.dodged', { name }));
});

/** The control that opened the modal: focus returns to it on close when nothing else took the focus (a re-render, a route change). */
let modalReturn: HTMLElement | null = null;
function openModal(content: string, pause = true) {
  const alreadyOpen = modal.open;
  if (!alreadyOpen) { resumeOnClose = !inTown && pause && battle.status === 'fighting'; modalReturn = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null; }
  if (!inTown && pause && battle.status === 'fighting') { resumeOnClose = true; battle.pause(); }
  modal.innerHTML = `${content}<button data-close class="modal-close icon-button" aria-label="${t('common.close')}">×</button>`;
  modal.scrollTop = 0;
  if (!alreadyOpen) {
    try { modal.showModal(); } catch { modal.show(); }
    sound.modalReveal();
    if (motionOn()) gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'power2.out', clearProps: 'opacity' });
  } else {
    // New content in an open modal (Pause → Settings) destroyed the focused button: move the focus to the new title, or its first control.
    const title = modal.querySelector<HTMLElement>('#modal-title');
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    else modal.querySelector<HTMLElement>('button:not([disabled]), input, select, textarea, [href]')?.focus({ preventScroll: true });
  }
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.close()));
}
modal.addEventListener('close', () => {
  if (resumeOnClose && !inTown && battle.status === 'paused') battle.pause(); resumeOnClose = false;
  const back = modalReturn; modalReturn = null;
  if (back?.isConnected && !back.closest('[hidden],[inert]') && (document.activeElement === document.body || modal.contains(document.activeElement))) back.focus({ preventScroll: true });
});
function closeWithoutResume() { resumeOnClose = false; clearResultState(); if (modal.open) modal.close(); }
function help() {
  const rows: [string, string][] = [['help.tap.title', 'help.tap'], ['help.skill.title', 'help.skill'], ['help.drag.title', 'help.drag'], ['help.guard.title', 'help.guard'], ['help.items.title', 'help.items'], ['help.lanes.title', 'help.lanes'], ['help.enrage.title', 'help.enrage']];
  const vars = { t: formatTime(ENRAGE_AT), pct: Math.round((ENRAGE_DMG - 1) * 100), s: ENRAGE_AT - ENRAGE_WARN, move: fmtSec(MOVE_PENALTY) };
  openModal(`<h2 id="modal-title">${t('help.title')}</h2><div class="help-rows">${rows.map(([title, body]) => `<p><b>${t(title as never, vars)}</b><br>${t(body as never, vars)}</p>`).join('')}</div><button class="btn primary" data-close>${t('help.close')}</button>`);
}
function settings() {
  openModal(`<h2 id="modal-title">${t('settings.title')}</h2>
    <div class="setting-row" role="group" aria-label="${t('settings.language')}"><span><b>${t('settings.language')}</b><small>${inTown ? t('settings.language.sub') : t('settings.language.town')}</small></span><span class="lang-switch">${(['en', 'id'] as Lang[]).map(code => `<button type="button" class="btn" data-lang="${code}" aria-pressed="${lang() === code}" ${inTown ? '' : 'disabled'}>${code === 'en' ? 'English' : 'Indonesia'}</button>`).join('')}</span></div>
    <label class="setting-row"><span><b>${t('settings.sound')}</b><small>${t('settings.sound.sub')}</small></span><input id="setting-sound" type="checkbox" ${profile.sound ? 'checked' : ''}></label>
    <label class="setting-row"><span><b>${t('settings.motion')}</b><small>${reduceMotionQuery.matches ? t('settings.motion.device') : t('settings.motion.sub')}</small></span><input id="setting-motion" type="checkbox" ${profile.motion ? 'checked' : ''}></label>
    <label class="setting-row"><span><b>${t('settings.coach')}</b><small>${t('settings.coach.sub')}</small></span><input id="setting-coach" type="checkbox" ${coachEnabled() ? 'checked' : ''}></label>
    <p class="hint">${t('settings.save.note')}</p><button id="export-save" class="btn">${t('settings.export')}</button><button class="btn primary" data-close>${t('common.back')}</button>`);
  $('export-save').addEventListener('click',exportCommander);
  $('setting-sound').addEventListener('change', e => { profile.sound = (e.target as HTMLInputElement).checked; updateSound(); });
  $('setting-coach').addEventListener('change', e => { setCoachEnabled((e.target as HTMLInputElement).checked); if (coach.step) endCoachStep(); });
  $('setting-motion').addEventListener('change', e => { profile.motion = (e.target as HTMLInputElement).checked; applyMotion(); persist(); });
}
function updateSound() { sound.enabled = profile.sound; if (profile.sound) sound.unlock(); $('sound').setAttribute('aria-pressed', String(profile.sound)); persist(); }
function pauseMenu() {
  if (inTown) return;
  if (['victory', 'defeat'].includes(battle.status)) { result(); return; }
  if (modal.open) { modal.close(); return; }
  openModal(`<h2 id="modal-title">${t('pause.title')}</h2><p class="hint">${t('pause.copy')}</p><nav class="menu-list"><button class="menu-item" data-close>${t('pause.resume')}</button><button id="pause-help" class="menu-item">${t('pause.controls')}</button><button id="pause-settings" class="menu-item">${t('pause.settings')}</button><button id="pause-retreat" class="menu-item">${battle.mode === 'dungeon' ? t('dungeon.flee.label') : t('pause.retreat')}</button></nav>`);
  $('pause-help').addEventListener('click', help);
  $('pause-settings').addEventListener('click', settings);
  $('pause-retreat').addEventListener('click', () => navigateTown(battle.mode === 'dungeon' ? 'dungeon' : 'camp'));
}
const escapeUI = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
function showBoonTray() {
  if (inTown || $('combat-boons').hidden) return;
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
  // A mode the story has not opened yet stays shut (the notice says which chapter opens it).
  noteModesInUse(commander.document);
  if (inTown && routeLocked(profile, tab)) { showTown(townState.tab, lockNotice(tab as Feature)); return; }
  const activateTargetMode = () => {
    const activeCommander = commander.document;
    if (!activeCommander) return;
    const mode = modeForTownTab(tab);
    if (mode !== commander.mode) activateCommander(activeCommander, mode, false);
  };
  if (inTown) {
    if (commander.document) {
      // A failed save gets the retry/export prompt instead of a dead button.
      if (!(await commander.flush())) { if (!commander.stale) unsavedTownModal(() => navigateTown(tab), 'storage.unsaved.leave'); else storageStatus(); return; }
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

/** Boon card accent colours (the draft cards' --card-accent). */
const BOON_COLORS: Record<string, string> = { ember: '#ff6b3d', storm: '#4da6ff', tide: '#2de2bd', thorn: '#52cc6c', bell: '#f5c462', fleet: '#5eead4', resolve: '#f97316', execution: '#ef4444', frost: '#38bdf8', feast: '#fb923c', lifeline: '#fbbf24', chorus: '#e879f9' };
const boonColor = (id: string) => BOON_COLORS[id] ?? '#f5c462';

function animateBoonDraft() {
  if (!motionOn()) return;
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
  if (!motionOn()) return;
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
  if (!motionOn()) return;
  const nodes = document.querySelectorAll('.talent-flow-node');
  if (!nodes.length) return;
  gsap.fromTo(
    nodes,
    { opacity: 0, scale: 0.94 },
    { opacity: 1, scale: 1, stagger: 0.02, duration: 0.2, ease: 'power2.out', clearProps: 'opacity,transform' }
  );
}

function animateCodexEntry() {
  if (!motionOn()) return;
  const art = document.querySelector<HTMLElement>('.bestiary-list article');
  if (!art) return;
  const img = art.querySelector<HTMLElement>('img');
  const details = art.querySelector<HTMLElement>('div');
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
  if (img) tl.fromTo(img, { opacity: 0, scale: 0.88, rotate: -2 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.28 });
  if (details) tl.fromTo(details.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.04, duration: 0.22, clearProps: 'all' }, '-=0.15');
}

function animateProphecies() {
  if (!motionOn()) return;
  const entries = document.querySelectorAll<HTMLElement>('.quest-entry');
  if (!entries.length) return;
  gsap.fromTo(entries, { opacity: 0, y: 12 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.25, ease: 'power2.out', clearProps: 'all' });
}

function animateChallengeShop() {
  if (!motionOn()) return;
  const items = document.querySelectorAll<HTMLElement>('.challenge-shop-grid .shop-item');
  if (!items.length) return;
  gsap.fromTo(items, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.03, duration: 0.22, ease: 'power2.out', clearProps: 'all' });
}

function animatePactRaid() {
  if (!motionOn()) return;
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
  if (!motionOn()) return;
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
/** The outcome could not be saved: navigation stays locked until a retry succeeds; the outcome can be exported meanwhile. */
function unsavedResultModal() {
  openModal(`<h2 id="modal-title">${t('result.unsaved.title')}</h2><p>${t('result.unsaved.copy')}</p><button id="retry-save" class="btn primary">${t('result.unsaved.retry')}</button><button id="pending-export" class="btn">${t('result.unsaved.export')}</button>`);
  // A retry closes this dialog first (a failure opens it again), so a saved result is never left under a 'Not saved' dialog.
  $('retry-save').onclick = retryResultSave;
  $('pending-export').onclick = exportCommander;
}
function retryResultSave() { resumeOnClose = false; if (modal.open) modal.close(); presentingResult = false; result(); }
async function presentResult() {
  if (battle.mode === 'dungeon') return presentDungeonResult();
  const won = battle.status === 'victory';
  const moreWaves = won && battle.mode === 'adventure' && battle.stage + 1 < battle.stageCount;
  recruitedIds = [];
  let reward = 0;
  if (!recorded) {
    pendingSettlement = true;
    if (won && !moreWaves && !encounter?.settled) {
      const candidate = structuredClone(profile);
      const wallet = structuredClone(runWallet);
      const rewards = settleProgress(candidate, battle, wallet);
      if (rewards === null) {
        commander.error = 'settlement';
        storageStatus();
        openModal(`<h2 id="modal-title">${t('result.blocked.title')}</h2><p>${t('result.blocked.copy')}</p>`);
        return false;
      }
      // The credited amounts are computed once here and the ceremony shows exactly these.
      if (battle.mode === 'adventure') {
        reward = battle.gold + chapterReward(candidate, battle.floor - 1, battle.heroic);
        candidate.gold += reward;
        const before = new Set(candidate.roster), cap = storyPartyCap(candidate.cleared), firstClear = !candidate.cleared.includes(battle.floor - 1);
        completeZone(candidate, battle.floor - 1);
        recruitedIds = candidate.roster.filter(id => !before.has(id));
        chapterResult = { stars: chapterStars(battle.living().length === battle.heroes.length, battle.stageTime), ...recordChapterResult(candidate, battle.floor - 1, chapterStars(battle.living().length === battle.heroes.length, battle.stageTime), battle.heroic) };
        resultReward = { gold: reward + (chapterResult.heroic?.gold ?? 0), crystal: 0, partyCap: storyPartyCap(candidate.cleared) > cap ? storyPartyCap(candidate.cleared) : 0, firstClear };
      } else resultReward = { gold: 0, crystal: Math.max(0, candidate.economy.commanderCrystal - profile.economy.commanderCrystal), partyCap: 0 };
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
    if (!ok && commander.document) { unsavedResultModal(); return false; }
    pendingSettlement = false;
    recorded = true;
  }
  if (won && battle.mode === 'endless') { offeredBoons = boonChoices(runBoons, runSeed + battle.floor * 7919 + boonReroll * 104729, boonDraftSize(profile.challengeUnlocks)); boonReroll = 0; }
  $('start-overlay').hidden = false;
  $('ready-label').textContent = '';
  $('ready-title').textContent = won ? moreWaves ? t('ready.after.wave') : t('ready.after.win') : t('ready.after.lose');
  $('ready-copy').textContent = t('ready.after.copy');
  $('ready-tip').hidden = true;
  $('start').textContent = t('ready.after.button');
  const description = moreWaves ? t('result.desc.wave') : won && battle.mode === 'adventure' ? storyOutro(battle.floor - 1, profile.narrative ?? {}) : won && battle.mode === 'raid' ? (battle.raidContract?.sandbox ? t('result.desc.sandbox') : t('result.desc.raid', { tier: t(`raid.tier.${battle.raidContract?.tier ?? 'bronze'}` as never) })) : won ? t('result.desc.room', { n: runWallet.crystal }) : t('result.desc.defeat');
  if (won && battle.mode === 'endless') {
    const cardsHtml = offeredBoons.map(b => {
      return `<button class="boon-card" data-boon="${b.id}" style="--card-accent:${boonColor(b.id)}" aria-label="${escapeUI(b.name)} - ${escapeUI(b.patron)}">
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
        ${resultReward?.crystal ? `<p class="boon-run-wallet boon-bank-gain" data-result-reward>${t('boons.bank', { n: resultReward.crystal })}</p>` : ''}
      </header>
      <section class="win rogue-promote" id="rogue-promote" aria-live="polite"></section>
      ${!offeredBoons.length ? `<button id="next-floor" class="btn primary">${t('boon.allcollected')}</button>` : ''}
      <div class="boon-draft-grid" data-cards="${offeredBoons.length}">${cardsHtml}</div>
      <footer class="boon-modal-footer"><button id="result-town" class="btn">${t('boon.abandon')}</button></footer>
    </div>`);
    renderRoguePromote();
    animateBoonDraft();
  } else {
    const outcomeClass = won ? (moreWaves ? 'wave-clear' : 'victory') : 'defeat';
    const banner = moreWaves ? t('result.banner.wave', { n: battle.stage + 1, total: battle.stageCount }) : won ? t('result.banner.win') : t('result.banner.lose');
    const titleText = won ? (moreWaves ? t('result.title.wave') : t('result.title.win')) : t('result.title.lose');
    // Gold or bank Crystal actually credited ('—' when the result is shown again after a reload and the amount is no longer known).
    const credited = !won ? 0 : resultReward ? (battle.mode === 'adventure' ? resultReward.gold : resultReward.crystal) : undefined;
    const rewardPlaque = moreWaves ? [t('result.carried'), `${fmtInt(battle.gold)}G`] : battle.mode === 'adventure' ? [t('result.gold'), credited === undefined ? '—' : `${fmtInt(credited)}G`] : [t('currency.crystal'), credited === undefined ? '—' : `+${fmtInt(credited)}`];
    const retryBattle = !won && battle.mode === 'adventure' && battle.stage > 0 && stageStart?.battle.stage === battle.stage && stageStart.battle.floor === battle.floor;
    // HP carries between battles and nothing revives in between: a checkpoint that began with a hero down (or the party under 40% HP)
    // would replay the same loss, so restarting the chapter becomes the main button and the hint says why.
    const startHeroes = retryBattle ? stageStart!.battle.heroes : [], startDown = startHeroes.filter(h => h.hp <= 0).map(h => heroName(h));
    const weakStart = retryBattle && (startDown.length > 0 || startHeroes.reduce((n, h) => n + Math.max(0, h.hp), 0) < .4 * startHeroes.reduce((n, h) => n + h.maxHp, 0));
    // A Raid hero keeps the class the slot fielded (its colours stay its own); everyone else shows their roster class.
    const xpRows = xpSummary(experienceRewards, id => { const h = battle.mode === 'raid' ? battle.hero(id) : undefined; return h ? face(h) : portrait(ROSTER[id].classId, 0, id); });
    // A Story defeat says why and what to do: power vs the recommendation, who fell first, the enemy's counter, up to two one-tap fixes.
    // The first fall of this battle (a KO still queued for the scene counts too: the result can open before the scene drains it).
    const queuedDown = battle.events.find(e => e.type === 'down');
    const enemy = ENEMIES[battle.enemyId], fall = firstFall?.battle === battle && firstFall.stage === battle.stage ? firstFall : queuedDown ? { name: heroLabel(queuedDown.source), cause: downCause(queuedDown) } : undefined;
    const fixes = !won && battle.mode === 'adventure' ? defeatFixes(profile, battle.floor - 1, battle.heroic) : [];
    const rec = battle.heroic ? recommendedHeroicPower(battle.floor - 1) : recommendedPower(battle.floor - 1), power = partyPower(profile), verdict = powerVerdict(power, rec);
    const fixLabel = (fix: typeof fixes[number]) => fix.kind === 'dungeon' ? t('result.fix.dungeon') : t(fix.kind === 'jobs' ? 'result.fix.jobs' : 'result.fix.gear', { name: ROSTER[fix.hero!].name });
    const defeatHelp = won ? '' : `<section class="win defeat-help" aria-label="${t('result.fix.title')}">
        ${battle.mode === 'adventure' ? `<p class="power-line power-${verdict}" data-defeat-power>${t('result.defeat.power', { n: power, rec })} <em>${t(`power.verdict.${verdict}` as never)}</em></p>` : ''}
        ${fall ? `<p class="defeat-first">${escapeUI(fall.cause ? t('result.defeat.first', { name: fall.name, cause: fall.cause }) : t('result.defeat.first.plain', { name: fall.name }))}</p>` : ''}
        ${enemy?.counter ? `<p class="counter-note defeat-tip"><b>${escapeUI(t('result.defeat.tip', { name: eventText(battle.enemyName, lang()) }))}:</b> ${escapeUI(enemy.counter)}</p>` : ''}
        ${fixes.length ? `<h3 class="subheading">${t('result.fix.title')}</h3><div class="defeat-fixes">${fixes.map(fix => `<button class="btn" data-defeat-fix="${fix.kind}" ${fix.hero !== undefined ? `data-fix-hero="${fix.hero}"` : ''} ${fix.slot ? `data-fix-slot="${fix.slot}" data-fix-gear="${fix.gearId}"` : ''}>${escapeUI(fixLabel(fix))} ▶</button>`).join('')}</div>` : ''}
      </section>`;
    // Details: the real breakdown (the fight's numbers and which star goals this clear met).
    const starGoals = won && !moreWaves && battle.mode === 'adventure' && !battle.heroic ? ([['stars.goal.clear', true], ['stars.goal.standing', battle.living().length === battle.heroes.length], ['stars.goal.par', battle.stageTime <= STAR_PAR_SECONDS]] as const) : [];
    const readyQuests = QUESTS.filter(q => questProgress(profile, q).ready).length;
    showResultScreen(`<div class="result-ceremony-modal ${outcomeClass}">
      <p class="result-banner" aria-hidden="true">${banner}</p>
      <header class="win ceremony-header">
        <h2 id="result-title" class="ceremony-title">${titleText}</h2>
        <p class="ceremony-desc${won && !moreWaves && battle.mode === 'adventure' ? ' ceremony-outro' : ''}">${escapeUI(description).replace(/\n/g, '<br>')}</p>
        ${([['result.recruited', true], ['result.recruited.bench', false]] as const).map(([key, deployed]) => { const names = recruitedIds.filter(id => profile.storyActive.includes(id) === deployed).map(id => ROSTER[id].name); return names.length ? `<p class="recruit-notice">${t(key, { names: names.join(' & ') })}</p>` : ''; }).join('')}
        ${won && !moreWaves && battle.mode === 'adventure' && battle.floor === CAMPAIGN.length && resultReward?.firstClear ? `<p class="recruit-notice campaign-complete">${t('result.campaign.complete')}</p>` : ''}
        ${resultReward?.partyCap && won && !moreWaves ? `<p class="recruit-notice party-grew">${t('notice.party.grew', { n: resultReward.partyCap })}</p>` : ''}
        ${won && !moreWaves && battle.heroic ? `<p class="result-stars heroic-stars">${t('stars.heroic')}</p>` : chapterResult && won && !moreWaves ? `<p class="result-stars"><span>${t('result.stars')}</span> ${starRow(chapterResult.stars)}${chapterResult.improved ? ` <em>${t('result.stars.new')}</em>` : ''}</p>` : ''}
        ${chapterResult?.heroic ? `<p class="recruit-notice">${t('result.heroic', { gold: chapterResult.heroic.gold, mat: materialList(chapterResult.heroic.materials) })}</p>` : ''}
      </header>
      <section class="win result-summary" aria-label="${t('result.summary')}">
        <dl class="stat-table result-stats"><div class="stat-plaque"><dt>${t('result.survivors')}</dt><dd>${battle.living().length}/${battle.heroes.length}</dd></div><div class="stat-plaque gold"><dt>${rewardPlaque[0]}</dt><dd data-result-reward>${rewardPlaque[1]}</dd></div><div class="stat-plaque"><dt>${t('result.time')}</dt><dd>${formatTime(battle.time)}</dd></div></dl>
        ${xpRows}
        ${readyQuests && !moreWaves && won ? `<p class="hint">${t('result.quests', { n: readyQuests })}</p>` : ''}
        ${retryBattle ? `<p class="hint retry-battle-hint">${t('result.retry.battle.hint')}</p>` : ''}
        ${weakStart ? `<p class="hint retry-weak-hint" data-weak-checkpoint>${escapeUI(startDown.length ? t('result.retry.battle.down', { names: startDown.join(' & ') }) : t('result.retry.battle.low'))}</p>` : ''}
      </section>
      ${defeatHelp}
      <section class="win result-details" id="result-details" aria-label="${t('result.details')}" hidden>
        <dl class="stat-table"><div><dt>${t('battle.stat.damage')}</dt><dd>${fmtInt(battle.damage)}</dd></div><div><dt>${t('result.detail.healed')}</dt><dd>${fmtInt(battle.healed)}</dd></div><div><dt>${t('battle.stat.blocked')}</dt><dd>${fmtInt(battle.blocked)}</dd></div><div><dt>${t('result.detail.dodged')}</dt><dd>${battle.dodged}</dd></div><div><dt>${t('result.detail.taps')}</dt><dd>${battle.taps}</dd></div><div><dt>${t('result.detail.moves')}</dt><dd>${battle.relocations}</dd></div></dl>
        ${starGoals.length ? `<h3 class="subheading">${t('result.detail.stars')}</h3><ul class="result-star-goals">${starGoals.map(([key, met]) => `<li class="${met ? 'met' : ''}">${t(key, { s: STAR_PAR_SECONDS })}</li>`).join('')}</ul>` : ''}
        <p class="hint">${t('result.xp.note', { n: Math.round(FALLEN_XP * 100) })}</p>
      </section>
      <div class="ceremony-actions">
        ${weakStart ? `<button id="retry" class="btn primary">${t('result.restart')}</button>` : ''}
        ${retryBattle ? `<button id="retry-battle" class="btn ${weakStart ? '' : 'primary'}" title="${escapeUI(t('result.retry.battle.hint'))}">${t('result.retry.battle')}</button>` : ''}
        ${moreWaves ? `<button id="next-wave" class="btn primary">${t('result.next')} ▶</button>` : weakStart ? '' : `<button id="retry" class="btn">${!won && battle.stage > 0 ? t('result.restart') : t('result.retry')}</button>`}
        <button id="result-town" class="btn ${moreWaves || retryBattle ? '' : 'primary'}">${moreWaves ? t('result.abandon') : t('result.town')}</button>
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
      if (initialized) scene.replace(battle);
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
    // Read before boot replaces `battle`: a Heroic retry stays Heroic.
    const mode = battle.mode, floor = battle.mode === 'endless' ? 1 : battle.floor, heroic = battle.heroic;
    runBoons = [];
    closeWithoutResume();
    boot(mode, floor, mode === 'adventure' && heroic ? { heroic: true } : {});
    void clearEncounter();
  });
  // Retry only the lost battle from its start checkpoint: HP and potions as they were then, no refill.
  $('retry-battle')?.addEventListener('click', () => {
    if (!stageStart) return;
    const saved = { ...structuredClone(stageStart), seq: Math.max(stageStart.seq, encounter?.seq ?? 0) };
    closeWithoutResume();
    resumeEncounter(saved);
    void checkpoint();
  });
  // Leave the settled result for a town route (the camp plays the scenes a clear queued: join scenes, a story choice, the finale).
  const leaveResult = (tab: TownTab, prepare?: () => void) => {
    runBoons = [];
    // The selected hero and chapter stay (activateCommander keeps them in the same file); a first clear moves on to the next chapter.
    if (battle.mode === 'adventure' && commander.document) activateCommander(commander.document, 'story');
    if (battle.mode === 'adventure' && won && !moreWaves && resultReward?.firstClear) selectZone(Math.min(profile.cleared.length, CAMPAIGN.length - 1));
    prepare?.();
    closeWithoutResume();
    inTown = true;
    recruitedIds = [];
    routeStack = ['camp'];
    showTown(tab, '', true);
  };
  $('result-town').addEventListener('click', () => {
    if (moreWaves || won && battle.mode === 'endless') {
      navigateTown('camp');
      return;
    }
    leaveResult('camp');
  });
  resultScreen.querySelectorAll<HTMLButtonElement>('[data-defeat-fix]').forEach(button => button.addEventListener('click', () => {
    const kind = button.dataset.defeatFix, hero = Number(button.dataset.fixHero), slot = button.dataset.fixSlot as TownState['gearSlot'] | undefined, gearId = button.dataset.fixGear;
    if (Number.isInteger(hero) && profile.roster.includes(hero)) townState.hero = hero;
    townState.pendingGear = undefined;
    if (kind === 'jobs') townState.trainingTab = 'talents';
    if (kind === 'gear') townState.trainingTab = 'gear';
    // The gear fix opens on the upgrade it found: its slot, with the piece in the inspector.
    leaveResult(kind === 'dungeon' ? 'dungeon' : kind === 'jobs' ? 'party-advanced' : 'party', () => {
      if (Number.isInteger(hero) && profile.roster.includes(hero)) townState.hero = hero;
      if (kind === 'gear' && slot && gearId) { townState.gearSlot = slot; townState.pendingGear = { hero: townState.hero, slot, gearId }; }
    });
  }));
}

/** Result of one Undercroft room: XP, carried HP and the pouch update, then back to the map. */
async function presentDungeonResult() {
  const won = battle.status === 'victory';
  let loot: { gold: number; materials: Record<string, number> } | undefined;
  if (!recorded) {
    pendingSettlement = true;
    // Settle once per fight: a retry after a failed save only saves again.
    if (dungeonSettled !== battle) {
      const candidate = structuredClone(profile), run = candidate.journey.run;
      const rewards = won ? settleProgress(candidate, battle) ?? [] : [];
      // The pouch and HP before the fight: a wipe shows what it cost, every result shows each hero's HP before → after.
      dungeonBefore = run ? { hp: { ...run.hp }, pouch: structuredClone(run.pouch) } : undefined;
      if (run) {
        loot = resolveFight(run, won, heroRatios(), battle.potions);
        if (run.status === 'cleared') { bankPouch(candidate, run.pouch); candidate.journey.depth = Math.max(candidate.journey.depth, run.depth); }
      }
      if (won) candidate.wins++;
      profile = candidate; experienceRewards = rewards; dungeonLoot = loot; dungeonSettled = battle;
    }
    // Saved the moment the result appears (the no-op edit passes the pendingSettlement guard), so a reload keeps the XP and pouch and cannot undo a wipe.
    const ok = await persist('auto', () => {});
    if (!ok && commander.document) { unsavedResultModal(); return false; }
    pendingSettlement = false; recorded = true;
  }
  loot = dungeonLoot;
  const run = profile.journey.run, cleared = run?.status === 'cleared';
  const xpRows = xpSummary(experienceRewards, id => portrait(ROSTER[id].classId, 0, id));
  // A cleared depth says what the next stair needs: open now, behind a chapter, or none (the deepest depth).
  const nextDepth = DEPTHS.find(d => d.id === (run?.depth ?? 0) + 1);
  const clearedText = !nextDepth ? t('dungeon.end.cleared.last') : profile.cleared.includes(nextDepth.unlock - 1) ? t('dungeon.end.cleared') : t('dungeon.end.cleared.wait', { n: nextDepth.unlock });
  const desc = !won ? t('dungeon.end.wiped') : cleared ? clearedText : loot ? `${t('dungeon.out.gold', { n: loot.gold })} ${Object.entries(loot.materials).map(([id, n]) => t('dungeon.out.material', { n, name: t(`material.${id}` as never) })).join(' ')}` : '';
  // A wipe names what the pouch held; with an empty pouch there is nothing to lose and nothing to say.
  const before = dungeonBefore, lost = !won && before && (before.pouch.gold > 0 || Object.values(before.pouch.materials).some(n => n > 0)) ? before.pouch : undefined;
  const pct = (ratio: number) => `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  const hpRows = run && before ? run.party.filter(id => ROSTER[id]).map(id => { const from = before.hp[id] ?? 0, to = run.hp[id] ?? 0; return `<li class="${to <= 0 ? 'down' : to < .35 ? 'low' : ''}"><img src="${portrait(ROSTER[id].classId, 0, id)}" alt=""/><b>${ROSTER[id].name}</b><span class="gauge" aria-hidden="true"><i style="width:${pct(to)}"></i></span><small>${pct(from)} <span class="hp-arrow">→</span> ${pct(to)}</small></li>`; }).join('') : '';
  $('start-overlay').hidden = false;
  showResultScreen(`<div class="result-ceremony-modal ${won ? 'victory' : 'defeat'}">
    <p class="result-banner" aria-hidden="true">${won ? cleared ? t('dungeon.end.cleared.banner') : t('result.banner.win') : t('dungeon.end.wiped.banner')}</p>
    <header class="win ceremony-header"><h2 id="result-title" class="ceremony-title">${t('route.dungeon')} · ${t('dungeon.depth.label', { n: run?.depth ?? 1 })}</h2><p class="ceremony-desc">${escapeUI(desc)}</p></header>
    <section class="win result-summary"><dl class="stat-table result-stats"><div class="stat-plaque"><dt>${t('result.survivors')}</dt><dd>${battle.living().length}/${battle.heroes.length}</dd></div><div class="stat-plaque"><dt>${t('dungeon.pouch')}</dt><dd>${lost ? `−${fmtInt(lost.gold)}G` : `${fmtInt(run?.pouch.gold ?? 0)}G`}</dd></div><div class="stat-plaque"><dt>${t('result.time')}</dt><dd>${formatTime(battle.time)}</dd></div></dl>${lost ? `<p class="dungeon-lost">${escapeUI(t('dungeon.lost', { lost: lostText(lost) }))}</p>` : ''}${hpRows ? `<h3 class="subheading">${t('dungeon.result.hp')}</h3><ul class="dungeon-hp-list">${hpRows}</ul>` : ''}${xpRows}</section>
    <div class="ceremony-actions"><button id="result-dungeon" class="btn primary">${t('dungeon.result.back')} ▶</button></div>
  </div>`);
  sound.play(won ? 'fanfare' : 'defeat');
  if (experienceRewards.some(r => r.after > r.before)) window.setTimeout(() => sound.play('levelup'), 1300);
  animateCeremony();
  $('result-dungeon').addEventListener('click', () => { closeWithoutResume(); inTown = true; townState.dungeonOutcome = townState.dungeonLetter = undefined; showTown('dungeon', '', true); });
  return true;
}
let dungeonLoot: { gold: number; materials: Record<string, number> } | undefined;
let dungeonBefore: { hp: Record<number, number>; pouch: Pouch } | undefined;
let dungeonSettled: Battle | undefined;
function makeEncounter(settled = false): NonNullable<typeof encounter> {
  return { runId: encounter?.runId ?? crypto.randomUUID(), seq: (encounter?.seq ?? 0) + 1, battle: battle.checkpoint(), purse: runWallet.crystal, boons: [...runBoons], seed: runSeed, settled };
}
async function checkpoint(terminal = false, slotId: SlotId = 'auto') {
  if (battle.mode === 'dungeon') return persist(slotId, () => {});
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
      // Story slots are left alone here: applyRuntimeToDocument raises only the live Story slot's hero XP and merges the ledger into document.shared.
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
async function restoreEncounter(savedEncounter: NonNullable<typeof encounter>) {
  if (!inTown || commander.stale || pendingSettlement) return;
  // Wait for a save in flight; a failed one gets a retry/export prompt instead of a dead Depart button.
  if (!(await commander.flush())) { unsavedTownModal(() => restoreEncounter(savedEncounter)); return; }
  if (!inTown || pendingSettlement) return;
  resumeEncounter(savedEncounter);
}
/** Rebuild the battle from an encounter checkpoint (a resumed save, or 'Retry this battle'). */
function resumeEncounter(savedEncounter: NonNullable<typeof encounter>) {
  const frozen = structuredClone(savedEncounter);
  boot(frozen.battle.mode, frozen.battle.floor);
  battle.restoreCheckpoint(frozen.battle);
  encounter = frozen;
  runWallet = createRunWallet(); runWallet.crystal = frozen.purse; battle.runWallet = runWallet;
  runBoons = [...frozen.boons]; runSeed = frozen.seed;
  recorded = frozen.settled;
  townState.rogueSetup = battle.rogueBuild ? structuredClone(battle.rogueBuild) : townState.rogueSetup;
  if (initialized) scene.replace(battle);
  makeUnits(); updateExpedition(); showReady();
  $('ready-copy').textContent = t('ready.resume'); $('ready-tip').hidden = true;
  if (frozen.settled) result();
}
/** Town changes could not be saved: retry (then continue with `next`) or export them. */
function unsavedTownModal(next: () => unknown, copy: 'storage.unsaved.copy' | 'storage.unsaved.leave' = 'storage.unsaved.copy') {
  storageStatus();
  openModal(`<h2 id="modal-title">${t('result.unsaved.title')}</h2><p>${t(copy)}</p><p class="hint">${commander.error ? escapeUI(errorText(commander.error)) : ''}</p><button id="retry-save" class="btn primary">${t('result.unsaved.retry')}</button><button id="pending-export" class="btn">${t('result.unsaved.export')}</button><button data-close class="btn">${t('common.cancel')}</button>`);
  // In a battle the dialog stays open for what comes next (the Suspend/Abandon prompt replaces it), so Cancel there still resumes the fight.
  // In a battle the retry saves the encounter checkpoint too (the battle-start save may be the one that failed).
  $('retry-save').onclick = () => { void (inTown ? persist() : checkpoint()).then(ok => { if (ok) { if (inTown) closeWithoutResume(); void next(); } else unsavedTownModal(next, copy); }); };
  $('pending-export').onclick = exportCommander;
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
    return `<div class="rogue-promote-row"><span><b>${escapeUI(heroName(hero))}</b><small>${escapeUI(current ?? '')}</small></span><span class="rogue-promote-options">${options.length ? options.map(j => `<button class="btn" data-rogue-promote="${i}" data-job="${j.id}">${escapeUI(j.name)} ▲</button>`).join('') : `<small>${t('rogue.promote.max')}</small>`}</span></div>`;
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
/** `resumed`: the document is exactly what storage holds (just loaded or just saved), so the next unchanged town render does not commit another revision. */
function activateCommander(document: CommanderDocument, mode = document.activeMode, renderTownAfterActivation = true, resumed = false) {
  // A mode switch inside the same file keeps the selected hero and chapter (and with it the Heroic toggle); another file starts from its own.
  const same = commander.document?.commanderId === document.commanderId;
  profile = commander.select(document, mode);
  encounter = undefined; runBoons = []; runWallet = createRunWallet(); recorded = false; pendingSettlement = false;
  const rogue = storedStateFor(document, 'roguelike', 'auto');
  const raid = storedStateFor(document, 'raid', 'auto');
  townState.rogueSetup = rogue && 'bestFloor' in rogue ? structuredClone(rogue.build) : createRogueBuild();
  townState.raidBuild = raid && 'build' in raid && raid.build && 'slots' in raid.build ? structuredClone(raid.build) : defaultRaidBuild(profile);
  const contract = raid && 'contract' in raid ? raid.contract : undefined;
  townState.raid = huntTarget ?? contract?.bossId ?? 'golem'; townState.raidTier = contract?.tier ?? 'bronze'; townState.raidModifiers = (contract?.modifiers ?? []).filter(raidModifierAvailable);
  townState.raidSandbox = raid && 'sandbox' in raid ? raid.sandbox : undefined;
  townState.pendingGear = undefined;
  if (!same || !profile.roster.includes(townState.hero)) townState.hero = profile.roster[0];
  if (!same || !canEnterZone(profile, townState.zone)) selectZone(Math.min(profile.cleared.length, CAMPAIGN.length - 1));
  sound.enabled = profile.sound; applyMotion();
  $('sound').setAttribute('aria-pressed', String(profile.sound));
  if (resumed && mode === document.activeMode) { syncProfileEconomy(profile); savedSignature = `${document.commanderId}:${commander.document!.revision}:${JSON.stringify(context())}`; } else savedSignature = '';
  updateTitleStatus();
  if (inTown && renderTownAfterActivation) showTown(mode === 'story' ? 'camp' : mode === 'raid' ? 'raid' : 'endless');
}
async function leaveSafely(action: () => void | Promise<void>) {
  if (pendingSettlement || presentingResult || commander.stale) { storageStatus(); return; }
  // A failed save gets the same retry/export prompt as town navigation (its Retry runs this again), never a silent dead button.
  if (!(await commander.flush())) { if (!commander.stale) unsavedTownModal(() => leaveSafely(action), 'storage.unsaved.leave'); else storageStatus(); return; }
  // A dungeon fight under way can only be left by fleeing (wounds kept, half the pouch lost); before Begin or after the result it just closes.
  if (dungeonFightLive() && battle.status !== 'ready') { fleeDungeonModal(); return; }
  if (inTown || battle.mode === 'dungeon') { closeWithoutResume(); inTown = true; await action(); return; }
  const hasCommander = Boolean(commander.document);
  openModal(hasCommander
    ? `<h2 id="modal-title">${t('leave.title')}</h2><p>${t('leave.copy')}</p><nav class="menu-list"><button id="suspend-run" class="menu-item">${t('leave.suspend')}</button><button id="abandon-run" class="menu-item">${t('leave.abandon')}</button><button data-close class="menu-item">${t('common.cancel')}</button></nav>`
    : `<h2 id="modal-title">${t('leave.title')}</h2><p>${t('leave.copy.none')}</p><nav class="menu-list"><button id="abandon-run" class="menu-item">${t('leave.abandon')}</button><button data-close class="menu-item">${t('common.cancel')}</button></nav>`);
  // A save already in flight (the battle-start checkpoint) is queued behind, not a reason to drop the click; `leaving` only stops a double tap.
  let leaving = false;
  $('suspend-run')?.addEventListener('click', async () => {
    if (!commander.document || leaving) return;
    leaving = true;
    try { await startCheckpoint; if (await persist('auto', doc => { if (commander.mode !== 'story') { const state=commander.mode==='raid'?doc.raid:doc.rogue; if (state.activeRun) state.activeRun.status='suspended'; } })) { closeWithoutResume(); inTown = true; await action(); } } finally { leaving = false; }
  });
  $('abandon-run').addEventListener('click', async () => {
    if (leaving) return;
    leaving = true;
    try {
      // Without a Commander (a stalled lookup) the checkpoint may never come; clearing `encounter` below already stops a late one.
      if (commander.document) await startCheckpoint;
      let cleared = true;
      if (commander.document) cleared = await clearEncounter();
      else {
        encounter = undefined;
        runBoons = [];
        offeredBoons = [];
        resetRunWallet(runWallet);
      }
      if (cleared) { closeWithoutResume(); inTown = true; await action(); }
    } finally { leaving = false; }
  });
}
function download(data: unknown, filename: string) {
  const text = typeof data === 'string' ? data : data === undefined || data === null ? undefined : JSON.stringify(data, null, 2);
  // Never hand the player an empty or 'undefined' file that looks like a backup.
  if (!text) { openModal(`<h2 id="modal-title">${t('export.empty.title')}</h2><p>${t('export.empty.copy')}</p><button data-close class="btn primary">${t('common.close')}</button>`, false); return false; }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  return true;
}
/** gridbound.v3 as written, when it is a complete save that holds the latest progress; the live profile otherwise (corrupt or blocked key, a failed write, or a boot that has not written it yet). */
function legacyProfile() {
  if (!storageFailed && commanderChecked) try { const parsed: unknown = JSON.parse(store.getItem(SAVE_KEY) ?? 'null'); if (isCompleteV3(parsed)) return parsed; } catch { /* corrupt or blocked: export the live profile */ }
  syncProfileEconomy(profile);
  return structuredClone(profile);
}
/** Every backup is importable from the Save dialog: the Commander document, a recovery file while a save is pending, or the legacy profile when no Commander exists yet. */
function exportCommander() {
  if (!commander.document) { download(legacyBackup(legacyProfile() as Profile), 'Gridbound-Save.json'); return; }
  download(commander.dirty || pendingSettlement ? { kind:'gridbound-recovery', mode:commander.mode, document:commander.document, pendingProfile:profile, pendingEncounter:encounter } : commander.document, 'Gridbound-Commander.json');
}
import { STORY_CHOICES, narrativeChoice, epilogue, storyOutro, choiceOpen, pendingChoices } from './game/narrative';
function chapterChronicle() {
  if (!profile.cleared.length) return '';
  return `<section class="journal-chronicle"><h3>${t('journal.chronicle', { n: profile.cleared.length })}</h3>${[...profile.cleared].sort((a, b) => a - b).map(i => `<details class="journal-entry-card"><summary>CH ${i + 1} · ${escapeUI(CAMPAIGN[i].name)}</summary><button class="btn journal-replay" data-replay-chapter="${i}">▶ ${t('journal.watch')}</button><p>${escapeUI(CAMPAIGN[i].intro).replace(/\n/g, '<br>')}</p><p>${escapeUI(storyOutro(i, profile.narrative ?? {})).replace(/\n/g, '<br>')}</p></details>`).join('')}</section>`;
}
async function storyJournal() {
  if (!inTown) return;
  // A failed save gets the retry/export prompt; the Journal opens once it is saved.
  if (!(await commander.flush())) { if (!commander.stale) unsavedTownModal(() => storyJournal(), 'storage.unsaved.leave'); else storageStatus(); return; }
  if (!inTown) return;
  // The Journal is Story: from a Raid or Bell Trials route (or the title screen over one) it switches to Story properly, so the profile, the
  // mode and the visible route agree (a Story profile left in a challenge mode would be saved over the Crystal bank at the next departure).
  if (commander.document && commander.mode !== 'story') {
    activateCommander(commander.document, 'story', false);
    showTown(modeForTownTab(townState.tab, 'story') === 'story' ? townState.tab : 'camp');
  }
 const state=profile.narrative??{};
 const scenes=STORY_CHOICES.filter(s=>choiceOpen(s,profile.cleared));
 const finished=CAMPAIGN.every((_,i)=>profile.cleared.includes(i));
 const companions=[...profile.roster].filter(id=>CHARACTERS[id].recruitChapter>0).sort((a,b)=>a-b);
 const choice=(s:(typeof STORY_CHOICES)[number])=>`<section class="journal-scene"><h3>${escapeUI(s.title)}</h3><p>${escapeUI(s.text)}</p>${state[s.id]?`<p class="journal-outcome">${escapeUI(s.options.find(o=>o.id===state[s.id])?.outcome??'')}</p>`:`<nav class="menu-list">${s.options.map(o=>`<button class="menu-item" data-story-choice="${s.id}" data-story-option="${o.id}">${escapeUI(o.label)}</button>`).join('')}<button class="menu-item" data-close>${t('journal.later')}</button></nav>`}</section>`;
 const recruits=companions.length?`<section class="journal-companions-list"><h3>${t('journal.companions')}</h3><div class="journal-companions">${companions.map(id=>`<button class="btn" data-replay-recruit="${id}" title="${escapeUI(t('journal.recruit',{name:CHARACTERS[id].name}))}" aria-label="${escapeUI(t('journal.recruit',{name:CHARACTERS[id].name}))}">▶ ${escapeUI(CHARACTERS[id].name)}</button>`).join('')}</div></section>`:'';
 const ending=finished?`<section class="journal-epilogue"><h3>${t('journal.epilogue')}</h3><p>${escapeUI(t('journal.epilogue.lead'))}</p>${epilogue(state,profile.cleared).map(text=>`<p>${escapeUI(text)}</p>`).join('')}<button class="btn journal-replay" data-replay-ending>▶ ${t('journal.ending')}</button></section>`:'';
 openModal(`<h2 id="modal-title">${t('journal.title')}</h2><p class="hint">${t('journal.intro')}</p>${scenes.length?'':`<p>${t('journal.locked',{n:Math.min(...STORY_CHOICES.map(s=>s.chapter))})}</p>`}${scenes.map(choice).join('')}${recruits}${chapterChronicle()}${ending}<button class="btn primary" data-close>${t('common.back')}</button>`);
 modal.querySelectorAll<HTMLElement>('[data-replay-chapter]').forEach(button=>button.onclick=()=>{ closeWithoutResume(); void chapterIntro(Number(button.dataset.replayChapter)); });
 modal.querySelectorAll<HTMLElement>('[data-replay-recruit]').forEach(button=>button.onclick=()=>{ closeWithoutResume(); void recruitScene(Number(button.dataset.replayRecruit),true); });
 modal.querySelector<HTMLElement>('[data-replay-ending]')?.addEventListener('click',()=>{ closeWithoutResume(); void endingScene(); });
 modal.querySelectorAll<HTMLElement>('[data-story-choice]').forEach(button=>button.onclick=async()=>{
  if(commander.stale)return;
  profile.narrative??={};
  if(narrativeChoice(profile.narrative,button.dataset.storyChoice!,button.dataset.storyOption!,profile.cleared)){ await persist(); await storyJournal(); }
 });
}
function hasProgress(p: Profile) { return p.cleared.length > 0 || p.roster.length > 3 || p.gold !== createProfile().gold; }
const progressSummary = (p: Profile) => ({ ch: p.cleared.length, gold: p.gold, heroes: p.roster.length });
/** Import a downloaded backup as a new Commander (fresh id, three-file limit). It keeps its Crystal bank only when that cannot duplicate one: no Commander here came from the same file (a legacy backup: no Commander at all). */
async function importSave(file: File, documents: CommanderDocument[]) {
  if (documents.length >= 3) throw new CommanderError('import-full', 'All three Commander files are in use.');
  const imported = commanderFromBackup(await file.text().catch(() => ''), { id: globalThis.crypto?.randomUUID?.() ?? `commander-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, name: t('profiles.legacy.name'), timestamp: Date.now() });
  if (!imported) throw new CommanderError('import-invalid', 'This file is not a Gridbound save backup.');
  // A copy next to its source (or a legacy backup next to any Commander) keeps the progress but not a second bank: it is named as a copy,
  // and the dialog says where the Crystal and relics stayed, so restoring a backup never looks like losing them.
  const original = imported.document.name, stripped = imported.sourceId ? documents.some(doc => doc.commanderId === imported.sourceId) : documents.length > 0;
  if (stripped) { imported.document.shared.bankCrystal = 0; imported.document.shared.challengeUnlocks = []; imported.document.name = t('profiles.import.copyName', { name: original }).slice(0, 32); }
  const source = imported.sourceId ? documents.find(doc => doc.commanderId === imported.sourceId)?.name : undefined;
  await leaveSafely(() => creatingCommander(async () => { activateCommander(await commander.create(imported.document.name, imported.document)); }, stripped ? t(source ? 'profiles.import.bankStays' : 'profiles.import.bankNone', { name: source ?? original }) : undefined));
}
/** Creating a Commander file: a 'Saving…' dialog stays up until the new file is active (so a late activation never pulls the player off another screen) and shows the error if creation fails. `done`: a note shown once it succeeds (the dialog then stays open). */
async function creatingCommander(task: () => Promise<void>, done?: string) {
  openModal(`<h2 id="modal-title">${t('profiles.title')}</h2><p id="creating-status">${t('storage.saving')}</p><p id="profile-error" role="status"></p><button data-close class="btn">${t('common.close')}</button>`);
  try { await task(); if (done && modal.open) openModal(`<h2 id="modal-title">${t('profiles.import.done')}</h2><p data-import-note>${escapeUI(done)}</p><button data-close class="btn primary">${t('common.close')}</button>`, false); else closeWithoutResume(); }
  catch (error) { if (modal.open && document.getElementById('profile-error')) { console.warn('Commander storage:', error); $('creating-status').textContent = t('result.unsaved.title'); $('profile-error').textContent = errorText(error); } else storageError(error); }
}
/** What loading a slot would bring back, in words: Story progress (chapters, gold, strongest heroes), a Raid contract and party, or a Bell Trials build and best floor, plus when it was saved. */
function slotSummary(state: unknown, savedAt: number) {
  const rows: string[] = [];
  if (state && typeof state === 'object') {
    if ('cleared' in state) {
      const story = state as { cleared: number[]; gold: number; roster: number[]; loadouts: Profile['loadouts'] };
      const last = Math.max(-1, ...story.cleared);
      rows.push(t('profiles.preview.chapters', { n: story.cleared.length, total: CAMPAIGN.length }) + (CAMPAIGN[last] ? ` · ${CAMPAIGN[last].name}` : ''));
      rows.push(t('profiles.preview.gold', { n: story.gold }));
      const top = story.roster.filter(id => ROSTER[id]).map(id => ({ id, level: heroProgress(story.loadouts[id]?.xp).level })).sort((a, b) => b.level - a.level || a.id - b.id).slice(0, 3);
      rows.push(t('profiles.preview.heroes', { n: story.roster.length, list: top.map(h => `${ROSTER[h.id].name} LV ${h.level}`).join(', ') }));
    } else if ('bestFloor' in state) {
      const rogue = state as { bestFloor: number; build?: { recruits?: { classId: keyof typeof KITS }[] } };
      rows.push(t('profiles.preview.floor', { n: rogue.bestFloor }));
      const party = (rogue.build?.recruits ?? []).map(r => KITS[r.classId]?.name).filter(Boolean);
      if (party.length) rows.push(t('profiles.preview.party', { list: party.join(', ') }));
    } else {
      const raid = state as { contract?: { bossId: string; tier: RaidTier }; build?: { slots?: { heroId: number }[] } };
      if (raid.contract) rows.push(t('profiles.preview.raid', { name: ENEMIES[raid.contract.bossId]?.name ?? '?', tier: t(`raid.tier.${raid.contract.tier}` as never) }));
      const party = (raid.build?.slots ?? []).map(slot => ROSTER[slot.heroId]?.name).filter(Boolean);
      if (party.length) rows.push(t('profiles.preview.party', { list: party.join(', ') }));
    }
  }
  if (savedAt) rows.push(t('profiles.preview.saved', { time: fmtDateTime(savedAt) }));
  return `<ul class="slot-summary">${rows.map(row => `<li>${escapeUI(row)}</li>`).join('')}</ul>`;
}
async function profilesMenu() {
  openModal(`<h2 id="modal-title">${t('profiles.title')}</h2><p>${t('profiles.loading')}</p>`);
  try {
    const documents = await commander.open();
    if (!commander.document && documents.length > 0) {
      const latest = [...documents].sort((a, b) => b.lastPlayed - a.lastPlayed)[0];
      activateCommander(latest, undefined, true, true);
    }
    const current = commander.document;
    // No Commander holds the live progress (migration pending or failed, or a protected legacy save): keeping it is the primary action.
    const unheld = !current, full = documents.length >= 3;
    const slots = current ? (commander.mode === 'story' ? current.story : commander.mode === 'raid' ? current.raid : current.rogue).slots : [];
    // The old save is read when the preview opens and again on confirm, never from the page-load snapshot.
    const rawV3 = () => { try { return store.getItem(SAVE_KEY); } catch { return null; } };
    // 'Retry save' only when a save failed or a result waits to be saved; 'Old save' only when there is an old save to look at.
    const retryable = commander.failed || pendingSettlement, legacyHere = Boolean(rawV3());
    openModal(`<h2 id="modal-title">${t('profiles.title')}</h2><p class="hint">${t('profiles.intro')}</p>
      <div class="save-files">${documents.map((doc,index) => `<div class="save-file ${current?.commanderId === doc.commanderId ? 'current' : ''}"><div><b>${escapeUI(doc.name)}</b><small>${t('profiles.file', { ch: doc.story.slots[3].state?.cleared.length ?? 0, total: CAMPAIGN.length, crystal: doc.shared.bankCrystal })}</small></div><button data-commander="${index}" class="btn">${current?.commanderId === doc.commanderId ? t('profiles.current') : t('profiles.switch')}</button></div>`).join('') || (unheld ? '' : `<p>${t('profiles.empty')}</p>`)}</div>
      <label class="name-field">${t('profiles.name')} <input id="commander-name" maxlength="32" value="${escapeUI(current?.name ?? t('profiles.default.name'))}"></label>
      ${unheld ? `<p class="hint" id="continue-summary">${t('profiles.continue.summary', progressSummary(profile))}</p>` : ''}
      <div class="departure-actions">${unheld ? `<button id="continue-mine" class="btn primary" ${full ? 'disabled' : ''}>${t('profiles.continue.mine')}</button>` : ''}<button id="new-commander" class="btn" ${full ? 'disabled' : ''}>${t('profiles.new')}</button>${current ? `<button id="rename-commander" class="btn">${t('profiles.rename')}</button><button id="export-commander" class="btn">${t('profiles.export')}</button><button id="delete-commander" class="btn danger">${t('profiles.delete')}</button>${retryable ? `<button id="save-retry" class="btn">${t('result.unsaved.retry')}</button>` : ''}` : ''}${legacyHere ? `<button id="legacy-preview" class="btn">${t('profiles.legacy')}</button>` : ''}<button id="import-save-button" class="btn" ${full ? 'disabled' : ''}>${t('profiles.import')}</button><input id="import-save" type="file" accept="application/json,.json" hidden></div>
      ${current ? `<h3 class="subheading">${t('profiles.slots', { mode: modeName(commander.mode) })}</h3><p class="hint">${t('profiles.slots.hint')}</p><div class="save-files">${slots.map(slot => `<div class="save-file"><div><b>${slot.slotId === 'auto' ? t('profiles.auto') : t('profiles.slot', { n: slot.slotId.slice(-1) })}</b><small>${t(`profiles.status.${slot.status}` as never)} · ${slot.savedAt ? fmtDateTime(slot.savedAt) : t('profiles.emptyslot')}</small></div><span>${slot.slotId !== 'auto' ? `<button data-save-slot="${slot.slotId}" class="btn">${t('profiles.save')}</button>` : ''}<button data-load-slot="${slot.slotId}" class="btn" ${!slot.state ? 'disabled' : ''}>${t('profiles.load')}</button></span></div>`).join('')}</div><button id="continue-latest" class="btn primary">${t('profiles.continue')}</button>` : ''}
      <p id="profile-error" role="status">${commander.error || commander.repository?.warning ? escapeUI(errorText(commander.error || commander.repository?.warning)) : ''}</p><button data-close class="btn">${t('common.close')}</button>`);
    const attempt = async (task: () => Promise<void>) => { try { await task(); } catch(error) { console.warn('Commander storage:', error); $('profile-error').textContent = errorText(error); } };
    modal.querySelectorAll<HTMLElement>('[data-commander]').forEach(button => button.onclick = () => { const target = documents[Number(button.dataset.commander)]; if (target.commanderId !== current?.commanderId) void leaveSafely(() => { activateCommander(target); closeWithoutResume(); }); else closeWithoutResume(); });
    const typedName = () => $<HTMLInputElement>('commander-name').value.trim().slice(0, 32) || t('profiles.default.name');
    $('continue-mine')?.addEventListener('click', () => { const name = typedName(); void leaveSafely(() => creatingCommander(async () => { await migrateLegacy(name, true); if (!commander.document) throw new CommanderError(commander.error && commander.error !== 'unknown' ? commander.error : 'idb-write', commander.errorDetail || 'No Commander was activated.'); })); });
    // A fresh Commander starts at zero; with real progress on screen the player confirms first (the current file is kept either way).
    $('new-commander').onclick = () => {
      const name = typedName(), create = () => void leaveSafely(() => creatingCommander(async () => { activateCommander(await commander.create(name)); }));
      if (!hasProgress(profile)) { create(); return; }
      openModal(`<h2 id="modal-title">${t('profiles.new.confirm.title')}</h2><p>${t('profiles.new.confirm.copy')}</p><p class="hint">${current ? t('profiles.new.confirm.kept', { name: escapeUI(current.name) }) : t('profiles.new.confirm.unheld')}</p><button id="new-confirm" class="btn danger">${t('profiles.new.confirm')}</button><button id="new-cancel" class="btn primary">${t('common.cancel')}</button><p id="profile-error" role="status"></p>`);
      $('new-confirm').onclick = create;
      $('new-cancel').onclick = () => { void profilesMenu(); };
    };
    $('import-save-button').onclick = () => $<HTMLInputElement>('import-save').click();
    $('import-save').onchange = () => { const file = $<HTMLInputElement>('import-save').files?.[0]; if (file) void attempt(() => importSave(file, documents)); };
    $('rename-commander')?.addEventListener('click', () => { const name = $<HTMLInputElement>('commander-name').value.trim().slice(0,32); void attempt(async () => { if (!name) throw new CommanderError('name-required', 'Enter a name.'); if (await persist('auto', doc => { doc.name=name; })) await profilesMenu(); }); });
    $('export-commander')?.addEventListener('click',exportCommander);
    $('save-retry')?.addEventListener('click', () => { if (pendingSettlement) retryResultSave(); else void persist().then(() => profilesMenu()); });
    $('delete-commander')?.addEventListener('click', () => {
      openModal(`<h2 id="modal-title">${t('profiles.delete.title', { name: escapeUI(current!.name) })}</h2><p>${t('profiles.delete.copy', { crystal: current!.shared.bankCrystal, receipts: current!.shared.settlementReceipts.length })}</p><input id="delete-word" aria-label="DELETE"><button id="delete-confirm" class="btn danger" disabled>${t('profiles.delete.confirm')}</button><button data-close class="btn">${t('common.cancel')}</button>`);
      $('delete-word').oninput = () => { $<HTMLButtonElement>('delete-confirm').disabled = $<HTMLInputElement>('delete-word').value !== 'DELETE'; };
      // Always-on Commander: the next file takes over, or a fresh one when the last is deleted (gridbound.v3 is never overwritten with a fresh profile).
      $('delete-confirm').onclick = async () => { if (!inTown || pendingSettlement || commander.stale) return; try { await commander.flush(); await commander.repository!.remove(current!.commanderId,commander.document!.revision); commander.document=undefined; profile=createProfile(); const rest=(await commander.open()).sort((a,b)=>b.lastPlayed-a.lastPlayed); activateCommander(rest[0] ?? await commander.create(t('profiles.default.name'), createCommanderDocument(createProfile(), t('profiles.default.name')))); await profilesMenu(); } catch(error) { storageError(error); } };
    });
    if (legacyHere) $('legacy-preview').onclick = () => {
      const old = loadSave(store), raw = rawV3();
      openModal(`<h2 id="modal-title">${t('profiles.legacy.title')}</h2><p>${t('profiles.legacy.copy', { ch: old.profile.cleared.length, gold: old.profile.gold, roster: old.profile.roster.length })}</p><p>${old.warning ? escapeUI(errorText(old.warning)) : ''}</p><button id="legacy-export" class="btn" ${raw ? '' : 'disabled'}>${t('profiles.legacy.export')}</button><button id="legacy-confirm" class="btn primary" ${!raw || old.readOnly || full ? 'disabled' : ''}>${t('profiles.legacy.confirm')}</button><button data-close class="btn">${t('common.cancel')}</button>`);
      $('legacy-export').onclick = () => download(rawV3() ?? '', 'Gridbound-original-v3.json');
      $('legacy-confirm').onclick = () => { void leaveSafely(() => creatingCommander(async () => { const source=loadSave(store), raw=rawV3(); if (!raw || source.readOnly) return; backupLegacyNow(); const name=t('profiles.legacy.name'), candidate=copyLegacyToCommander(source.profile,name); candidate.legacySource=raw; activateCommander(await commander.create(name,candidate)); })); };
    };
    modal.querySelectorAll<HTMLElement>('[data-save-slot]').forEach(button => button.onclick = () => { void attempt(async () => { if (!inTown && encounter && !pendingSettlement) { const frozen=structuredClone(encounter); await persist(button.dataset.saveSlot as SlotId, doc => { const state=commander.mode==='story'?doc.story:commander.mode==='raid'?doc.raid:doc.rogue; const auto=state.slots[3]; const index=state.slots.findIndex(slot=>slot.slotId===button.dataset.saveSlot); state.slots[index]=structuredClone({...auto,slotId:button.dataset.saveSlot as SlotId}); doc.encounters ??={}; doc.encounters[commander.mode]=frozen; }); } else await persist(button.dataset.saveSlot as SlotId); sound.play('save'); await profilesMenu(); }); });
    modal.querySelectorAll<HTMLElement>('[data-load-slot]').forEach(button => button.onclick = () => {
      const slot=slots.find(item=>item.slotId===button.dataset.loadSlot)!;
      openModal(`<h2 id="modal-title">${t('profiles.preview', { slot: slot.slotId === 'auto' ? t('profiles.auto') : t('profiles.slot', { n: slot.slotId.slice(-1) }) })}</h2>${slotSummary(slot.state, slot.savedAt)}<p class="hint">${t('profiles.preview.hint')}</p><button id="load-confirm" class="btn primary">${t('profiles.load.confirm')}</button><button data-close class="btn">${t('common.cancel')}</button><p id="load-error" role="status"></p>`);
      $('load-confirm').onclick = async () => { if (!inTown || pendingSettlement) { $('load-error').textContent=t('profiles.load.blocked'); return; } try { profile=await commander.loadSlot(slot.slotId); activateCommander(commander.document!,commander.mode); closeWithoutResume(); } catch(error) { console.warn('Commander storage:', error); $('load-error').textContent=errorText(error); } };
    });
    $('continue-latest')?.addEventListener('click', () => { const savedEncounter=commander.document?.encounters?.[commander.mode]; if (!savedEncounter) { $('profile-error').textContent=t('profiles.nocheckpoint'); return; } closeWithoutResume(); void restoreEncounter(savedEncounter); });
  } catch(error) { console.error('PROFILES_MENU_ERROR:', error); openModal(`<h2 id="modal-title">${t('profiles.protected')}</h2><p>${escapeUI(errorText(error))}</p><p>${t('profiles.protected.copy')}</p>`); }
}
commander.onStatus = () => { storageStatus(); if (commander.stale && battle.status === 'fighting') battle.pause(); };
window.addEventListener('beforeunload', () => {
  delete (window as unknown as { gridbound?: unknown }).gridbound;
});
if (typeof navigator !== 'undefined' && !navigator.webdriver) {
  window.addEventListener('beforeunload', event => { if (commander.busy || commander.dirty || pendingSettlement) event.preventDefault(); });
}
 $('home').addEventListener('click', () => {
  if (!inTown) { void navigateTown('camp'); return; }
  sound.play('cursor');
  void navigateTown(townState.tab === 'camp' ? 'more' : backRoute(routeStack));
});
$('title-enter').addEventListener('click', enterEmberhollow);
$('title-profiles').addEventListener('click', () => { void profilesMenu(); });
$('title-journal').addEventListener('click', () => { void storyJournal(); });
$('title-settings').addEventListener('click', settings);
$('menu-button').addEventListener('click', () => { sound.play('confirm'); void navigateTown('more'); });
document.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-lang]');
  if (!button || button.dataset.lang === lang()) return;
  // A save in flight is waited for (flush below), not a reason to drop the click.
  if (!inTown || pendingSettlement) { storageStatus(); return; }
  const next = button.dataset.lang as Lang;
  void commander.flush().then(saved => {
    if (!saved) { storageStatus(); return; }
    const apply = () => { setLang(next); location.reload(); };
    if (commander.document && !commander.repository?.persistent) {
      const kept = legacyMirrored();
      openModal(`<h2 id="modal-title">${t('lang.session.title')}</h2><p>${t(kept ? 'lang.session.kept' : 'lang.session.copy')}</p><button id="lang-export" class="btn">${t('profiles.export')}</button><button id="lang-anyway" class="btn danger">${t(kept ? 'lang.session.anyway' : 'lang.session.confirm')}</button><button data-close class="btn primary">${t('common.cancel')}</button>`, false);
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
// PRESS START ends on the click itself, not on pointerdown: a touch's compatibility click lands where the finger was, and leaving on
// pointerdown would reveal the menu (Journal, language buttons) under the finger in time for that click to press it.
titleScreenEl.addEventListener('click', event => { if (leavePressPhase()) { event.preventDefault(); event.stopPropagation(); } }, true);
$('retreat').addEventListener('click', () => navigateTown(battle.mode === 'dungeon' ? 'dungeon' : 'camp'));
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
/** Push the effective motion setting to the arena (no flashes, shake, hit-stop or boss bob) and the CSS (body.reduced-motion). */
function applyMotion() { if (scene) scene.reducedMotion = !motionOn(); document.body.classList.toggle('reduced-motion', !motionOn()); }
applyMotion();
reduceMotionQuery.addEventListener('change', applyMotion);
/** The engine's first frame sets up WebGL and the scene (enemy art is registered on first use); it starts once the save layer has settled (or after 6 s, for a lookup that never answers) so the Commander is active before the player can act. A battle booted before that renders once the engine starts (scene calls are guarded by `initialized`). */
function startEngine() {
  if (initialized) return;
  scene.battle = battle;
  engine = new Phaser.Game({ type: Phaser.AUTO, parent: 'game-canvas', width: ARENA.width, height: ARENA.height, backgroundColor: '#0e1e19', pixelArt: true, roundPixels: true, antialias: false, scene: [scene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 3 }, audio: { noAudio: true }, render: { preserveDrawingBuffer: true }, banner: false });
  // The first frame creates the scene; a player still in town then lets the loop sleep until a battle boots.
  engine.events.once(Phaser.Core.Events.POST_RENDER, () => engineAwake(!inTown));
  initialized = true;
}
// A stalled Commander lookup (IndexedDB that never answers) must not leave progress only in RAM: after 1.5 s the raw legacy save is backed up and the live profile is written to gridbound.v3 until a Commander activates.
const saveFallback = window.setTimeout(() => { if (!commander.document && !commanderChecked) { backupLegacyNow(); commanderChecked = true; storageStatus(); } }, 1500);
// The engine waits longer: started early, its long first frame would hold back a lookup that is merely slow (a busy device).
const engineFallback = window.setTimeout(startEngine, 6000);
showTown();
if (typeof navigator !== 'undefined' && !navigator.webdriver) {
  titleScreenEl.classList.add('press-phase');
  showTitleScreen();
}
const exposeQaHook = () => { if (import.meta.env.DEV) Object.assign(window, { gridbound: {
  snapshot: () => battle.snapshot(), profile: () => structuredClone(profile),
  get battle() { return battle; }, get inTown() { return inTown; },
  get runBoons() { return runBoons; },
  setRunBoons: (b: string[]) => { runBoons = [...b]; battle.boons = [...b]; updateExpedition(); },
  step: (seconds: number) => { for (let t = 0; t < Math.min(600, Math.max(0, seconds)); t += 1 / 60) battle.tick(1 / 60); frame(1); },
  boot, scene, showTitle: showTitleScreen, hideTitle: enterEmberhollow, showBoonTray, chapterIntro, recruitScene: (id: number) => recruitScene(id, true), campScenes: () => playCampScenes(true), endingScene,
  /** Force the first-battle coach on (tips replay from the start) or off, regardless of automation and Config. */
  coach: (force = true) => { coachForced = force; if (force) resetCoach(); else if (coach.step) endCoachStep(); return { step: coach.step ?? null, done: COACH_STEPS.filter(coachDone) }; },
  get coachStep() { return coach.step ?? null; }, unlockIntro: () => unlockIntro(true),
} }); };
// Every player gets a Commander: the latest one, or one migrated from the legacy save (backed up first). The dev QA hook appears once that has settled, so tests never race the migration.
void ensureCommander().finally(() => { commanderChecked = true; storageStatus(); window.clearTimeout(saveFallback); window.clearTimeout(engineFallback); startEngine(); exposeQaHook(); if (inTown && townState.tab === 'camp') void playCampScenes(); });
