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
    // Clear midday desert — the baseline look.
    theme: {
      landscape: 'desert',
      skyTop: 0xf7d9a0,
      skyBottom: 0xf2b26b,
      mountainTint: 0xffffff,
      mountainAlpha: 0.75,
      groundTint: 0xffffff,
    },
    secondaryObjective: { type: 'clean-sweep', label: 'Clean Sweep — destroy every contact', bonusCredits: 100 },
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
    // Hazy, dust-choked midday over the ruined outskirts of a city — the convoy's
    // route runs through it, not around it.
    theme: {
      landscape: 'urban',
      skyTop: 0xe4d2a8,
      skyBottom: 0xc9a878,
      mountainTint: 0xd8c39a,
      mountainAlpha: 0.55,
      groundTint: 0xe8dcc0,
    },
    secondaryObjective: { type: 'no-damage', label: 'Untouched — take zero aircraft damage', bonusCredits: 90 },
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
    id: 'operation-green-hell',
    name: 'Operation Green Hell',
    type: 'Rescue',
    briefing:
      "A recon team went dark under the canopy six hours ago. Their beacon's still pinging, faint and getting fainter — get in low, punch through whatever's dug in between here and them, and get them out before the jungle finishes the job the enemy started.",
    // Humid late-afternoon haze under a warm, hazy sky — pairs with the
    // jungle backdrop's own baked-in sunset (palm silhouettes, sun glow).
    // A light warm-green ground tint unifies with the foliage tile itself.
    theme: {
      landscape: 'jungle',
      skyTop: 0xf2d99b,
      skyBottom: 0xd97a3f,
      mountainTint: 0xffffff,
      mountainAlpha: 0.8,
      groundTint: 0xd8e6b8,
    },
    secondaryObjective: { type: 'no-damage', label: 'Untouched — take zero aircraft damage', bonusCredits: 95 },
    waves: [
      {
        name: 'Undergrowth Contact',
        spawns: [
          { enemyType: 'infantry', delayMs: 0 },
          { enemyType: 'infantry', delayMs: 1400 },
          { enemyType: 'infantry', delayMs: 3000 },
        ],
      },
      {
        name: 'Flanking Patrol',
        spawns: [
          { enemyType: 'gunner', delayMs: 0 },
          { enemyType: 'infantry', delayMs: 1200 },
          { enemyType: 'rocket', delayMs: 2600 },
          { enemyType: 'infantry', delayMs: 3600 },
          { enemyType: 'drone', delayMs: 4800 },
        ],
      },
      {
        name: 'River Crossing',
        spawns: [
          { enemyType: 'technical', delayMs: 0 },
          { enemyType: 'drone', delayMs: 1400 },
          { enemyType: 'gunner', delayMs: 2400 },
          { enemyType: 'rocket', delayMs: 3400 },
          { enemyType: 'drone', delayMs: 4400 },
          { enemyType: 'technical', delayMs: 5400 },
        ],
      },
      {
        name: 'LZ Secure',
        spawns: [
          { enemyType: 'gunner', delayMs: 0 },
          { enemyType: 'armored', delayMs: 1200 },
          { enemyType: 'rocket', delayMs: 2600 },
          { enemyType: 'commander', delayMs: 3800 },
          { enemyType: 'gunner', delayMs: 5200 },
          { enemyType: 'drone', delayMs: 5800 },
          { enemyType: 'rocket', delayMs: 6800 },
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
    // Dusk over the water — the mission's namesake, and the LZ is a coastal
    // extraction point. Darkest, most urgent-feeling of the three.
    // groundTint left neutral (0xffffff, same as Firebreak) — the tan
    // 0xa9836e multiply was tuned for the old ground texture; the new
    // seamless water tile (see docs/ART_ASSETS.md) is a lavender-blue that
    // clashes when tinted warm, so it shows its true color instead.
    theme: {
      landscape: 'coastal',
      skyTop: 0x6b4a6e,
      skyBottom: 0xd9784e,
      mountainTint: 0x8a5a6e,
      mountainAlpha: 0.9,
      groundTint: 0xffffff,
    },
    secondaryObjective: { type: 'clean-sweep', label: 'Clean Sweep — destroy every contact', bonusCredits: 90 },
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
