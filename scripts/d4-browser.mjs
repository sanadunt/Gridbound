import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { withBrowser } from './browser-harness.mjs';

const port = 5185;
const url = `http://127.0.0.1:${port}/`;
const artifactPath = join(process.cwd(), 'artifacts', 'd4-browser-report.json');
const basicJobs = ['warrior', 'rogue', 'archer', 'healer', 'wizard'];
const freshBaseline = {
  storyIds: [0, 4, 3],
  storyNames: ['Aldric', 'Lyra', 'Rowan'],
  storyClasses: ['warrior', 'healer', 'archer'],
};
const duplicateSelection = ['warrior', 'warrior', 'archer'];
const defaultSelection = ['warrior', 'healer', 'archer'];

const report = {
  test: 'D4 focused browser smoke',
  url,
  server: {
    command: [
      process.execPath,
      'node_modules/vite/bin/vite.js',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    started: false,
    stopped: false,
    output: '',
  },
  browser: {
    isolated: true,
    localStorageSeeded: false,
  },
  checks: [],
  actions: [],
  blockers: [],
  consoleErrors: [],
};

let server;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const errorText = error => error instanceof Error ? error.stack || error.message : String(error);
const jsonText = value => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
const safeValue = value => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
};
const requireEqual = (actual, expected, label) => {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label}: expected ${jsonText(expected)}; actual ${jsonText(actual)}`);
  }
};
const requireTrue = (value, label) => {
  if (!value) throw new Error(label);
};

function addCheck(name, status, details = undefined, error = undefined) {
  const entry = { name, status };
  if (details !== undefined) entry.details = safeValue(details);
  if (error !== undefined) entry.error = errorText(error);
  report.checks.push(entry);
}

async function check(name, fn) {
  try {
    const details = await fn();
    addCheck(name, 'PASS', details);
    return true;
  } catch (error) {
    addCheck(name, 'FAIL', undefined, error);
    return false;
  }
}

async function action(name, fn) {
  try {
    const details = await fn();
    report.actions.push({ name, status: 'PASS', ...(details === undefined ? {} : { details: safeValue(details) }) });
    return true;
  } catch (error) {
    report.actions.push({ name, status: 'FAIL', error: errorText(error) });
    return false;
  }
}

async function startServer() {
  let output = '';
  let launchError;
  server = spawn(process.execPath, report.server.command.slice(1), {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.setEncoding('utf8');
  server.stderr.setEncoding('utf8');
  server.stdout.on('data', data => { output += data; report.server.output = output; });
  server.stderr.on('data', data => { output += data; report.server.output = output; });
  server.on('error', error => { launchError = error; });

  const deadline = Date.now() + 15000;
  while (!output.includes(url)) {
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error(`Vite exited before readiness: ${output}`);
    if (Date.now() > deadline) throw new Error(`Vite readiness timeout: ${output}`);
    await delay(50);
  }
  const response = await fetch(url);
  if (response.status !== 200) throw new Error(`Vite returned HTTP ${response.status}`);
  report.server.started = true;
}

async function stopServer() {
  if (!server || server.exitCode !== null) {
    report.server.stopped = Boolean(server && server.exitCode !== null);
    return;
  }
  const exited = once(server, 'exit');
  server.kill('SIGTERM');
  await Promise.race([exited, delay(3000)]);
  if (server.exitCode === null) {
    const hardExited = once(server, 'exit');
    server.kill('SIGKILL');
    await Promise.race([hardExited, delay(3000)]);
  }
  report.server.stopped = server.exitCode !== null;
}

const townReady = () => 'window.gridbound?.inTown === true && Boolean(document.querySelector("#town-screen:not([hidden])"))';
const battleReady = mode => `window.gridbound?.inTown === false && window.gridbound?.battle?.mode === ${JSON.stringify(mode)} && Boolean(document.querySelector("#battle-screen:not([hidden])"))`;
const selectValues = () => evaluate => evaluate('([...document.querySelectorAll("[data-rogue-slot]")].sort((a,b)=>Number(a.dataset.rogueSlot)-Number(b.dataset.rogueSlot)).map(el=>el.value))');

async function runBrowserScenario() {
  await withBrowser(async context => {
    const { send, evaluate, wait, click, errors } = context;

    try {
      const opened = await action('open fresh town in isolated browser', async () => {
        await send('Page.navigate', { url });
        await wait(townReady(), 15000);
        return await evaluate('({ origin: location.origin, inTown: window.gridbound.inTown })');
      });
      if (!opened) return;

      const initialProfile = await evaluate('window.gridbound.profile()');
      await check('fresh profile has the expected three-hero Story baseline', async () => {
        requireEqual(initialProfile.roster, freshBaseline.storyIds, 'profile roster');
        requireEqual(initialProfile.storyActive, freshBaseline.storyIds, 'profile Story party');
        requireEqual(initialProfile.cleared, [], 'profile cleared chapters');
        return {
          roster: initialProfile.roster,
          storyActive: initialProfile.storyActive,
          cleared: initialProfile.cleared,
        };
      });

      const leaveBattle = async () => {
        await click('#battle-home');
        await wait(townReady(), 10000);
      };
      const battleSummary = () => evaluate(`(() => {
        const b = window.gridbound.battle;
        return {
          mode: b?.mode ?? null,
          status: b?.status ?? null,
          heroCount: b?.heroes?.length ?? 0,
          ids: b?.heroes?.map(h => h.id) ?? [],
          names: b?.heroes?.map(h => h.name) ?? [],
          classIds: b?.heroes?.map(h => h.classId) ?? [],
          jobs: b?.heroes?.map(h => h.job ?? null) ?? [],
          levels: b?.heroes?.map(h => h.level) ?? [],
          skills: b?.heroes?.map(h => [...h.skills]) ?? [],
          talents: b?.heroes?.map(h => [...h.talents]) ?? [],
          gearKeys: b?.heroes?.map(h => Object.keys(h.gear ?? {})) ?? [],
          rogueBuild: b?.rogueBuild ? {
            recruits: b.rogueBuild.recruits.map(r => ({ classId: r.classId, job: r.job ?? null })),
            points: b.rogueBuild.points,
            clearedRooms: [...b.rogueBuild.clearedRooms],
          } : null,
          hasUpgradeMethod: typeof b?.upgradeRogue === 'function',
        };
      })()`);

      const storyStarted = await action('depart Story baseline', async () => {
        await click('[data-depart="adventure"]');
        await wait(battleReady('adventure'), 10000);
      });
      if (storyStarted) {
        await check('Story still uses the expected persistent baseline', async () => {
          const actual = await battleSummary();
          requireEqual(actual.mode, 'adventure', 'Story mode');
          requireEqual(actual.heroCount, 3, 'Story hero count');
          requireEqual(actual.ids, freshBaseline.storyIds, 'Story hero IDs');
          requireEqual(actual.names, freshBaseline.storyNames, 'Story hero names');
          requireEqual(actual.classIds, freshBaseline.storyClasses, 'Story class IDs');
          requireEqual(actual.jobs, [null, null, null], 'Story temporary jobs');
          return actual;
        });
        await action('leave Story baseline', leaveBattle);
      }

      const raidOpened = await action('open Raid baseline', async () => {
        await click('[data-view="raid"]');
        await wait('Boolean(document.querySelector("[data-depart=raid]"))', 10000);
      });
      const raidStarted = raidOpened && await action('depart Raid baseline', async () => {
        await click('[data-depart="raid"]');
        await wait(battleReady('raid'), 10000);
      });
      if (raidStarted) {
        await check('Raid still uses the expected persistent baseline', async () => {
          const actual = await battleSummary();
          requireEqual(actual.mode, 'raid', 'Raid mode');
          requireEqual(actual.heroCount, 3, 'Raid hero count');
          requireEqual(actual.ids, freshBaseline.storyIds, 'Raid hero IDs');
          requireEqual(actual.names, freshBaseline.storyNames, 'Raid hero names');
          requireEqual(actual.classIds, freshBaseline.storyClasses, 'Raid class IDs');
          requireEqual(actual.jobs, [null, null, null], 'Raid temporary jobs');
          return actual;
        });
        await action('leave Raid baseline', leaveBattle);
      }

      const rogueOpened = await action('open Roguelike setup', async () => {
        await click('[data-view="endless"]');
        await wait('document.querySelectorAll("[data-rogue-slot]").length === 3', 10000);
      });
      if (!rogueOpened) return;

      await check('Roguelike page exposes exactly three basic-job selectors', async () => {
        const actual = await evaluate(`(() => {
          const selectors = [...document.querySelectorAll('[data-rogue-slot]')].sort((a,b) => Number(a.dataset.rogueSlot) - Number(b.dataset.rogueSlot));
          return {
            allSelectCount: document.querySelectorAll('select').length,
            rogueSelectCount: selectors.length,
            slots: selectors.map(el => Number(el.dataset.rogueSlot)),
            values: selectors.map(el => el.value),
            options: selectors.map(el => [...el.options].map(option => option.value)),
          };
        })()`);
        requireEqual(actual.allSelectCount, 3, 'all setup select count');
        requireEqual(actual.rogueSelectCount, 3, 'Roguelike selector count');
        requireEqual(actual.slots, [0, 1, 2], 'Roguelike selector slots');
        requireTrue(actual.options.every(options => isDeepStrictEqual(options, basicJobs)), 'every selector must expose exactly the five basic jobs');
        return actual;
      });

      await action('select a duplicate basic Roguelike job', async () => {
        for (let index = 0; index < duplicateSelection.length; index += 1) {
          await evaluate(`(() => {
            const el = document.querySelector('[data-rogue-slot="${index}"]');
            if (!el) throw new Error('missing Roguelike selector ${index}');
            el.value = ${JSON.stringify(duplicateSelection[index])};
            el.dispatchEvent(new Event('change', { bubbles: true }));
          })()`);
        }
        await wait(`JSON.stringify([...document.querySelectorAll('[data-rogue-slot]')].sort((a,b)=>Number(a.dataset.rogueSlot)-Number(b.dataset.rogueSlot)).map(el=>el.value)) === ${JSON.stringify(JSON.stringify(duplicateSelection))}`, 10000);
      });
      await check('duplicate basic job selection is accepted', async () => {
        const values = await selectValues()(evaluate);
        requireEqual(values, duplicateSelection, 'selected duplicate jobs');
        const departure = await evaluate('document.querySelector("[data-depart=endless]")?.disabled ?? true');
        requireEqual(departure, false, 'Roguelike departure control');
        return { values, departureDisabled: departure };
      });

      const storyProfileBeforeRogue = await evaluate('window.gridbound.profile()');
      const rogueStarted = await action('depart selected Roguelike build', async () => {
        await click('[data-depart="endless"]');
        await wait(battleReady('endless'), 10000);
      });
      if (!rogueStarted) return;

      await check('Roguelike departure creates exactly three Battle heroes', async () => {
        const actual = await battleSummary();
        requireEqual(actual.mode, 'endless', 'Roguelike mode');
        requireEqual(actual.heroCount, 3, 'Roguelike hero count');
        return { heroCount: actual.heroCount, names: actual.names, classIds: actual.classIds };
      });

      await check('Roguelike departure carries the selected temporary build', async () => {
        const actual = await battleSummary();
        const expected = {
          names: ['Recruit 1', 'Recruit 2', 'Recruit 3'],
          classIds: duplicateSelection,
          jobs: [null, null, null],
          levels: [1, 1, 1],
          skills: [[0, 1], [0, 1], [0, 1]],
          talents: [[], [], []],
          gearKeys: [[], [], []],
          rogueBuild: {
            recruits: duplicateSelection.map(classId => ({ classId, job: null })),
            points: 0,
            clearedRooms: [],
          },
        };
        const projection = {
          names: actual.names,
          classIds: actual.classIds,
          jobs: actual.jobs,
          levels: actual.levels,
          skills: actual.skills,
          talents: actual.talents,
          gearKeys: actual.gearKeys,
          rogueBuild: actual.rogueBuild,
        };
        requireEqual(projection, expected, 'temporary Roguelike Battle build');
        return projection;
      });

      const promotionEvidence = await evaluate(`(() => {
        const b = window.gridbound.battle;
        const controls = [...document.querySelectorAll('button')]
          .filter(button => !button.hasAttribute('data-run-buy'))
          .filter(button => {
            const text = (button.textContent ?? '').toLowerCase();
            return button.hasAttribute('data-rogue-upgrade') || button.hasAttribute('data-upgrade-rogue') || button.hasAttribute('data-job-upgrade') || /promot|promosi|job advancement/.test(text);
          })
          .map(button => ({ text: button.textContent?.trim() ?? '', disabled: button.disabled }));
        return {
          mode: b?.mode ?? null,
          status: b?.status ?? null,
          hasRogueBuild: Boolean(b?.rogueBuild),
          rogueBuild: b?.rogueBuild ? {
            recruits: b.rogueBuild.recruits.map(r => ({ classId: r.classId, job: r.job ?? null })),
            points: b.rogueBuild.points,
            clearedRooms: [...b.rogueBuild.clearedRooms],
          } : null,
          upgradeRogueType: typeof b?.upgradeRogue,
          promotionControls: controls,
        };
      })()`);

      if (promotionEvidence.hasRogueBuild && promotionEvidence.upgradeRogueType === 'function') {
        addCheck('in-run Roguelike promotion/upgrade is available', 'PASS', {
          runtime: promotionEvidence,
          note: 'The Battle runtime exposes a valid temporary build and upgradeRogue().',
        });
      } else {
        const exactRuntimeBlocker = {
          battleMode: promotionEvidence.mode,
          battleStatus: promotionEvidence.status,
          battleRogueBuild: promotionEvidence.rogueBuild,
          upgradeRogueMethod: promotionEvidence.upgradeRogueType,
          promotionControls: promotionEvidence.promotionControls,
          diagnosis: promotionEvidence.hasRogueBuild
            ? 'The Battle has no callable upgradeRogue() runtime method.'
            : 'The endless departure did not attach a RogueBuild; the run is using the persistent roster path, so there is no temporary build to promote.',
        };
        report.blockers.push({ name: 'in-run Roguelike promotion/upgrade', exactRuntimeBlocker });
        addCheck('in-run Roguelike promotion/upgrade is available or its exact runtime blocker is reported', 'BLOCKED', exactRuntimeBlocker);
      }

      const leftFirstRogue = await action('leave Roguelike and reset its disposable setup', leaveBattle);
      if (leftFirstRogue) {
        await check('leaving Roguelike does not mutate the Story profile', async () => {
          const after = await evaluate('window.gridbound.profile()');
          requireEqual(after, storyProfileBeforeRogue, 'persistent profile after Roguelike leave');
          return { unchanged: true, storyActive: after.storyActive, roster: after.roster };
        });

        const resetSetup = await action('reopen Roguelike after leave', async () => {
          await click('[data-view="endless"]');
          await wait('document.querySelectorAll("[data-rogue-slot]").length === 3', 10000);
        });
        if (resetSetup) {
          await check('leaving Roguelike resets the disposable setup to defaults', async () => {
            const values = await selectValues()(evaluate);
            requireEqual(values, defaultSelection, 'fresh Roguelike setup after leave');
            return { values };
          });

          const secondRun = await action('start and immediately leave a reset Roguelike run', async () => {
            await click('[data-depart="endless"]');
            await wait(battleReady('endless'), 10000);
            await click('#battle-home');
            await wait(townReady(), 10000);
          });
          if (secondRun) {
            await check('resetting Roguelike does not mutate the Story profile', async () => {
              const afterReset = await evaluate('window.gridbound.profile()');
              requireEqual(afterReset, storyProfileBeforeRogue, 'persistent profile after Roguelike reset');
              return { unchanged: true, storyActive: afterReset.storyActive, roster: afterReset.roster };
            });
          }
        }
      }

      const postRogueStory = await action('recheck Story after Roguelike leave/reset', async () => {
        await click('[data-view="campaign"]');
        await wait('Boolean(document.querySelector("[data-depart=adventure]"))', 10000);
        await click('[data-depart="adventure"]');
        await wait(battleReady('adventure'), 10000);
      });
      if (postRogueStory) {
        await check('Story baseline remains intact after Roguelike reset', async () => {
          const actual = await battleSummary();
          requireEqual(actual.ids, freshBaseline.storyIds, 'post-Roguelike Story hero IDs');
          requireEqual(actual.names, freshBaseline.storyNames, 'post-Roguelike Story hero names');
          requireEqual(actual.classIds, freshBaseline.storyClasses, 'post-Roguelike Story class IDs');
          requireEqual(actual.jobs, [null, null, null], 'post-Roguelike Story jobs');
          return actual;
        });
        await action('leave post-Roguelike Story check', leaveBattle);
      }

      const postRogueRaid = await action('recheck Raid after Roguelike leave/reset', async () => {
        await click('[data-view="raid"]');
        await wait('Boolean(document.querySelector("[data-depart=raid]"))', 10000);
        await click('[data-depart="raid"]');
        await wait(battleReady('raid'), 10000);
      });
      if (postRogueRaid) {
        await check('Raid baseline remains intact after Roguelike reset', async () => {
          const actual = await battleSummary();
          requireEqual(actual.ids, freshBaseline.storyIds, 'post-Roguelike Raid hero IDs');
          requireEqual(actual.names, freshBaseline.storyNames, 'post-Roguelike Raid hero names');
          requireEqual(actual.classIds, freshBaseline.storyClasses, 'post-Roguelike Raid class IDs');
          requireEqual(actual.jobs, [null, null, null], 'post-Roguelike Raid jobs');
          return actual;
        });
        await action('leave post-Roguelike Raid check', leaveBattle);
      }
    } finally {
      report.consoleErrors = errors.map(safeValue);
      addCheck('no console errors', report.consoleErrors.length === 0 ? 'PASS' : 'FAIL', report.consoleErrors.length === 0 ? [] : report.consoleErrors, report.consoleErrors.length === 0 ? undefined : new Error(`${report.consoleErrors.length} console error(s) captured`));
    }
  });
}

try {
  await startServer();
  await runBrowserScenario();
} catch (error) {
  report.fatal = errorText(error);
} finally {
  await stopServer();
  await mkdir(join(process.cwd(), 'artifacts'), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
}

const failedChecks = report.checks.filter(checkEntry => checkEntry.status === 'FAIL').length;
const failedActions = report.actions.filter(actionEntry => actionEntry.status === 'FAIL').length;
const hasFatal = Boolean(report.fatal);
report.status = hasFatal || failedChecks > 0 || failedActions > 0 ? 'FAIL' : report.blockers.length > 0 ? 'BLOCKED' : 'PASS';

console.log(JSON.stringify(report, null, 2));
console.log(`${report.status} D4 browser smoke; artifact: ${artifactPath}`);
if (report.status !== 'PASS') process.exitCode = 1;
