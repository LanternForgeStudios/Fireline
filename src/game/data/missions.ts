import type { MissionDef } from '../types'

/**
 * Hand-authored missions for the Phase 2 "mission variety" milestone. The
 * GDD's procedural generator (seeded random encounter blocks, threat
 * budgets, weather) is Phase 3 of the roadmap — these stand in for it so
 * mission-to-mission variety exists before that generator is built.
 */
export const MISSIONS: MissionDef[] = [
  {
    id: 'operation-firebreak',
    name: 'Operation Firebreak',
    type: 'Search & Destroy',
    briefing:
      'Hostile forces are massing near the ridge line. Ride shotgun, clear each wave of contacts, and keep the bird in the air until the area is secured.',
    waves: [
      {
        name: 'Contact',
        spawns: [
          { enemyType: 'infantry', delayMs: 0 },
          { enemyType: 'infantry', delayMs: 1400 },
          { enemyType: 'infantry', delayMs: 3200 },
        ],
      },
      {
        name: 'Reinforcements',
        spawns: [
          { enemyType: 'infantry', delayMs: 0 },
          { enemyType: 'gunner', delayMs: 1000 },
          { enemyType: 'infantry', delayMs: 2400 },
          { enemyType: 'gunner', delayMs: 3600 },
          { enemyType: 'drone', delayMs: 5000 },
        ],
      },
      {
        name: 'Armor Up',
        spawns: [
          { enemyType: 'gunner', delayMs: 0 },
          { enemyType: 'technical', delayMs: 1200 },
          { enemyType: 'rocket', delayMs: 2800 },
          { enemyType: 'drone', delayMs: 4000 },
          { enemyType: 'drone', delayMs: 4600 },
          { enemyType: 'technical', delayMs: 6000 },
        ],
      },
      {
        name: 'Heavy Resistance',
        spawns: [
          { enemyType: 'armored', delayMs: 0 },
          { enemyType: 'rocket', delayMs: 1500 },
          { enemyType: 'gunner', delayMs: 2600 },
          { enemyType: 'technical', delayMs: 3800 },
          { enemyType: 'drone', delayMs: 4800 },
          { enemyType: 'rocket', delayMs: 6200 },
          { enemyType: 'armored', delayMs: 7400 },
        ],
      },
      {
        name: 'Commander Sighted',
        spawns: [
          { enemyType: 'gunner', delayMs: 0 },
          { enemyType: 'gunner', delayMs: 1000 },
          { enemyType: 'technical', delayMs: 2200 },
          { enemyType: 'commander', delayMs: 3600 },
          { enemyType: 'drone', delayMs: 5200 },
          { enemyType: 'drone', delayMs: 5800 },
          { enemyType: 'rocket', delayMs: 7000 },
        ],
      },
    ],
  },
  {
    id: 'operation-steel-convoy',
    name: 'Operation Steel Convoy',
    type: 'Escort',
    briefing:
      'A supply convoy is running the pass below. Recon drones will spot it long before the technicals reach it — keep the sky over the convoy clear from first contact to the far checkpoint.',
    waves: [
      {
        name: 'Recon Sweep',
        spawns: [
          { enemyType: 'drone', delayMs: 0 },
          { enemyType: 'drone', delayMs: 1800 },
          { enemyType: 'infantry', delayMs: 3000 },
        ],
      },
      {
        name: 'Flanking Riders',
        spawns: [
          { enemyType: 'technical', delayMs: 0 },
          { enemyType: 'drone', delayMs: 1200 },
          { enemyType: 'technical', delayMs: 2600 },
          { enemyType: 'infantry', delayMs: 3800 },
          { enemyType: 'infantry', delayMs: 4400 },
        ],
      },
      {
        name: 'Ambush',
        spawns: [
          { enemyType: 'rocket', delayMs: 0 },
          { enemyType: 'gunner', delayMs: 900 },
          { enemyType: 'rocket', delayMs: 2200 },
          { enemyType: 'technical', delayMs: 3400 },
          { enemyType: 'drone', delayMs: 4200 },
          { enemyType: 'drone', delayMs: 4800 },
        ],
      },
      {
        name: 'Checkpoint Push',
        spawns: [
          { enemyType: 'armored', delayMs: 0 },
          { enemyType: 'technical', delayMs: 1400 },
          { enemyType: 'rocket', delayMs: 2600 },
          { enemyType: 'gunner', delayMs: 3600 },
          { enemyType: 'gunner', delayMs: 4200 },
          { enemyType: 'commander', delayMs: 5600 },
        ],
      },
    ],
  },
  {
    id: 'operation-nightfall',
    name: 'Operation Nightfall',
    type: 'Extraction',
    briefing:
      "The ground team is exposed and the extraction window is short. This one's fast and ugly — hostiles are already converging by the time you're on station. Clear the LZ and hold it.",
    waves: [
      {
        name: 'LZ Hot',
        spawns: [
          { enemyType: 'infantry', delayMs: 0 },
          { enemyType: 'gunner', delayMs: 800 },
          { enemyType: 'infantry', delayMs: 1600 },
          { enemyType: 'drone', delayMs: 2600 },
        ],
      },
      {
        name: 'Closing In',
        spawns: [
          { enemyType: 'technical', delayMs: 0 },
          { enemyType: 'rocket', delayMs: 1200 },
          { enemyType: 'gunner', delayMs: 2000 },
          { enemyType: 'drone', delayMs: 2800 },
          { enemyType: 'drone', delayMs: 3400 },
          { enemyType: 'technical', delayMs: 4400 },
        ],
      },
      {
        name: 'Last Stand',
        spawns: [
          { enemyType: 'commander', delayMs: 0 },
          { enemyType: 'armored', delayMs: 1000 },
          { enemyType: 'rocket', delayMs: 2200 },
          { enemyType: 'rocket', delayMs: 2800 },
          { enemyType: 'gunner', delayMs: 3800 },
          { enemyType: 'gunner', delayMs: 4400 },
          { enemyType: 'armored', delayMs: 5600 },
        ],
      },
    ],
  },
]

export const DEFAULT_MISSION = MISSIONS[0]
