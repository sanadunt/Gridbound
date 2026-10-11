import { threatKind, threatName } from '../game/simulation';
import type { Intent } from '../game/world';
import { t, lang, type StringKey } from '../i18n';
import { eventText } from '../i18n/content';

/** Intent chips on the map dossier and in the bestiary: the name the battle telegraph announces, tagged with its counter family (the tag the battle's counter line starts with). */
export const intentChips = (enemyId: string, patterns: readonly Intent[]) => patterns.map((intent, i) => {
  const kind = t(`intent.kind.${threatKind(intent)}` as StringKey);
  return `<span class="intent-chip intent-${intent}">${i + 1}. ${eventText(threatName(enemyId, intent), lang())} <small>${kind}</small></span>`;
}).join('');
