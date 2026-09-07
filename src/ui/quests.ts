import { QUESTS, questProgress } from '../game/quests';
import { ROSTER } from '../game/content';
import { GEAR } from '../game/jobs';
import type { Profile } from '../game/profile';

export function questBoard(p: Profile, hero: number, filter: 'available'|'all'|'claimed' = 'available', pageIndex = 0) {
  const ready = QUESTS.filter(q => questProgress(p, q).ready).length;
  const matches = QUESTS.filter(q => {
    const s = questProgress(p, q);
    return filter === 'all' || (filter === 'claimed' ? s.claimed : s.unlocked && !s.claimed);
  });
  const pageSize = 1;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const visible = matches.slice(page * pageSize, (page + 1) * pageSize);
  const pageControls = pageCount > 1 ? `<nav class="page-controls" aria-label="Quest pages"><button class="secondary-button" data-quest-page="-1" ${page <= 0 ? 'disabled' : ''}>← Previous</button><span>PAGE ${page + 1} / ${pageCount}</span><button class="secondary-button" data-quest-page="1" ${page >= pageCount - 1 ? 'disabled' : ''}>Next →</button></nav>` : '';
  const kinds: Record<string, string> = { town: 'Town stories', hunt: 'Hunt contracts', companion: 'Companion journeys', descent: 'Below the bell' };
  const sections = (['town', 'hunt', 'companion', 'descent'] as const).map(kind => {
    const records = visible.filter(q => q.kind === kind);
    if (!records.length) return '';
    return `<details class="quest-section" open><summary>${kinds[kind]}</summary><div class="quest-list">${records.map(q => {
      const s = questProgress(p, q), tracked = p.trackedQuest === q.id;
      const objective = q.metric === 'enemy' ? `Kalahkan ${q.enemy} (${q.target})` : q.metric === 'level' ? `${ROSTER[q.heroId!].name} mencapai Lv.${q.target}` : q.metric === 'chapters' ? `Selesaikan ${q.target} chapter` : q.metric === 'gear' ? `Satu hero memiliki ${q.target} equipment` : q.metric === 'talents' ? `Satu hero mempelajari ${q.target} talent` : `Capai descent floor ${q.target}`;
      const locked = q.requires && !p.claimedQuests.includes(q.requires) ? `Klaim ${QUESTS.find(n => n.id === q.requires)?.name} terlebih dahulu` : q.heroId !== undefined && !p.roster.includes(q.heroId) ? `Rekrut ${ROSTER[q.heroId].name}` : `Selesaikan ${q.chapter} chapter`;
      return `<article class="quest-entry ${s.claimed ? 'claimed' : ''} ${tracked ? 'tracked' : ''}" data-quest="${q.id}"><div><small>${q.giver} · ${s.claimed ? 'CLAIMED' : s.ready ? 'REWARD READY' : !s.unlocked ? 'LOCKED' : tracked ? 'TRACKED' : 'AVAILABLE'}</small><h3>${q.name}</h3><p>${q.story}</p><b>${objective}</b><progress max="${q.target}" value="${s.value}" aria-label="${q.name}: ${s.value}/${q.target}"></progress><span>${s.value}/${q.target}${s.unlocked ? '' : ` · ${locked}`}</span></div><footer><p>${q.gold}g · ${q.xp} XP untuk ${ROSTER[q.heroId ?? hero].name}${q.gear ? ` · ${GEAR.find(g => g.id === q.gear)?.name ?? ''}` : ''}</p><div class="quest-actions"><button data-claim-quest="${q.id}" class="${s.ready ? 'gold-button' : 'secondary-button'}" ${s.ready ? '' : 'disabled'}>${s.claimed ? 'Reward claimed' : 'Claim reward'}</button>${!s.claimed ? `<button class="secondary-button" data-track-quest="${q.id}" ${!s.unlocked || tracked ? 'disabled' : ''}>${tracked ? 'Tracked' : 'Track'}</button>` : ''}${q.enemy && s.unlocked && !s.claimed ? `<button class="secondary-button" data-quest-hunt="${q.enemy}">Open hunt</button>` : ''}</div></footer></article>`;
    }).join('')}</div></details>`;
  }).join('');
  return `<div class="section-heading"><div><span class="eyebrow">THE PEOPLE BEHIND THE BELL</span><h2>Quest ledger</h2></div><span>${p.claimedQuests.length}/${QUESTS.length} claimed</span></div><p class="town-copy">${ready} reward siap diklaim. Quest mengenali pencapaian yang sudah dibank, termasuk sebelum quest dibuka. Hunt menghitung semua varian archetype. Tidak ada daily timer atau tugas berulang tanpa akhir.</p><label class="quest-recipient">Tampilkan<select data-quest-filter aria-label="Filter quest">${(['available', 'all', 'claimed'] as const).map(f => `<option value="${f}" ${f === filter ? 'selected' : ''}>${f === 'available' ? 'Available & ready' : f === 'all' ? 'All quests' : 'Claimed quests'}</option>`).join('')}</select></label><label class="quest-recipient">Penerima reward quest umum <select data-quest-recipient aria-label="Penerima reward quest">${p.roster.map(id => `<option value="${id}" ${hero === id ? 'selected' : ''}>${ROSTER[id].name}</option>`).join('')} </select><small>Quest companion selalu memberi XP kepada karakter yang bersangkutan.</small></label><div class="paged-collection quest-pages" data-page="${page}">${sections}${pageControls}</div>`;
}
