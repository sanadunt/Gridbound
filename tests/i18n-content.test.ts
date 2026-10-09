import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_TEXT } from '../src/i18n/content-text';
import { localizeContent, restoreContent, resolveContentKey, contentText, contentLang, localizedRaidModifier, eventText } from '../src/i18n/content';
import { KITS, UPGRADES } from '../src/game/content';
import { CHARACTERS } from '../src/game/characters';
import { JOBS, GEAR, GEAR_SETS } from '../src/game/jobs';
import { TALENTS } from '../src/game/talents';
import { QUESTS } from '../src/game/quests';
import { ENEMIES, CAMPAIGN, BOONS } from '../src/game/world';
import { STORY_CHOICES, epilogue } from '../src/game/narrative';
import { D8_ADVANCED_PATHS, D8_THIRD_PATHS, D8_ULTRAS } from '../src/game/d8-content';
import { CHALLENGE_SHOP, BANK_SHOP, RAID_MODIFIERS } from '../src/economy/challenge';
import { Battle } from '../src/game/simulation';

const keys = Object.keys(CONTENT_TEXT);
const read = (key: string) => { const slot = resolveContentKey(key)!; return slot.owner[slot.prop] as string; };
const isFrozen = (key: string) => Object.isFrozen(resolveContentKey(key)!.owner);
const contentJson = () => JSON.stringify({ KITS, UPGRADES, CHARACTERS, JOBS, GEAR, GEAR_SETS, TALENTS, QUESTS, ENEMIES, CAMPAIGN, BOONS, STORY_CHOICES, D8_ADVANCED_PATHS, D8_THIRD_PATHS, D8_ULTRAS, CHALLENGE_SHOP, BANK_SHOP, RAID_MODIFIERS });

// Captured before any localisation runs in this process.
const SOURCE = new Map(keys.map(key => [key, resolveContentKey(key) ? read(key) : undefined]));
const SOURCE_JSON = contentJson();
after(() => restoreContent());

test('every CONTENT_TEXT key resolves to a string field with both languages', () => {
  assert.ok(keys.length > 500, `expected a full table, got ${keys.length}`);
  for (const key of keys) {
    const slot = resolveContentKey(key);
    assert.ok(slot, `unresolved key ${key}`);
    assert.equal(typeof slot.owner[slot.prop], 'string', key);
    const { en, id } = CONTENT_TEXT[key];
    assert.ok(typeof en === 'string' && en.trim().length > 0, `empty en for ${key}`);
    assert.ok(typeof id === 'string' && id.trim().length > 0, `empty id for ${key}`);
    assert.notEqual(en, id, `identical en/id for ${key} (omit unchanged fields)`);
  }
  assert.equal(resolveContentKey('enemy.wolf.nope'), undefined);
  assert.equal(resolveContentKey('quest.no-such-quest.story'), undefined);
  assert.equal(resolveContentKey('enemy.wolf.hp'), undefined, 'numbers are not text fields');
});

test('localizeContent is idempotent and switching back and forth is lossless', () => {
  localizeContent('id');
  const once = contentJson();
  localizeContent('id');
  assert.equal(contentJson(), once);
  localizeContent('en');
  localizeContent('id');
  assert.equal(contentJson(), once);
  assert.equal(contentLang(), 'id');
  for (const key of keys) if (!isFrozen(key)) assert.equal(read(key), CONTENT_TEXT[key].id, key);
});

test('localizeContent("en") restores original English fields exactly', () => {
  localizeContent('id');
  localizeContent('en');
  let english = 0;
  for (const key of keys) {
    if (isFrozen(key)) continue;
    assert.equal(read(key), CONTENT_TEXT[key].en, key);
    if (SOURCE.get(key) === CONTENT_TEXT[key].en) { english++; assert.equal(read(key), SOURCE.get(key), key); }
  }
  assert.ok(english > 100, `expected many English-original fields, got ${english}`);
});

test('restoreContent puts the source text back byte-for-byte', () => {
  localizeContent('id');
  localizeContent('en');
  restoreContent();
  assert.equal(contentJson(), SOURCE_JSON);
  assert.equal(contentLang(), undefined);
});

test('Indonesian prose becomes English under "en"', () => {
  localizeContent('en');
  assert.equal(KITS.warrior.role, 'Frontline guardian');
  assert.match(KITS.wizard.skills[2].description, /^A seal that detonates after 1\.5 seconds/);
  assert.match(JOBS.paladin.skill.description, /^75 shield for the whole party/);
  assert.match(CAMPAIGN[0].intro, /^Sable should have been home before the dusk bell\./);
  assert.match(CAMPAIGN[4].intro, /^The morning after Vharok awoke/);
  assert.equal(CAMPAIGN[4].intro.split('\n\n').length, 3, 'paragraph breaks survive');
  assert.equal(CAMPAIGN[4].stages[0].beat, (CAMPAIGN[4] as unknown as { beats: string[] }).beats[0]);
  assert.match(ENEMIES.wolf.description, /^A hunter of wounds\./);
  assert.match(ENEMIES['wolf-ash'].description, /Ashbound variant: the intent order shifts/);
  assert.equal(ENEMIES['wolf-ash'].counter, ENEMIES.wolf.counter);
  assert.equal(CHARACTERS[0].bio.startsWith('Aldric remembers every way'), true);
  assert.equal(STORY_CHOICES[0].title, 'A bell for the school');
  assert.equal(QUESTS.find(q => q.id === 'hunt-wolf')!.name, 'Tracks Beside the Cradle');
  assert.match(GEAR.find(g => g.id === 'scout-weapon')!.description, /Ashwood Scout: 2 pieces: tap \+0\.08s/);
  assert.match(TALENTS.find(t => t.id === 'focus')!.description, /cooldowns run 10% faster/);
  assert.match(BOONS[0].description, /^Every 3 effective taps/);
  // No Indonesian function words should survive in any English field.
  const indonesian = /\b(yang|dan|untuk|dengan|tidak|seluruh|setiap|dari|ke|di|saat|bukan|lalu|tetapi)\b/;
  for (const key of keys) assert.doesNotMatch(CONTENT_TEXT[key].en, indonesian, key);
});

test('Indonesian mode translates English-only fields while keeping names', () => {
  localizeContent('id');
  assert.equal(QUESTS.find(q => q.id === 'hunt-wolf')!.name, 'Jejak di Samping Buaian');
  assert.equal(QUESTS.find(q => q.id === 'hunt-wolf')!.giver, 'PENGINTAI EMBERHOLLOW');
  assert.equal(ENEMIES.wolf.title, 'SERIGALA BARA');
  assert.equal(ENEMIES.wolf.name, 'Ashfang');
  assert.equal(ENEMIES['wolf-ash'].title, 'ASHBOUND · SERIGALA BARA');
  assert.equal(CAMPAIGN[0].subtitle, 'Telusuri jejak para pengintai yang hilang');
  assert.equal(CAMPAIGN[0].name, 'Ashwood Trail');
  assert.equal(CAMPAIGN[4].stages[0].name, 'Penyeberangan · The Empty Census');
  assert.equal(KITS.warrior.skills[0].name, 'Cleave');
  assert.equal(CHALLENGE_SHOP[0].description, 'Setiap hero memulai ruangan ini dengan barrier sebesar 30% HP maksimum.');
  assert.equal(CAMPAIGN[0].intro, SOURCE.get('campaign.ashwood.intro'), 'Indonesian source prose is kept verbatim');
});

test('frozen raid modifiers are served through contentText', () => {
  localizeContent('en');
  assert.ok(Object.isFrozen(RAID_MODIFIERS[1]));
  assert.equal(RAID_MODIFIERS[1].description, SOURCE.get('raidModifier.RM02.description'));
  assert.equal(localizedRaidModifier(RAID_MODIFIERS[1], 'en').description, 'Potion limit −1; solo runs still get at least 1.');
  assert.equal(localizedRaidModifier(RAID_MODIFIERS[1], 'en').name, 'Long Night');
  assert.equal(contentText('raidModifier.RM07.description', 'id'), 'Boss HP +20%, windup +10%.');
  assert.equal(contentText('raidModifier.RM01.description', 'en'), 'Effective barrier −25%.');
});

test('eventText maps simulation strings in both directions', () => {
  assert.equal(eventText('HUNT THE WOUNDED', 'id'), 'BURU YANG TERLUKA');
  assert.equal(eventText('BURU YANG TERLUKA', 'en'), 'HUNT THE WOUNDED');
  assert.equal(eventText('HUNT THE WOUNDED', 'en'), 'HUNT THE WOUNDED');
  assert.equal(eventText('EMERALD CATACLYSM', 'id'), 'EMERALD CATACLYSM');
  assert.match(eventText('GROUND: pindah ke lane lain. Lokasi impact tidak mengikuti hero.', 'en'), /^GROUND: move to another lane\./);
  assert.equal(eventText('ASHFANG · PHASE 2', 'id'), 'ASHFANG · FASE 2');
  assert.equal(eventText('ASHFANG · FASE 3', 'en'), 'ASHFANG · PHASE 3');
  assert.equal(eventText('THE SCENT OF CINDERS', 'id'), 'AROMA BARA');
  assert.equal(eventText('AROMA BARA', 'en'), 'THE SCENT OF CINDERS');
  assert.equal(eventText('CROSSING · THE EMPTY CENSUS', 'id'), 'PENYEBERANGAN · THE EMPTY CENSUS');
  assert.equal(eventText('DESCENT 4', 'id'), 'KEDALAMAN 4');
  assert.equal(eventText('Descent 4', 'id'), 'Kedalaman 4');
  assert.equal(eventText('PRACTICE ARENA · NO CRYSTAL', 'id'), 'ARENA LATIHAN · TANPA CRYSTAL');
  assert.equal(eventText('Perlu hero Lv.10', 'en'), 'Requires hero Lv.10');
  assert.equal(eventText('Perlu Mastery', 'en'), 'Requires Mastery');
  assert.equal(eventText('Perlu kedua cabang sebelumnya', 'en'), 'Requires both previous branches');
  assert.equal(eventText('−0.6s', 'id'), '−0.6s');
  assert.equal(eventText('Cleave', 'id'), 'Cleave');
  assert.equal(eventText('something unknown', 'en'), 'something unknown');
  assert.equal(eventText('', 'en'), '');
});

test('eventText covers epilogue cards built from either language', () => {
  restoreContent();
  const cleared = Array.from({ length: 16 }, (_, i) => i);
  const cards = epilogue({ school: 'restore', archive: 'public', cooperative: 'clinic' }, cleared);
  const english = cards.map(card => eventText(card, 'en'));
  assert.match(english[0], /^The machine stops\. Vharok is free\./);
  assert.equal(english[1], 'A bell for the school: The children use the little bell to call everyone to mealtime.');
  assert.deepEqual(english.map(card => eventText(card, 'id')), cards);
});

test('eventText translates every threat and banner the simulation emits', () => {
  restoreContent();
  const seen = new Set<string>();
  const counters = new Set<string>();
  for (const enemyId of Object.keys(ENEMIES).filter(id => ENEMIES[id].archetype === id)) {
    for (const mode of ['raid', 'adventure'] as const) {
      const battle = mode === 'raid' ? new Battle('raid', 1, undefined, { enemyId }) : new Battle('adventure', 1);
      battle.start();
      for (let t = 0; t < 90 && battle.status === 'fighting'; t += .5) {
        battle.tick(.5);
        if (Math.floor(t) % 6 === 0) battle.guard();
        for (const threat of battle.threats) { seen.add(threat.name); if (threat.counter) counters.add(threat.counter); }
        for (const event of battle.drain()) if (event.text && !['cast', 'stance', 'tap', 'move'].includes(event.type)) seen.add(event.text);
      }
    }
  }
  assert.ok(counters.size >= 4, 'simulation produced threat counters');
  for (const counter of counters) {
    const en = eventText(counter, 'en');
    assert.notEqual(en, counter, `untranslated counter: ${counter}`);
    assert.equal(eventText(en, 'id'), counter);
  }
  for (const text of seen) {
    if (text === 'EMERALD CATACLYSM') continue;
    const id = eventText(text, 'id');
    assert.notEqual(id, text, `untranslated event text: ${text}`);
    assert.equal(eventText(id, 'en'), text);
  }
});
