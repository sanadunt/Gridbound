import { CAMPAIGN, ENEMIES } from '../game/world';
import { canEnterZone, type Profile } from '../game/profile';
import { ROSTER } from '../game/content';
import { monsterCanvas } from '../art/monsters';
import type { TownState } from './town';

export type ActId = 0 | 1 | 2 | 3;

export interface ActMeta {
  id: ActId;
  roman: string;
  name: string;
  title: string;
  subtitle: string;
  territory: string;
  biomeClass: string;
  zones: number[];
  climaxBoss: string;
  accentColor: string;
  atmosphereNote: string;
}

export const ACTS: ActMeta[] = [
  {
    id: 0,
    roman: 'ACT I',
    name: 'Whisperwood',
    title: 'The Whispering Frontier',
    subtitle: 'Awaken the four ancient seals',
    territory: 'Emberhollow Basin & Overgrown Ruins',
    biomeClass: 'biome-act-1',
    zones: [0, 1, 2, 3],
    climaxBoss: 'Vharok · The Emerald Gate',
    accentColor: '#7bf3ca',
    atmosphereNote: 'Ancient stone, moss forest & emerald mist'
  },
  {
    id: 1,
    roman: 'ACT II',
    name: 'The Ashlands',
    title: 'The Ashlands of Memory',
    subtitle: 'A town that forgot its children',
    territory: 'Cinder Plains & The Glass Ferry',
    biomeClass: 'biome-act-2',
    zones: [4, 5, 6, 7],
    climaxBoss: 'Vharok · The Thirteenth Stroke',
    accentColor: '#d17b49',
    atmosphereNote: 'Volcanic ash, forgotten names & violet water'
  },
  {
    id: 2,
    roman: 'ACT III',
    name: 'Frost Peaks',
    title: 'The Frozen Archive',
    subtitle: 'A history written in future tense',
    territory: 'Glacial Archives & The Unborn Orchard',
    biomeClass: 'biome-act-3',
    zones: [8, 9, 10, 11],
    climaxBoss: 'Vharok · The Last Rehearsal',
    accentColor: '#67c0eb',
    atmosphereNote: 'Blizzard peaks, pale orchards & nine graves'
  },
  {
    id: 3,
    roman: 'ACT IV',
    name: 'Gilded Dawn',
    title: 'The Gilded Citadel',
    subtitle: 'Safety has to be built together',
    territory: 'The Original Tower & Zenith Horizon',
    biomeClass: 'biome-act-4',
    zones: [12, 13, 14, 15],
    climaxBoss: 'Vharok · The Unwritten Dawn',
    accentColor: '#f5c358',
    atmosphereNote: 'Solar auric gold, warm marble & new dawn'
  }
];

// Node positions on the 800x380 SVG cartography map
const NODE_COORDINATES = [
  { x: 120, y: 260, pctX: 15, pctY: 68 }, // Node 0
  { x: 310, y: 120, pctX: 38.75, pctY: 31.5 }, // Node 1
  { x: 510, y: 270, pctX: 63.75, pctY: 71 }, // Node 2
  { x: 700, y: 150, pctX: 87.5, pctY: 39.5 }  // Node 3 (Climax Gate)
];

// Bezier segments connecting Node 0 -> 1 -> 2 -> 3
const ROUTE_SEGMENTS = [
  'M 120,260 C 200,260 230,120 310,120',
  'M 310,120 C 390,120 430,270 510,270',
  'M 510,270 C 590,270 630,150 700,150'
];

const monsterPortraits = new Map<string, string>();
function getMonsterImage(id: string): string {
  if (!monsterPortraits.has(id)) {
    monsterPortraits.set(id, monsterCanvas(id).toDataURL());
  }
  return monsterPortraits.get(id)!;
}

export function renderWorldMap(p: Profile, state: TownState): string {
  // Determine active act based on current selected zone
  const activeActId = Math.min(3, Math.max(0, Math.floor(state.zone / 4))) as ActId;
  const act = ACTS[activeActId];
  const selectedZoneIdx = state.zone;
  const zone = CAMPAIGN[selectedZoneIdx];
  const canEnter = canEnterZone(p, selectedZoneIdx);

  // Boss of selected zone
  const finalStage = zone.stages[zone.stages.length - 1];
  const bossDef = ENEMIES[finalStage.enemy];

  // Calculate Act Cleared Count
  const actClearedCount = act.zones.filter(z => p.cleared.includes(z)).length;
  const totalCleared = p.cleared.length;

  return `
    <div class="world-map-wrapper ${act.biomeClass}" aria-label="Campaign World Map">
      <!-- Top Act Navigation Bar -->
      <div class="map-top-bar">
        <div class="map-title-block">
          <div class="eyebrow"><span class="eyebrow-pip">◆</span> CARTOGRAPHY WAR TABLE · ${act.roman} <span class="eyebrow-pip">◆</span></div>
          <h2>${act.title}</h2>
          <span class="map-territory-pill">${act.territory}</span>
        </div>

        <div class="map-stepper-wrap" aria-label="Act navigation">
          <button class="secondary-button map-stepper-btn" data-campaign-page="-1" ${state.zone <= 0 ? 'disabled' : ''} aria-label="Previous Chapter">
            <span>◀</span> Prev
          </button>
          <span class="chapter-counter">CH ${selectedZoneIdx + 1} / ${CAMPAIGN.length}</span>
          <button class="secondary-button map-stepper-btn" data-campaign-page="1" ${state.zone >= CAMPAIGN.length - 1 ? 'disabled' : ''} aria-label="Next Chapter">
            Next <span>▶</span>
          </button>
        </div>
      </div>

      <!-- Act Selector Tabs Ribbon -->
      <nav class="map-act-nav" aria-label="Campaign Acts">
        ${ACTS.map((a) => {
          const isActActive = a.id === activeActId;
          const aCleared = a.zones.filter(z => p.cleared.includes(z)).length;
          const isActUnlocked = a.id === 0 || p.cleared.includes(a.zones[0] - 1);
          const statusBadge = aCleared === 4 ? '⚜ 4/4 RESTORED' : `${aCleared}/4 SEALS`;
          // Clicking an Act tab selects the first zone or first uncompleted zone in that act
          const targetZone = a.zones.find(z => !p.cleared.includes(z)) ?? a.zones[0];
          return `
            <button class="map-act-tab ${isActActive ? 'active' : ''} ${isActUnlocked ? '' : 'locked'}"
                    data-act="${a.id}"
                    ${isActUnlocked ? '' : 'disabled'}
                    aria-current="${isActActive ? 'true' : 'false'}">
              <span class="act-tab-roman">${a.roman}</span>
              <b class="act-tab-name">${a.name}</b>
              <small class="act-tab-badge">${statusBadge}</small>
            </button>
          `;
        }).join('')}
      </nav>

      <!-- Main World Map Split Console -->
      <div class="world-map-layout">
        <!-- LEFT: Visual Cartography Map -->
        <section class="world-map-canvas-card" aria-label="Interactive Map">
          <div class="map-chart-viewport">
            <!-- Background SVG with paths, contours, compass rose -->
            <svg class="world-map-svg" viewBox="0 0 800 380" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <defs>
                <linearGradient id="actPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#deb252" />
                  <stop offset="50%" stop-color="#f7c865" />
                  <stop offset="100%" stop-color="#ffd79a" />
                </linearGradient>
                <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <!-- Topographic Grid & Latitude lines -->
              <g class="map-grid-lines" opacity="0.18">
                <line x1="40" y1="95" x2="760" y2="95" stroke="#7bf3ca" stroke-dasharray="4,6" />
                <line x1="40" y1="190" x2="760" y2="190" stroke="#7bf3ca" stroke-dasharray="4,6" />
                <line x1="40" y1="285" x2="760" y2="285" stroke="#7bf3ca" stroke-dasharray="4,6" />
                <line x1="200" y1="30" x2="200" y2="350" stroke="#7bf3ca" stroke-dasharray="4,6" />
                <line x1="400" y1="30" x2="400" y2="350" stroke="#7bf3ca" stroke-dasharray="4,6" />
                <line x1="600" y1="30" x2="600" y2="350" stroke="#7bf3ca" stroke-dasharray="4,6" />
              </g>

              <!-- Corner Cartography Filigree -->
              <g class="map-corner-filigree" stroke="#deb252" stroke-width="1.5" fill="none" opacity="0.4">
                <path d="M 30,50 L 30,30 L 50,30" />
                <path d="M 770,50 L 770,30 L 750,30" />
                <path d="M 30,330 L 30,350 L 50,350" />
                <path d="M 770,330 L 770,350 L 750,350" />
              </g>

              <!-- Ornate Compass Rose in upper left -->
              <g class="map-compass" transform="translate(68, 68)" opacity="0.75">
                <circle cx="0" cy="0" r="28" fill="none" stroke="#deb252" stroke-width="1" stroke-dasharray="2,4" />
                <circle cx="0" cy="0" r="22" fill="rgba(8,16,12,0.6)" stroke="#81926d" stroke-width="1" />
                <!-- 8-point compass star -->
                <polygon points="0,-22 4,-6 0,0 -4,-6" fill="#deb252" />
                <polygon points="0,22 4,6 0,0 -4,6" fill="#81926d" />
                <polygon points="-22,0 -6,-4 0,0 -6,4" fill="#81926d" />
                <polygon points="22,0 6,-4 0,0 6,4" fill="#deb252" />
                <text x="0" y="-24" fill="#f0c968" font-size="9" font-family="monospace" text-anchor="middle" font-weight="bold">N</text>
                <text x="25" y="3" fill="#81926d" font-size="7" font-family="monospace">E</text>
              </g>

              <!-- Connecting Road Paths -->
              <g class="map-routes">
                ${ROUTE_SEGMENTS.map((d, segIdx) => {
                  const fromZone = act.zones[segIdx];
                  const toZone = act.zones[segIdx + 1];
                  const isCleared = p.cleared.includes(toZone);
                  const isActive = p.cleared.includes(fromZone) && !isCleared;
                  const strokeClass = isCleared ? 'route-cleared' : isActive ? 'route-active' : 'route-locked';
                  return `
                    <!-- Shadow / Glow layer -->
                    <path d="${d}" class="route-underlay ${strokeClass}" />
                    <!-- Main path line -->
                    <path d="${d}" class="route-main ${strokeClass}" />
                  `;
                }).join('')}
              </g>
            </svg>

            <!-- Interactive Map Node Pins (HTML overlay for accessibility & crisp click handling) -->
            <div class="map-nodes-layer">
              ${act.zones.map((zoneIdx, nodeIdx) => {
                const zDef = CAMPAIGN[zoneIdx];
                const coords = NODE_COORDINATES[nodeIdx];
                const isSelected = state.zone === zoneIdx;
                const isCleared = p.cleared.includes(zoneIdx);
                const isUnlocked = canEnterZone(p, zoneIdx);
                const isClimax = nodeIdx === 3;
                const stateClass = isCleared ? 'cleared' : isUnlocked ? 'active' : 'locked';

                return `
                  <div class="map-node-anchor" style="left: ${coords.pctX}%; top: ${coords.pctY}%;">
                    <button class="map-node-pin ${stateClass} ${isSelected ? 'chosen' : ''} ${isClimax ? 'climax-node' : ''}"
                            data-zone="${zoneIdx}"
                            ${isUnlocked ? '' : 'disabled'}
                            aria-label="Chapter ${zoneIdx + 1}: ${zDef.name} (${stateClass})"
                            title="${zDef.name} · ${isCleared ? 'SEAL RESTORED' : isUnlocked ? 'AVAILABLE' : 'LOCKED'}">
                      <span class="map-beacon-pulse" aria-hidden="true"></span>
                      <span class="map-node-icon" aria-hidden="true">
                        ${isCleared ? '⚜' : isClimax ? '👑' : isUnlocked ? '✦' : '🔒'}
                      </span>
                      <span class="map-node-badge">${String(zoneIdx + 1).padStart(2, '0')}</span>
                    </button>

                    <!-- Node Title Plate -->
                    <div class="map-node-plate ${isSelected ? 'chosen' : ''}">
                      <b class="node-plate-name">${zDef.name}</b>
                      <small class="node-plate-status">
                        ${isCleared ? '⚜ CLEARED' : isUnlocked ? '✦ OBJECTIVE' : '🔒 LOCKED'}
                      </small>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Biome Atmosphere Label in Bottom Right -->
            <div class="map-atmosphere-footer">
              <span class="atmosphere-pip">✦</span>
              <span>${act.atmosphereNote}</span>
              <span class="map-progress-chip">${actClearedCount}/4 Cleared</span>
            </div>
          </div>
        </section>

        <!-- RIGHT: Tactical Mission Recon Dossier -->
        <article class="mission-brief world-map-dossier" aria-label="Mission Dossier">
          <div class="dossier-header">
            <div class="eyebrow">${zone.speaker}</div>
            <h3>${zone.name}</h3>
            <p class="zone-subtitle">${zone.subtitle}</p>
          </div>

          <!-- Tactical HUD Condition Badges -->
          <div class="tactical-chips">
            <span class="hazard-chip">⚠️ ATTRITION ACTIVE</span>
            <span class="hud-chip">🧪 2 POTIONS</span>
            <span class="hud-chip">⚔️ ${zone.stages.length} WAVES</span>
            <span class="hud-chip gold">💰 ${zone.reward}G REWARD</span>
            ${zone.recruit.length ? `<span class="hud-chip recruit-chip">🛡️ RECRUIT: ${zone.recruit.map(id => ROSTER[id].name).join(', ')}</span>` : ''}
          </div>

          <!-- Boss Recon Dossier Card -->
          <div class="dossier-boss-card">
            <div class="boss-avatar-frame">
              <img src="${getMonsterImage(finalStage.enemy)}" alt="${bossDef.name}" class="boss-pixel-avatar" />
              <span class="boss-tier-tag">TIER ${bossDef.tier ?? 1}</span>
            </div>
            <div class="boss-intel">
              <span class="eyebrow"><span class="eyebrow-pip">◆</span> CLIMAX ADVERSARY <span class="eyebrow-pip">◆</span></span>
              <h4>${bossDef.name}</h4>
              <small class="boss-title">${bossDef.title}</small>
              <div class="boss-intent-flow" aria-label="Intent sequence">
                ${bossDef.patterns.map((intent, i) => `
                  <span class="intent-chip intent-${intent}">
                    ${i + 1}. ${intent.toUpperCase()}
                  </span>
                `).join('')}
              </div>
              <p class="counter-strategy"><b>TACTICAL COUNTER:</b> ${bossDef.counter}</p>
            </div>
          </div>

          <!-- Narrative Expedition Accordion -->
          <details class="dossier-lore-accordion" open>
            <summary>Mission Intelligence & Expedition Log</summary>
            <p class="zone-narrative-intro">${zone.intro}</p>
            <ol class="stage-route">
              ${zone.stages.map((s, idx) => `
                <li>
                  <small>${idx === zone.stages.length - 1 ? 'FINAL BOSS' : s.kind.toUpperCase()}</small>
                  <b>${s.name}</b>
                  <span class="stage-hp">HP ~${s.hp}</span>
                </li>
              `).join('')}
            </ol>
            <p class="mission-warning">HP dan potion dibawa antar-wave. Hero yang tumbang tidak bangkit sampai kembali ke town. Bersiaplah sebelum melewati gerbang.</p>
          </details>

          <!-- Primary Departure Call-to-Action -->
          <div class="departure-actions">
            <button class="gold-button" data-depart="adventure" ${canEnter ? '' : 'disabled'}>
              Masuk ${zone.name}
            </button>
            <button class="secondary-button" data-facility="party">
              Atur skill & formasi
            </button>
          </div>
        </article>
      </div>

      <!-- Campaign Journal / Chronicles Drawer -->
      ${totalCleared > 0 ? `
        <details class="story-journal">
          <summary>Campaign Journal · ${totalCleared} recovered chapters</summary>
          <div class="journal-entries-grid">
            ${p.cleared.map(i => `
              <details class="journal-entry-card">
                <summary><b>CH ${String(i + 1).padStart(2, '0')}</b> · ${CAMPAIGN[i].name} <span class="seal-icon">⚜</span></summary>
                <div class="journal-entry-body">
                  <p class="journal-intro"><b>Prologue:</b> ${CAMPAIGN[i].intro}</p>
                  <p class="journal-outro"><b>Resolution:</b> ${CAMPAIGN[i].outro}</p>
                </div>
              </details>
            `).join('')}
          </div>
        </details>
      ` : ''}
    </div>
  `;
}
