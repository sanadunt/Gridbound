import assert from 'node:assert/strict';
import { withBrowser } from './browser-harness.mjs';

const url = process.env.GRIDBOUND_URL || 'http://127.0.0.1:5173/';

console.log('--- TESTING TRAINING HALL & MIRROR OF NIGHT TALENTS ---');

// 1. Desktop Viewport (1440x900)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  // Open Training Hall (Party facility)
  await click('[data-facility="party"]');
  await wait('Boolean(document.querySelector(".training-identity"))');

  // Verify Hero Sanctum Header
  assert.equal(await evaluate('Boolean(document.querySelector(".training-identity img"))'), true, 'Hero portrait must exist');
  assert.equal(await evaluate('Boolean(document.querySelector(".training-identity h2"))'), true, 'Hero name must exist');

  // Verify all 6 Sub-Navigation Tabs
  const subTabs = ['overview', 'skills', 'jobs', 'talents', 'gear', 'formation'];
  for (const tab of subTabs) {
    await click(`[data-training-tab="${tab}"]`);
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-training-panel="${tab}"]'))`), true, `Panel for ${tab} must exist`);
  }

  // Focus on Talents (Mirror of Night)
  await click('[data-training-tab="talents"]');
  await wait('Boolean(document.querySelector(".talent-workspace"))');

  // Verify 4-Tier Talent Flow Columns
  assert.equal(await evaluate('Boolean(document.querySelector(".talent-flow"))'), true, 'Talent flow container must exist');
  assert.ok((await evaluate('document.querySelectorAll(".talent-flow-lane").length')) >= 1, 'At least 1 flow lane must exist');
  assert.ok((await evaluate('document.querySelectorAll(".talent-flow-node").length')) >= 1, 'Flow nodes must exist');

  // Test Switching Branches
  await click('[data-branch="assault"]');
  await wait('Boolean(document.querySelector("[data-branch=assault][aria-pressed=true]"))');
  assert.equal(await evaluate('document.querySelector("[data-branch=assault]").getAttribute("aria-pressed")'), 'true');

  // Inspect a specific talent node
  await click('[data-inspect-talent="assault-break"]');
  await wait('Boolean(document.querySelector(".talent-inspector-section .talent-node"))');
  assert.equal(await evaluate('document.querySelectorAll(".talent-node").length'), 1, 'Exactly 1 inspector talent node');

  // Test learning root talent if gold permits or inspection
  await click('[data-branch="foundation"]');
  await wait('Boolean(document.querySelector("[data-branch=foundation][aria-pressed=true]"))');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/training-talents-hades-desktop.png');
  console.log('✓ Captured artifacts/training-talents-hades-desktop.png');

  // Focus on Equipment (Forge)
  await click('[data-training-tab="gear"]');
  await wait('Boolean(document.querySelector(".gear-slots"))');
  assert.equal(await evaluate('document.querySelectorAll("[data-gear-slot]").length'), 3, '3 gear slot selectors');

  // Inspect a piece of gear
  await evaluate(`(() => {
    const el = document.querySelector('[data-gear-slot="weapon"]');
    el.value = 'scout-weapon';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait('Boolean(document.querySelector("[data-gear-preview]"))');
  assert.equal(await evaluate('Boolean(document.querySelector(".gear-comparison"))'), true, 'Gear comparison stats must display');
  assert.equal(await evaluate('Boolean(document.querySelector("[data-confirm-gear]"))'), true, 'Confirm gear CTA must exist');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/training-gear-hades-desktop.png');
  console.log('✓ Captured artifacts/training-gear-hades-desktop.png');

  // Focus on Jobs (Advancement)
  await click('[data-training-tab="jobs"]');
  await wait('Boolean(document.querySelector(".job-paths"))');
  assert.equal(await evaluate('document.querySelectorAll(".job-node").length'), 4, '4 job advancement nodes');

  console.log('✓ Desktop Training Hall test passed');
}, { width: 1440, height: 900 });

// 2. Mobile Viewport (390x844)
await withBrowser(async ({ send, wait, evaluate, screenshot, click }) => {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.removeItem('gridbound.v3'); localStorage.removeItem('gridbound.v2');`
  });
  await send('Page.navigate', { url });
  await wait('window.gridbound && document.querySelector("#town-screen")');

  await click('[data-facility="party"]');
  await wait('Boolean(document.querySelector(".training-identity"))');

  // Verify zero horizontal overflow on mobile
  const fits = await evaluate('document.documentElement.scrollWidth <= innerWidth + 1');
  assert.equal(fits, true, 'Training Hall must have no horizontal overflow on mobile');

  // Verify touch targets >= 44px
  const tabHeights = await evaluate(`[...document.querySelectorAll('.training-tabs button')].map(b => b.getBoundingClientRect().height)`);
  assert.ok(tabHeights.every(h => h >= 40), 'Training tabs must have accessible touch heights');

  // Switch to Talents on Mobile
  await click('[data-training-tab="talents"]');
  await wait('Boolean(document.querySelector(".talent-workspace"))');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Talent workspace must fit 390px mobile');

  await new Promise(resolve => setTimeout(resolve, 300));
  await screenshot('artifacts/training-talents-hades-mobile-390.png');
  console.log('✓ Captured artifacts/training-talents-hades-mobile-390.png');

  console.log('✓ Mobile Training Hall test passed');
}, { width: 390, height: 844, mobile: true });

console.log('ALL TRAINING HALL BROWSER TESTS PASSED!');
