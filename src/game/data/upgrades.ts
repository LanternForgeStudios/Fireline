export type UpgradeTrackId = 'damage' | 'cooling' | 'heatCapacity' | 'fireRate'

export interface UpgradeLevel {
  id: string
  track: UpgradeTrackId
  level: number
  cost: number
  label: string
}

export interface UpgradeTrack {
  id: UpgradeTrackId
  label: string
  description: string
  levels: UpgradeLevel[]
}

export interface WeaponStats {
  damagePerShot: number
  coolPerSecond: number
  maxHeat: number
  fireIntervalMs: number
}

// Stock stats — index 0 of each array below, matching Weapon.ts's original
// hardcoded values before upgrades existed.
export const BASE_WEAPON_STATS: WeaponStats = {
  damagePerShot: 9,
  coolPerSecond: 42,
  maxHeat: 100,
  fireIntervalMs: 70,
}

// [stock, level 1..10] — index by owned level (0 if none). Each track's
// original 3 levels were already a near-perfect geometric progression
// (e.g. heat capacity multiplies by ~1.207 every level) — levels 4-10
// extend that same ratio rather than inventing a new curve, per-level
// values independently rounded from stock * ratio^level (not compounded
// from the previous *rounded* value, which would drift off the curve).
const DAMAGE_VALUES = [9, 11, 13, 16, 19, 23, 28, 34, 41, 50, 61]
const COOLING_VALUES = [42, 52, 64, 80, 99, 123, 153, 189, 235, 291, 361]
const HEAT_CAPACITY_VALUES = [100, 120, 145, 175, 212, 256, 309, 373, 450, 543, 656]
const FIRE_RATE_VALUES = [70, 62, 55, 48, 43, 38, 33, 29, 26, 23, 20] // lower = faster

// Cost curve: cost(n) = k*(n^2+n+1). The original 3 costs (150, 350, 650)
// fit k=50 exactly; levels 4-10 continued that formula unchanged. Bumped to
// k=62 (2026-09-04) to close a rank-vs-gear balance gap: maxing all 4
// tracks previously finished at ~70% of the way to Colonel (1,000,000 XP),
// leaving credits idle for the last third of the rank grind with nothing
// left to spend them on. k=62 raises the all-4-tracks total from 90,000cr
// to 111,600cr, landing gear-maxing at ~87-88% of the Colonel climb
// (~10-15% idle) instead — see docs/PROGRESS.md for the full math.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const LEVEL_COST = (n: number) => 62 * (n * n + n + 1)

function buildLevels(track: UpgradeTrackId, namePrefix: string): UpgradeLevel[] {
  return ROMAN.map((numeral, i) => {
    const level = i + 1
    return { id: `${track}-${level}`, track, level, cost: LEVEL_COST(level), label: `${namePrefix} ${numeral}` }
  })
}

export const UPGRADE_TRACKS: UpgradeTrack[] = [
  {
    id: 'damage',
    label: 'Rounds',
    description: 'Heavier ammunition — more damage per hit.',
    levels: buildLevels('damage', 'AP Rounds'),
  },
  {
    id: 'cooling',
    label: 'Cooling',
    description: 'Better barrel cooling — heat bleeds off faster.',
    levels: buildLevels('cooling', 'Cooling Jacket'),
  },
  {
    id: 'heatCapacity',
    label: 'Heat Capacity',
    description: 'Reinforced receiver — more sustained fire before overheating.',
    levels: buildLevels('heatCapacity', 'Reinforced Receiver'),
  },
  {
    id: 'fireRate',
    label: 'Fire Rate',
    description: 'Tuned feed mechanism — shorter delay between shots.',
    levels: buildLevels('fireRate', 'Feed Tuning'),
  },
]

export const ALL_UPGRADES: UpgradeLevel[] = UPGRADE_TRACKS.flatMap((t) => t.levels)

function highestOwnedLevel(track: UpgradeTrackId, unlockedUpgrades: string[]): number {
  const owned = new Set(unlockedUpgrades)
  const t = UPGRADE_TRACKS.find((t) => t.id === track)!
  let level = 0
  for (const l of t.levels) if (owned.has(l.id)) level = l.level
  return level
}

/** The weapon's effective stats given everything a player has purchased. */
export function computeWeaponStats(unlockedUpgrades: string[]): WeaponStats {
  return {
    damagePerShot: DAMAGE_VALUES[highestOwnedLevel('damage', unlockedUpgrades)],
    coolPerSecond: COOLING_VALUES[highestOwnedLevel('cooling', unlockedUpgrades)],
    maxHeat: HEAT_CAPACITY_VALUES[highestOwnedLevel('heatCapacity', unlockedUpgrades)],
    fireIntervalMs: FIRE_RATE_VALUES[highestOwnedLevel('fireRate', unlockedUpgrades)],
  }
}

/** The next level in a track the player hasn't bought yet, or null if maxed. Levels
 * within a track must be bought in order — this just walks levels[] in order. */
export function nextPurchasableLevel(track: UpgradeTrack, unlockedUpgrades: string[]): UpgradeLevel | null {
  const owned = new Set(unlockedUpgrades)
  return track.levels.find((l) => !owned.has(l.id)) ?? null
}
