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

// Stock stats for the default gun (M134) — see src/game/data/guns.ts, which
// owns every gun's stats/tracks now. Kept here as the literal baseline
// reference for that gun's entry.
export const BASE_WEAPON_STATS: WeaponStats = {
  damagePerShot: 9,
  coolPerSecond: 42,
  maxHeat: 100,
  fireIntervalMs: 70,
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

// Cost curve: cost(n) = k*(n^2+n+1). The original 3 costs (150, 350, 650)
// fit k=50 exactly; levels 4-10 continued that formula unchanged. Bumped to
// k=62 (2026-09-04) to close a rank-vs-gear balance gap: maxing all 4
// tracks previously finished at ~70% of the way to Colonel (1,000,000 XP),
// leaving credits idle for the last third of the rank grind with nothing
// left to spend them on. k=62 raises the all-4-tracks total from 90,000cr
// to 111,600cr, landing gear-maxing at ~87-88% of the Colonel climb
// (~10-15% idle) instead — see docs/PROGRESS.md for the full math. Applies
// per gun/track uniformly — see src/game/data/guns.ts.
export const LEVEL_COST = (n: number) => 62 * (n * n + n + 1)

/** The next level in a track the player hasn't bought yet, or null if maxed. Levels
 * within a track must be bought in order — this just walks levels[] in order. Works
 * unchanged whether ids are namespaced per-gun (`${gunId}-${track}-${level}`) or not,
 * since it only ever compares full ids against unlockedUpgrades. */
export function nextPurchasableLevel(track: UpgradeTrack, unlockedUpgrades: string[]): UpgradeLevel | null {
  const owned = new Set(unlockedUpgrades)
  return track.levels.find((l) => !owned.has(l.id)) ?? null
}
