import { guardStep } from './back';

/**
 * The browser/phone Back inside the game (navigation contract §8). The page keeps one extra session-history entry, the guard
 * (`{ gridbound: 'guard' }` above `{ gridbound: 'base' }`); the Back gesture pops it, the game runs one Back step and pushes the guard
 * again. No URL is ever passed (the address, the itch.io subpath and relative assets stay as they are) and nothing touches `top`/`parent`.
 * At the bare title screen the step answers 'leave' and the page goes back once more, so the browser leaves the game as it always did.
 */
type HistoryLike = Pick<History, 'state' | 'length' | 'pushState' | 'replaceState' | 'back'>;
export type GuardEnv = { history: HistoryLike; addEventListener: (type: string, listener: (event: Event) => void, capture?: boolean) => void; activated: () => boolean; defer: (task: () => void) => void };
/** `sync()` re-checks the guard; main.ts also calls it whenever the title, the modal or a story scene changes (a layer that appears without a tap). */
export type BackGuard = { sync(): void; state(): { armed: boolean; length: number } };
const FIELD = 'gridbound';
const browserEnv = (): GuardEnv => ({
  history: window.history, addEventListener: (type, listener, capture) => window.addEventListener(type, listener, capture),
  // Browsers skip an entry pushed before the user interacted with the page: arm only after a real activation (old browsers: assume one).
  activated: () => (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true,
  defer: task => { window.setTimeout(task, 0); },
});
/** `onBack` runs the game's Back step ('leave' only at the bare title screen); `wantGuard` is false only on the bare title screen. */
export function installBackGuard({ onBack, wantGuard, env = browserEnv() }: { onBack: () => 'handled' | 'leave'; wantGuard: () => boolean; env?: GuardEnv }): BackGuard {
  const { history } = env;
  const read = () => { try { return (history.state as Record<string, unknown> | null)?.[FIELD]; } catch { return undefined; } };
  // A reload or a language switch while armed lands on the guard entry: it is still there, so it counts.
  let armed = read() === 'guard';
  if (!armed) try { history.replaceState({ [FIELD]: 'base' }, ''); } catch { /* a sandbox without history: Back stays the browser's */ }
  const apply = (next: ReturnType<typeof guardStep>) => {
    armed = next.armed;
    try {
      if (next.effect === 'push') history.pushState({ [FIELD]: 'guard' }, '');
      else if (next.effect === 'back') history.back();
    } catch { armed = false; }
  };
  const sync = () => apply(guardStep(armed, { type: 'sync', want: wantGuard(), activated: env.activated() }));
  env.addEventListener('popstate', () => {
    const popped = guardStep(armed, { type: 'pop', to: read() === 'guard' ? 'guard' : 'base' });
    armed = popped.armed;
    if (popped.effect !== 'onBack') return;
    apply(guardStep(armed, { type: 'handled', result: onBack(), want: wantGuard(), activated: env.activated() }));
  });
  // A click or key may change the top layer (a dialog over the title, the title left) or be the first activation: check once it has acted.
  // Touch activation lands on pointerup/click, never on pointerdown.
  for (const type of ['click', 'keydown']) env.addEventListener(type, () => env.defer(sync), true);
  return { sync, state: () => ({ armed, length: history.length }) };
}
