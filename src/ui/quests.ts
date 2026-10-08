import { QUESTS, questProgress } from '../game/quests';
import { ROSTER } from '../game/content';
import { GEAR } from '../game/jobs';
import { ENEMIES } from '../game/world';
import type { Profile } from '../game/profile';
import { t, type StringKey } from '../i18n';

export function questBoard(p: Profile, hero: number, filter: 'available'|'all'|'claimed' = 'available', pageIndex = 0) {
  const ready = QUESTS.filter(q => questProgress(p, q).ready).length;
  const matches = QUESTS.filter(q => {
    const s = questProgress(p, q);
    return filter === 'all' || (filter === 'claimed' ? s.claimed : s.unlocked && !s.claimed);
  });
  const pageCount = Math.max(1, matches.length);
  const page = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const visible = matches.slice(page, page + 1);
  const pageControls = pageCount > 1 ? `<nav class="page-controls" aria-label="${t('common.pages')}"><button class="btn" data-quest-page="-1" ${page <= 0 ? 'disabled' : ''}>◀ ${t('common.prev')}</button><span>${page + 1} / ${pageCount}</span><button class="btn" data-quest-page="1" ${page >= pageCount - 1 ? 'disabled' : ''}>${t('common.next')} ▶</button></nav>` : '';
  const sections = (['town', 'hunt', 'companion', 'descent'] as const).map(kind => {
    const records = visible.filter(q => q.kind === kind);
    if (!records.length) return '';
    return `<section class="quest-section"><h3 class="subheading">${t(`quest.kind.${kind}` as StringKey)}</h3><div class="quest-list">${records.map(q => {
      const s = questProgress(p, q), tracked = p.trackedQuest === q.id;
      const objective = q.metric === 'enemy' ? t('quest.obj.enemy', { name: ENEMIES[q.enemy!]?.name ?? q.enemy!, n: q.target }) : q.metric === 'level' ? t('quest.obj.level', { name: ROSTER[q.heroId!].name, n: q.target }) : q.metric === 'chapters' ? t('quest.obj.chapters', { n: q.target }) : q.metric === 'gear' ? t('quest.obj.gear', { n: q.target }) : q.metric === 'talents' ? t('quest.obj.talents', { n: q.target }) : t('quest.obj.floor', { n: q.target });
      const locked = q.requires && !p.claimedQuests.includes(q.requires) ? t('quest.lock.requires', { name: QUESTS.find(n => n.id === q.requires)?.name ?? '' }) : q.heroId !== undefined && !p.roster.includes(q.heroId) ? t('quest.lock.recruit', { name: ROSTER[q.heroId].name }) : t('quest.lock.chapter', { n: q.chapter });
      const state = s.claimed ? t('quest.state.claimed') : s.ready ? t('quest.state.ready') : !s.unlocked ? t('quest.state.locked') : tracked ? t('quest.state.tracked') : t('quest.state.open');
      return `<article class="win quest-entry ${s.claimed ? 'claimed' : ''} ${s.ready ? 'ready' : ''} ${tracked ? 'tracked' : ''}" data-quest="${q.id}"><div><small>${q.giver} · ${state}</small><h3>${q.name}</h3><p>${q.story}</p><b>${objective}</b><span class="gauge" aria-hidden="true"><i style="width:${Math.min(1, s.value / q.target) * 100}%"></i></span><progress hidden max="${q.target}" value="${s.value}" aria-label="${q.name}: ${s.value}/${q.target}"></progress><span>${s.value}/${q.target}${s.unlocked ? '' : ` · ${locked}`}</span></div><footer><p class="quest-reward">${t('quest.reward', { gold: q.gold, xp: q.xp, name: ROSTER[q.heroId ?? hero].name })}${q.gear ? ` · ${GEAR.find(g => g.id === q.gear)?.name ?? ''}` : ''}</p><div class="quest-actions"><button data-claim-quest="${q.id}" class="btn ${s.ready ? 'primary' : ''}" ${s.ready ? '' : 'disabled'}>${s.claimed ? t('quest.claimed') : t('quest.claim')}</button>${!s.claimed ? `<button class="btn" data-track-quest="${q.id}" ${!s.unlocked || tracked ? 'disabled' : ''}>${tracked ? t('quest.tracked') : t('quest.track')}</button>` : ''}${q.enemy && s.unlocked && !s.claimed ? `<button class="btn" data-quest-hunt="${q.enemy}">${t('quest.hunt')}</button>` : ''}</div></footer></article>`;
    }).join('')}</div></section>`;
  }).join('');
  return `<div class="win quest-head"><p>${t('quest.summary', { ready, claimed: p.claimedQuests.length, total: QUESTS.length })}</p><div class="quest-filters"><label class="quest-recipient">${t('quest.filter')}<select data-quest-filter aria-label="${t('quest.filter')}">${(['available', 'all', 'claimed'] as const).map(f => `<option value="${f}" ${f === filter ? 'selected' : ''}>${t(`quest.filter.${f}` as StringKey)}</option>`).join('')}</select></label><label class="quest-recipient">${t('quest.recipient')}<select data-quest-recipient aria-label="${t('quest.recipient')}">${p.roster.map(id => `<option value="${id}" ${hero === id ? 'selected' : ''}>${ROSTER[id].name}</option>`).join('')}</select></label></div></div><div class="paged-collection quest-pages" data-page="${page}">${sections || `<p class="win hint">${t('quest.empty')}</p>`}${pageControls}</div>`;
}
