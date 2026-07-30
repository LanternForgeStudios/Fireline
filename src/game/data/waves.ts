import type { MissionDef } from '../types'

/**
 * Static mission for the Phase 1 combat prototype. The GDD's procedural
 * generator (seeded random encounter blocks, threat budgets, weather) is
 * Phase 3 of the roadmap; this hand-authored mission stands in for it so
 * the combat loop can be built and played end-to-end first.
 */
export const PROTOTYPE_MISSION: MissionDef = {
  id: 'prototype-01',
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
}
