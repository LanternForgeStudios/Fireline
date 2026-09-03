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

// [stock, level 1, level 2, level 3] — index by owned level (0 if none).
const DAMAGE_VALUES = [9, 11, 13, 16]
const COOLING_VALUES = [42, 52, 64, 80]
const HEAT_CAPACITY_VALUES = [100, 120, 145, 175]
const FIRE_RATE_VALUES = [70, 62, 55, 48] // lower = faster

export const UPGRADE_TRACKS: UpgradeTrack[] = [
  {
    id: 'damage',
    label: 'Rounds',
    description: 'Heavier ammunition — more damage per hit.',
    levels: [
      { id: 'damage-1', track: 'damage', level: 1, cost: 150, label: 'AP Rounds I' },
      { id: 'damage-2', track: 'damage', level: 2, cost: 350, label: 'AP Rounds II' },
      { id: 'damage-3', track: 'damage', level: 3, cost: 650, label: 'AP Rounds III' },
    ],
  },
  {
    id: 'cooling',
    label: 'Cooling',
    description: 'Better barrel cooling — heat bleeds off faster.',
    levels: [
      { id: 'cooling-1', track: 'cooling', level: 1, cost: 150, label: 'Cooling Jacket I' },
      { id: 'cooling-2', track: 'cooling', level: 2, cost: 350, label: 'Cooling Jacket II' },
      { id: 'cooling-3', track: 'cooling', level: 3, cost: 650, label: 'Cooling Jacket III' },
    ],
  },
  {
    id: 'heatCapacity',
    label: 'Heat Capacity',
    description: 'Reinforced receiver — more sustained fire before overheating.',
    levels: [
      { id: 'heatCapacity-1', track: 'heatCapacity', level: 1, cost: 150, label: 'Reinforced Receiver I' },
      { id: 'heatCapacity-2', track: 'heatCapacity', level: 2, cost: 350, label: 'Reinforced Receiver II' },
      { id: 'heatCapacity-3', track: 'heatCapacity', level: 3, cost: 650, label: 'Reinforced Receiver III' },
    ],
  },
  {
    id: 'fireRate',
    label: 'Fire Rate',
    description: 'Tuned feed mechanism — shorter delay between shots.',
    levels: [
      { id: 'fireRate-1', track: 'fireRate', level: 1, cost: 150, label: 'Feed Tuning I' },
      { id: 'fireRate-2', track: 'fireRate', level: 2, cost: 350, label: 'Feed Tuning II' },
      { id: 'fireRate-3', track: 'fireRate', level: 3, cost: 650, label: 'Feed Tuning III' },
    ],
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
