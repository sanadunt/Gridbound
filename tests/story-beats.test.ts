import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN, ENEMIES } from '../src/game/world';
import { CHARACTERS } from '../src/game/characters';
import { STORY_CHOICES } from '../src/game/narrative';
import { Battle } from '../src/game/simulation';
import { createProfile, completeZone, normalizeProfile } from '../src/game/profile';
import { normalizeJourney } from '../src/game/journey';
import { CONTENT_TEXT, localizeContent, resolveContentKey, restoreContent } from '../src/i18n/content';

after(() => restoreContent());
const archetypes = Object.values(ENEMIES).filter(e => e.archetype === e.id);
// Words a beat may use for an enemy besides its name ("the Cantor", "scavengers"): its species and a few nicknames.
const ALIASES: Record<string, string[]> = { wolf: ['wolf', 'wolves'], goblin: ['goblin', 'scavengers?'], spider: ['spider', 'widow'], shaman: ['cantor', 'shaman'], golem: ['golem'], wraith: ['wraith'], treant: ['treant'], dragon: ['dragon'], moth: ['moth'], basilisk: ['basilisk'], crab: ['crab'], revenant: ['revenant'], lich: ['lich', 'archivist'], knight: ['knight'], hydra: ['hydra'], harpy: ['harpy', 'harrier'], colossus: ['colossus'], choir: ['choir', 'choirmaster'] };
const mentions = (text: string) => archetypes.filter(e => [e.name.replace(/^The /, ''), ...ALIASES[e.id]].some(word => new RegExp(`\\b${word}\\b`, 'i').test(text))).map(e => e.id);

test('WP9: every wave beat that names an enemy names the enemy of that wave (EN)', () => {
  localizeContent('en');
  const wrong: string[] = [], missing: string[] = [];
  CAMPAIGN.forEach((chapter, c) => chapter.stages.forEach((stage, i) => {
    if (!stage.beat) { missing.push(`CH${c + 1} s${i}`); return; }
    const arch = ENEMIES[stage.enemy].archetype;
    for (const id of mentions(stage.beat)) if (id !== arch) wrong.push(`CH${c + 1} s${i} (${ENEMIES[stage.enemy].name}) mentions ${id}: ${stage.beat}`);
  }));
  assert.deepEqual(wrong, []);
  assert.deepEqual(missing, [], 'every stage has a story beat, Act I included');
  assert.deepEqual(mentions('The Cantor sings.'), ['shaman'], 'the matcher recognises nicknames');
});

test('WP9: Vharok is not the HP bar in the chapters that call him an ally', () => {
  const expected: Record<string, [string, string, string, string]> = {
    'thirteenth-stroke': ['Simpul Ketiga Belas', 'MENUNGGANGI VHAROK', 'The Thirteenth Node', 'RIDING VHAROK'],
    'last-rehearsal': ['Sang Pengulang', 'MEMBELENGGU VHAROK', 'The Repeater', 'SHACKLING VHAROK'],
    'unwritten-dawn': ['Mesin Terakhir', 'BERSAYAPKAN VHAROK', 'The Last Machine', 'WINGED WITH VHAROK'],
  };
  for (const lang of ['id', 'en'] as const) {
    localizeContent(lang);
    for (const [id, names] of Object.entries(expected)) {
      const floor = CAMPAIGN.findIndex(c => c.id === id) + 1, stage = CAMPAIGN[floor - 1].stages.length - 1;
      assert.equal(ENEMIES[CAMPAIGN[floor - 1].stages[stage].enemy].archetype, 'dragon', 'the fight itself is unchanged');
      const b = new Battle('adventure', floor, undefined, { stage });
      const [name, title] = lang === 'id' ? names : names.slice(2);
      assert.equal(b.enemyName, name, `${id} ${lang}`);
      assert.equal(b.enemyTitle, title, `${id} ${lang}`);
      assert.equal(b.enemyId.startsWith('dragon'), true, 'art and patterns stay the dragon');
    }
  }
  restoreContent();
  // Without an override the stage keeps the enemy's own name; Act I's dream-bound Vharok is still Vharok.
  assert.equal(new Battle('adventure', 4, undefined, { stage: 3 }).enemyName, 'Vharok');
  assert.equal(new Battle('adventure', 8, undefined, { stage: 0 }).enemyName, ENEMIES['goblin-ash'].name);
});

test('WP9: variant names drop a leading "The" and never say Frost twice', () => {
  assert.equal(ENEMIES['revenant-ash'].name, 'Ashbound Last Watch');
  assert.equal(ENEMIES['wraith-frost'].name, 'Frostbound Unburied');
  assert.equal(ENEMIES['choir-frost'].name, 'Frostbound Hollow Choir');
  assert.equal(ENEMIES['colossus-frost'].name, 'Frostward Colossus');
  assert.equal(ENEMIES['colossus-auric'].name, 'Gilded Frostward Colossus');
  for (const e of Object.values(ENEMIES)) assert.doesNotMatch(e.name, /^\w+ The |Frost\w* Frost/, e.id);
});

test('WP9: the six new heroes appear in person in their recruit chapters and every hero has a finale line', () => {
  for (const lang of ['id', 'en'] as const) {
    localizeContent(lang);
    for (const hero of CHARACTERS.slice(9)) {
      const chapter = CAMPAIGN[hero.recruitChapter - 1];
      assert.ok(chapter.recruit.includes(hero.id), `${hero.name} is recruited by ${chapter.id}`);
      const story = [chapter.intro, chapter.outro, ...chapter.stages.map(s => s.beat ?? '')].join('\n');
      assert.ok(story.includes(hero.name), `${lang}: ${hero.name} appears in ${chapter.id}`);
    }
    for (const hero of CHARACTERS) assert.ok(hero.fateLine.length > 20, `${hero.name} has a fate line`);
  }
  localizeContent('en');
  const glass = CAMPAIGN.find(c => c.id === 'glass-ferry')!;
  assert.match(glass.intro, /Vesper, the ferry keeper/);
  assert.doesNotMatch(glass.intro, /ferryman/);
});

test('WP9: party counts no longer assume nine heroes, and the continuity slips are fixed (EN)', () => {
  localizeContent('en');
  const text = CAMPAIGN.map(c => [c.intro, c.outro, ...c.stages.map(s => s.beat ?? '')].join('\n')).join('\n');
  for (const stale of [/nine beds/i, /nine pairs of footprints/i, /Nine candles/, /counts nine visitors/, /that axe/, /whole party came home except him/, /no retries in this story/, /ink on his fingertips/, /Campaign complete/]) assert.doesNotMatch(text, stale);
  assert.match(text, /one bed for every member of our party/);
  assert.match(text, /every set of our footprints walks together/);
  assert.match(text, /The other sixteen plates bear the names of children/);
  assert.match(text, /new height line for Eda, dated today/);
  assert.match(text, /Nyx finally builds the workshop/);
});

test('WP9: every story CONTENT_TEXT entry matches its source text in one language (no stale translation)', () => {
  restoreContent();
  const stale = Object.keys(CONTENT_TEXT).filter(key => /^(campaign|choice|character)\./.test(key)).filter(key => {
    const slot = resolveContentKey(key)!, source = slot.owner[slot.prop] as string;
    return source !== CONTENT_TEXT[key].id && source !== CONTENT_TEXT[key].en;
  });
  assert.deepEqual(stale, []);
  for (const scene of STORY_CHOICES) for (const key of [`choice.${scene.id}.text`, ...scene.options.map(o => `choice.${scene.id}.options.${o.id}.outcome`)]) assert.ok(CONTENT_TEXT[key], key);
});

test('WP9: a first clear queues its join scenes and camp scene; replays and normalization never re-queue them', () => {
  const p = createProfile();
  for (let i = 0; i < 6; i++) completeZone(p, i);
  // Sable (ch1), Orin (ch2), Bran + Kestrel (ch3), Nyx + Mira (ch4), Tamsin (ch5), Vesper (ch6); the archive choice opens after ch6.
  assert.deepEqual(p.journey.pendingRecruitScenes, [2, 7, 1, 5, 6, 8, 9, 10]);
  assert.deepEqual(p.journey.pendingChapterScenes, [5]);
  assert.equal(completeZone(p, 5), false, 'a replay queues nothing');
  const back = normalizeProfile(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(back.journey.pendingRecruitScenes, [2, 7, 1, 5, 6, 8, 9, 10]);
  assert.deepEqual(back.journey.pendingChapterScenes, [5]);
  // Migration rebuilds progress with completeZone, but only the saved queue survives.
  const legacy = normalizeProfile({ ...JSON.parse(JSON.stringify(p)), journey: { stars: {}, chests: 0, heroic: [], depth: 0 } });
  assert.equal(legacy.journey.pendingRecruitScenes, undefined);
  assert.equal(legacy.journey.pendingChapterScenes, undefined);
  // Only heroes recruited by cleared chapters, and only cleared chapters, can be owed a scene.
  const j = normalizeJourney({ pendingRecruitScenes: [9, 9, 14, 'x', 0], pendingChapterScenes: [5, 15, 5, -1] }, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(j.pendingRecruitScenes, [9]);
  assert.deepEqual(j.pendingChapterScenes, [5]);
  assert.ok(!('pendingRecruitScenes' in normalizeJourney({ pendingRecruitScenes: [] }, [])), 'empty queues are omitted');
});
