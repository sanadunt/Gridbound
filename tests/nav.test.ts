import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backAction, guardStep, type NavSnapshot } from '../src/ui/back';
import { installBackGuard, type GuardEnv } from '../src/ui/history';
import { pushRoute } from '../src/ui/route-stack';

const fight = (status: NonNullable<NavSnapshot['battle']>['status'], view: 'arena' | 'hero' | 'log' = 'arena') => ({ status, view });
const kind = (s: NavSnapshot, source: Parameters<typeof backAction>[1] = 'escape') => backAction(s, source).kind;

test('NAV §7 row 0: nothing happens while booting, navigating, in the result input lock or under a blocking dialog (which takes the focus)', () => {
  assert.equal(kind({ busy: true, route: 'party', stack: ['camp', 'party'] }), 'none');
  assert.equal(kind({ result: { locked: true }, battle: fight('victory') }), 'none');
  assert.deepEqual(backAction({ modal: { blocking: true }, result: {}, battle: fight('defeat') }, 'history'), { kind: 'none', focus: true });
  assert.deepEqual(backAction({ modal: { blocking: true, parent: true }, scene: true }, 'escape'), { kind: 'none', focus: true });
});
test('NAV §7 row 1: a story scene is skipped first (over a modal, the title or a battle)', () => {
  assert.equal(kind({ scene: true, title: true }), 'skip-scene');
  assert.equal(kind({ scene: true, battle: fight('ready') }, 'history'), 'skip-scene');
});
test('NAV §7 rows 2–3: a sub-view returns to its parent dialog, any other dismissable dialog closes', () => {
  assert.equal(kind({ modal: { parent: true }, battle: fight('paused') }), 'modal-parent');
  assert.equal(kind({ modal: {}, battle: fight('paused') }), 'close-modal');
  assert.equal(kind({ modal: {}, title: true }, 'history'), 'close-modal', 'a dialog over the title closes, the page stays');
  assert.equal(kind({ modal: {}, route: 'camp' }), 'close-modal');
});
test('NAV §7 row 4: the skill picker or move mode closes before anything in the battle', () => assert.equal(kind({ picker: true, battle: fight('fighting') }), 'close-picker'));
test('NAV §7 rows 5–6: a result closes its Details first, then Back is its Return (never Retry or Next)', () => {
  assert.equal(kind({ result: { details: true }, battle: fight('victory') }), 'close-details');
  assert.equal(kind({ result: {}, battle: fight('victory') }, 'history'), 'result-return');
});
test('NAV §7 rows 7–10: Status/Log go back to the arena, the ready window runs its Back, a fight opens the menu, an ended fight shows its result', () => {
  assert.equal(kind({ battle: fight('fighting', 'log') }), 'arena');
  assert.equal(kind({ battle: fight('ready', 'hero') }), 'arena');
  assert.equal(kind({ battle: fight('ready') }, 'history'), 'ready-back');
  assert.equal(kind({ battle: fight('fighting') }, 'history'), 'pause');
  assert.equal(kind({ battle: fight('paused') }), 'pause');
  assert.equal(kind({ battle: fight('defeat') }), 'show-result');
});
test('NAV §7 rows 11–13: a town route walks the stack, the camp shows the title, the bare title leaves only on the browser Back', () => {
  assert.deepEqual(backAction({ route: 'quests', stack: ['camp', 'more', 'quests'] }, 'button'), { kind: 'route', to: 'more' });
  assert.deepEqual(backAction({ route: 'mission', stack: ['camp', 'campaign', 'mission'] }, 'history'), { kind: 'route', to: 'campaign' });
  assert.deepEqual(backAction({ route: 'raid' }, 'escape'), { kind: 'route', to: 'camp' }, 'no stack: the camp');
  assert.equal(kind({ route: 'camp', stack: ['camp'] }), 'title');
  assert.equal(kind({ route: 'camp', stack: ['camp'] }, 'history'), 'title');
  assert.equal(kind({ title: true, route: 'camp' }, 'history'), 'leave');
  assert.equal(kind({ title: true, route: 'camp' }, 'escape'), 'none', 'Escape on the front door does nothing');
});
test('NAV §7 keys: Backspace only walks a town route back, never closes, pauses or leaves', () => {
  assert.equal(kind({ route: 'party', stack: ['camp', 'party'] }, 'backspace'), 'route');
  for (const s of [{ route: 'camp' as const }, { title: true }, { modal: {} }, { battle: fight('fighting') }, { result: {}, battle: fight('victory') }, { scene: true }]) assert.equal(kind(s, 'backspace'), 'none');
});
test('NAV §3.3 the route stack: the MENU is a hub, children return where they were opened from, cross links push', () => {
  const walk = (...tabs: Parameters<typeof pushRoute>[1][]) => tabs.reduce((stack, tab) => pushRoute(stack, tab), ['camp'] as ReturnType<typeof pushRoute>);
  const back = (stack: ReturnType<typeof pushRoute>) => (backAction({ route: stack.at(-1), stack }, 'button') as { to: Parameters<typeof pushRoute>[1] }).to;
  let stack = walk('more', 'quests'); assert.equal(back(stack), 'more'); stack = pushRoute(stack, back(stack)); assert.equal(back(stack), 'camp');
  assert.deepEqual(walk('more', 'bestiary', 'more', 'challenge-shop'), ['camp', 'more', 'challenge-shop'], 'the Bestiary is never replayed');
  assert.deepEqual(walk('campaign', 'mission', 'party', 'more'), ['camp', 'more'], 'opening the MENU never keeps what came before it');
  assert.deepEqual(walk('party'), ['camp', 'party'], 'a MENU child opened from a camp sign returns to the camp');
  assert.equal(back(walk('campaign', 'mission', 'party')), 'mission', 'Prepare party returns to the dossier');
  assert.equal(back(walk('mission')), 'camp', 'Next: CH n opens the dossier from the camp');
  assert.deepEqual(walk('campaign', 'raid'), ['camp', 'raid'], 'gate tabs replace each other');
});

/** A session history like the browser's: entries, an index, pushState truncating forward entries, back/forward firing popstate. */
function fakeHistory(activated = true) {
  const entries: unknown[] = ['previous-page', null];
  let index = 1;
  const listeners = new Map<string, ((event: Event) => void)[]>(), deferred: (() => void)[] = [];
  let left = false, active = activated;
  const fire = () => { if (index < 1) { left = true; return; } (listeners.get('popstate') ?? []).forEach(l => l({} as Event)); };
  const history = {
    get state() { return entries[index]; }, get length() { return entries.length; },
    pushState(state: unknown) { entries.splice(index + 1, entries.length, state); index++; },
    replaceState(state: unknown) { entries[index] = state; },
    back() { index--; fire(); }, forward() { if (index < entries.length - 1) { index++; fire(); } },
  };
  const env: GuardEnv = { history: history as unknown as GuardEnv['history'], addEventListener: (type, l) => listeners.set(type, [...(listeners.get(type) ?? []), l]), activated: () => active, defer: task => deferred.push(task) };
  return { env, history, entries, get index() { return index; }, get left() { return left; }, activate() { active = true; }, click() { (listeners.get('click') ?? []).forEach(l => l({} as Event)); deferred.splice(0).forEach(task => task()); } };
}
test('NAV §8 guardStep: arm only with an activation and a wanted guard, re-arm after a handled Back, leave at the bare title, Forward re-marks armed', () => {
  assert.deepEqual(guardStep(false, { type: 'sync', want: true, activated: false }), { armed: false, effect: 'none' });
  assert.deepEqual(guardStep(false, { type: 'sync', want: false, activated: true }), { armed: false, effect: 'none' });
  assert.deepEqual(guardStep(false, { type: 'sync', want: true, activated: true }), { armed: true, effect: 'push' });
  assert.deepEqual(guardStep(true, { type: 'sync', want: true, activated: true }), { armed: true, effect: 'none' }, 'never two guards');
  assert.deepEqual(guardStep(true, { type: 'pop', to: 'base' }), { armed: false, effect: 'onBack' });
  assert.deepEqual(guardStep(false, { type: 'handled', result: 'handled', want: true, activated: true }), { armed: true, effect: 'push' });
  assert.deepEqual(guardStep(false, { type: 'handled', result: 'leave', want: false, activated: true }), { armed: false, effect: 'back' });
  assert.deepEqual(guardStep(false, { type: 'pop', to: 'guard' }), { armed: true, effect: 'none' });
});
test('NAV §8 installBackGuard over a fake history: one guard, Back stays in the game, 20 Backs never grow the history, the bare title leaves', () => {
  const h = fakeHistory(false);
  let title = true, want = true, backs = 0;
  const guard = installBackGuard({ env: h.env, wantGuard: () => !title && want, onBack: () => { backs++; return title ? 'leave' : 'handled'; } });
  assert.deepEqual(h.entries.slice(1), [{ gridbound: 'base' }], 'no URL, no push at install: the base entry is replaced');
  title = false; h.click();
  assert.equal(guard.state().armed, false, 'no guard before a real user activation');
  h.activate(); h.click();
  assert.deepEqual(guard.state(), { armed: true, length: 3 }, 'one guard after the first activation');
  h.click(); h.click(); assert.equal(h.history.length, 3, 'never two guards');
  for (let i = 0; i < 20; i++) h.history.back();
  assert.deepEqual([backs, h.left, guard.state().armed, h.history.length], [20, false, true, 3], '20 Backs in the game: handled, re-armed, no growth');
  want = false; h.history.back();
  assert.equal(guard.state().armed, false, 'a Back that leads to the bare title does not re-arm');
  h.history.forward(); want = true;
  assert.deepEqual(guard.state(), { armed: true, length: 3 }, 'Forward onto the guard marks it armed');
  title = true; h.history.back();
  assert.equal(h.left, true, 'Back at the bare title leaves the page');
});
test('NAV §8 a reload while armed keeps the guard it finds (no second entry)', () => {
  const h = fakeHistory();
  h.entries[1] = { gridbound: 'base' }; h.history.pushState({ gridbound: 'guard' });
  const guard = installBackGuard({ env: h.env, wantGuard: () => true, onBack: () => 'handled' });
  assert.deepEqual(guard.state(), { armed: true, length: 3 });
  h.click(); assert.equal(h.history.length, 3);
});
