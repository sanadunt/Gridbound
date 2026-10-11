import { ROSTER } from '../game/content';
import type { Profile } from '../game/profile';
import { partyPower, powerVerdict, recommendedHeroicPower, recommendedPower } from '../game/power';
import { unlockedDepth } from '../game/dungeon';
import { normalizeStoryParty } from '../game/story-party';
import { heroNeeds } from './badges';
import { featureOpen } from './unlocks';
import { t } from '../i18n';

export type DefeatFix = { kind: 'dungeon' | 'jobs' | 'gear'; hero?: number };
/** Up to two one-tap fixes after a Story defeat: the Undercroft when under-powered, talents/jobs to learn, an affordable gear upgrade. */
export function defeatFixes(p: Profile, chapter: number, heroic = false): DefeatFix[] {
  const fixes: DefeatFix[] = [], rec = heroic ? recommendedHeroicPower(chapter) : recommendedPower(chapter);
  if (powerVerdict(partyPower(p), rec) === 'under' && featureOpen(p, 'dungeon') && unlockedDepth(p.cleared, p.journey.depth) > 0) fixes.push({ kind: 'dungeon' });
  const party = normalizeStoryParty(p.storyActive, p.roster, p.cleared);
  const learner = party.find(id => heroNeeds(p, id).some(need => need !== 'gear'));
  if (learner !== undefined) fixes.push({ kind: 'jobs', hero: learner });
  const shopper = party.find(id => heroNeeds(p, id).includes('gear'));
  if (shopper !== undefined) fixes.push({ kind: 'gear', hero: shopper });
  return fixes.slice(0, 2);
}

type XpReward = { id: number; kind: 'active' | 'bench'; xp: number; bonus: number; before: number; after: number };
/** The result's EXP block: a compact portrait grid for the party (+EXP, level arrow) and one line for the bench. */
export function xpSummary(rewards: readonly XpReward[], face: (id: number) => string) {
  const party = rewards.filter(r => r.kind !== 'bench'), bench = rewards.filter(r => r.kind === 'bench');
  const grid = party.map(r => { const up = r.after > r.before; return `<div class="xp-card ${up ? 'leveled-up' : ''}" data-xp-kind="${r.kind}"><img src="${face(r.id)}" alt=""/><b class="xp-hero-name">${ROSTER[r.id]?.name ?? '?'}</b><span class="xp-points">+${r.xp}${r.bonus ? ` <small class="xp-catchup">+${r.bonus}</small>` : ''}</span><span class="xp-level-badge">${up ? `LV ${r.before}→${r.after}` : `LV ${r.after}`}</span></div>`; }).join('');
  const lo = Math.min(...bench.map(r => r.xp)), hi = Math.max(...bench.map(r => r.xp)), ups = bench.filter(r => r.after > r.before).map(r => `${ROSTER[r.id]?.name ?? '?'} ${r.before}→${r.after}`);
  const line = bench.length ? `<p class="xp-bench" data-xp-kind="bench">${t('result.bench.line', { n: bench.length, xp: lo === hi ? `+${lo}` : `+${lo}–${hi}` })}${ups.length ? ` · <b>${t('result.bench.up', { names: ups.join(', ') })}</b>` : ''}</p>` : '';
  return grid || line ? `<div class="xp-results">${grid ? `<div class="xp-grid">${grid}</div>` : ''}${line}</div>` : '';
}
