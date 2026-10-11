import { QUESTS, questProgress } from '../game/quests';
import { ROSTER } from '../game/content';
import { GEAR } from '../game/jobs';
import { ENEMIES } from '../game/world';
import { claimQuest, type Profile } from '../game/profile';
import { t, type StringKey } from '../i18n';
import { featureOpen } from './unlocks';

type QuestGroup = 'ready' | 'tracked' | 'open' | 'locked' | 'claimed';
const GROUPS: QuestGroup[] = ['ready', 'tracked', 'open', 'locked', 'claimed'];
/** Where a quest sits on the board: rewards to claim first, then the tracked one, open work, locked and claimed (QUESTS order inside a group). */
export const questGroup = (p: Profile, q: typeof QUESTS[number]): QuestGroup => { const s = questProgress(p, q); return s.claimed ? 'claimed' : s.ready ? 'ready' : !s.unlocked ? 'locked' : p.trackedQuest === q.id ? 'tracked' : 'open'; };
/** The board's quests for a filter, ready rewards first. */
export function boardQuests(p: Profile, filter: 'available'|'all'|'claimed' = 'available') {
  const matches = QUESTS.filter(q => { const s = questProgress(p, q); return filter === 'all' || (filter === 'claimed' ? s.claimed : s.unlocked && !s.claimed); });
  return GROUPS.flatMap(group => matches.filter(q => questGroup(p, q) === group));
}

/** Claim every ready quest for its own hero (or the chosen recipient); a claim can open the next quest of a chain, which is claimed too when ready.
 *  `gear` lists each gear reward with the hero who got it (or, when that hero already owned it, the gold it was sold for). */
export function claimAllQuests(p: Profile, recipient: number) {
  const claimed: string[] = [], gear: { hero: number; gear: string; refund: number }[] = [], gold = p.gold;
  for (let guard = 0; guard < QUESTS.length; guard++) {
    const q = QUESTS.find(q => questProgress(p, q).ready), got = q && claimQuest(p, q.id, recipient);
    if (!q || !got) break;
    claimed.push(q.id);
    if (got.gear) gear.push({ hero: got.hero, gear: got.gear, refund: got.refund });
  }
  return { claimed, gold: p.gold - gold, gear };
}
/** One line per gear reward for a notice: 'Forged Edge for Aldric', or 'Ember Pendant sold, Aldric already owns one'. */
export const questGearText = (rewards: { hero: number; gear: string; refund: number }[]) => rewards.map(r => t(r.refund ? 'quest.gear.sold' : 'quest.gear.to', { gear: GEAR.find(g => g.id === r.gear)?.name ?? r.gear, name: ROSTER[r.hero]?.name ?? '?' })).join(', ');

/** The Quest Board: one scrollable list of compact cards grouped by state (ready rewards on top) with a Claim all button. */
export function questBoard(p: Profile, hero: number, filter: 'available'|'all'|'claimed' = 'available') {
  const ready = QUESTS.filter(q => questProgress(p, q).ready).length;
  const list = boardQuests(p, filter), hunts = featureOpen(p, 'raid');
  const sections = GROUPS.map(group => {
    const records = list.filter(q => questGroup(p, q) === group);
    if (!records.length) return '';
    return `<section class="quest-section quest-group-${group}"><h3 class="subheading">${t(`quest.group.${group}` as StringKey)} <span>${records.length}</span></h3><div class="quest-list">${records.map(q => {
      const s = questProgress(p, q), tracked = p.trackedQuest === q.id;
      const objective = q.metric === 'enemy' ? t('quest.obj.enemy', { name: ENEMIES[q.enemy!]?.name ?? q.enemy!, n: q.target }) : q.metric === 'level' ? t('quest.obj.level', { name: ROSTER[q.heroId!].name, n: q.target }) : q.metric === 'chapters' ? t('quest.obj.chapters', { n: q.target }) : q.metric === 'gear' ? t('quest.obj.gear', { n: q.target }) : q.metric === 'talents' ? t('quest.obj.talents', { n: q.target }) : t('quest.obj.floor', { n: q.target });
      const locked = q.requires && !p.claimedQuests.includes(q.requires) ? t('quest.lock.requires', { name: QUESTS.find(n => n.id === q.requires)?.name ?? '' }) : q.heroId !== undefined && !p.roster.includes(q.heroId) ? t('quest.lock.recruit', { name: ROSTER[q.heroId].name }) : t('quest.lock.chapter', { n: q.chapter });
      const state = s.claimed ? t('quest.state.claimed') : s.ready ? t('quest.state.ready') : !s.unlocked ? t('quest.state.locked') : tracked ? t('quest.state.tracked') : t('quest.state.open');
      return `<article class="win quest-entry ${s.claimed ? 'claimed' : ''} ${s.ready ? 'ready' : ''} ${tracked ? 'tracked' : ''}" data-quest="${q.id}" data-quest-state="${questGroup(p, q)}"><div><small>${t(`quest.kind.${q.kind}` as StringKey)} · ${state}</small><h3>${q.name}</h3><p class="quest-story">${q.giver} — ${q.story}</p><b>${objective}</b><span class="gauge" aria-hidden="true"><i style="width:${Math.min(1, s.value / q.target) * 100}%"></i></span><progress hidden max="${q.target}" value="${s.value}" aria-label="${q.name}: ${s.value}/${q.target}"></progress><span>${s.value}/${q.target}${s.unlocked ? '' : ` · ${locked}`}</span></div><footer><p class="quest-reward">${q.gear ? t('quest.reward.gear', { gold: q.gold, xp: q.xp, gear: GEAR.find(g => g.id === q.gear)?.name ?? '', name: ROSTER[q.heroId ?? hero].name }) : t('quest.reward', { gold: q.gold, xp: q.xp, name: ROSTER[q.heroId ?? hero].name })}</p><div class="quest-actions"><button data-claim-quest="${q.id}" class="btn ${s.ready ? 'primary' : ''}" ${s.ready ? '' : 'disabled'}>${s.claimed ? t('quest.claimed') : t('quest.claim')}</button>${!s.claimed ? `<button class="btn" data-track-quest="${q.id}" ${!s.unlocked || tracked ? 'disabled' : ''}>${tracked ? t('quest.tracked') : t('quest.track')}</button>` : ''}${q.enemy && s.unlocked && !s.claimed && hunts ? `<button class="btn" data-quest-hunt="${q.enemy}">${t('quest.hunt')}</button>` : ''}</div></footer></article>`;
    }).join('')}</div></section>`;
  }).join('');
  return `<div class="win quest-head"><div class="quest-head-row"><p>${t('quest.summary', { ready, claimed: p.claimedQuests.length, total: QUESTS.length })}</p>${ready ? `<button class="btn primary" data-claim-all>${t('quest.claim.all', { n: ready })}</button>` : ''}</div><div class="quest-filters"><label class="quest-recipient">${t('quest.filter')}<select data-quest-filter aria-label="${t('quest.filter')}">${(['available', 'all', 'claimed'] as const).map(f => `<option value="${f}" ${f === filter ? 'selected' : ''}>${t(`quest.filter.${f}` as StringKey)}</option>`).join('')}</select></label><label class="quest-recipient">${t('quest.recipient')}<select data-quest-recipient aria-label="${t('quest.recipient')}">${p.roster.map(id => `<option value="${id}" ${hero === id ? 'selected' : ''}>${ROSTER[id].name}</option>`).join('')}</select></label></div></div><div class="quest-board">${sections || `<p class="win hint">${t('quest.empty')}</p>`}</div>`;
}
