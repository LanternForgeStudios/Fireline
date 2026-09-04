import { LEVEL_COST, ROMAN, type UpgradeLevel, type UpgradeTrack, type UpgradeTrackId, type WeaponStats } from './upgrades'

export interface RecoilProfile {
  /** Upward pixel offset at heat==maxHeat (heatFraction==1). */
  maxClimbPx: number
  /** Exponent applied to heatFraction before scaling by maxClimbPx — >1 keeps the
   * climb subtle early and steep near overheat; 1 = linear. */
  curve: number
}

/** Either a literal 11-length [stock..level10] array (used for the M134 to guarantee
 * zero numeric drift from its already-shipped/tuned values), or a {stock, ratio} pair
 * the generator expands — the reusable authoring path for every new gun. */
export type GunTrackConfig = { values: number[] } | { stock: number; ratio: number }

export interface GunDef {
  id: string
  name: string
  description: string
  icon: string // ui/${icon}, e.g. 'icon-gun-m134.png'
  baseStats: WeaponStats
  /** Not upgradeable by any track — a fixed per-gun trait. */
  heatPerShot: number
  allowedTracks: UpgradeTrackId[]
  trackConfig: Partial<Record<UpgradeTrackId, GunTrackConfig>>
  recoil: RecoilProfile
  zoom: { enabled: boolean; factor: number }
  /** Credits to unlock. 0 for the starter gun (owned from account creation). */
  unlockCost: number
}

const TRACK_STAT_FIELD: Record<UpgradeTrackId, keyof WeaponStats> = {
  damage: 'damagePerShot',
  cooling: 'coolPerSecond',
  heatCapacity: 'maxHeat',
  fireRate: 'fireIntervalMs',
}

const TRACK_META: Record<UpgradeTrackId, { label: string; description: string; namePrefix: string }> = {
  damage: { label: 'Rounds', description: 'Heavier ammunition — more damage per hit.', namePrefix: 'AP Rounds' },
  cooling: { label: 'Cooling', description: 'Better barrel cooling — heat bleeds off faster.', namePrefix: 'Cooling Jacket' },
  heatCapacity: {
    label: 'Heat Capacity',
    description: 'Reinforced receiver — more sustained fire before overheating.',
    namePrefix: 'Reinforced Receiver',
  },
  fireRate: { label: 'Fire Rate', description: 'Tuned feed mechanism — shorter delay between shots.', namePrefix: 'Feed Tuning' },
}

function expandTrackValues(cfg: GunTrackConfig): number[] {
  if ('values' in cfg) return cfg.values
  return Array.from({ length: 11 }, (_, i) => Math.round(cfg.stock * Math.pow(cfg.ratio, i)))
}

/** The weapon's effective stats for a specific gun given everything owned. Tracks the
 * gun doesn't allow simply stay at baseStats — no entry ever exists for them. */
export function computeGunStats(gun: GunDef, unlockedUpgrades: string[]): WeaponStats {
  const owned = new Set(unlockedUpgrades)
  const stats: WeaponStats = { ...gun.baseStats }
  for (const track of gun.allowedTracks) {
    const cfg = gun.trackConfig[track]
    if (!cfg) continue
    const values = expandTrackValues(cfg)
    let level = 0
    for (let l = 1; l <= 10; l++) if (owned.has(`${gun.id}-${track}-${l}`)) level = l
    stats[TRACK_STAT_FIELD[track]] = values[level]
  }
  return stats
}

/** This gun's upgrade tree, scoped to its allowedTracks, with `${gunId}-${track}-${level}` ids. */
export function gunUpgradeTracks(gun: GunDef): UpgradeTrack[] {
  return gun.allowedTracks.map((track) => {
    const namePrefix = TRACK_META[track].namePrefix
    const levels: UpgradeLevel[] = ROMAN.map((numeral, i) => {
      const level = i + 1
      return { id: `${gun.id}-${track}-${level}`, track, level, cost: LEVEL_COST(level), label: `${namePrefix} ${numeral}` }
    })
    return { id: track, label: TRACK_META[track].label, description: TRACK_META[track].description, levels }
  })
}

export const DEFAULT_GUN_ID = 'm134'

export const GUN_DEFS: Record<string, GunDef> = {
  m134: {
    id: 'm134',
    name: 'M134 Minigun',
    description: 'The standard-issue door gun. Balanced in every stat and upgradeable across all four systems — a solid all-rounder with no glaring weakness.',
    icon: 'icon-gun-m134.png',
    baseStats: { damagePerShot: 9, coolPerSecond: 42, maxHeat: 100, fireIntervalMs: 70 },
    heatPerShot: 6,
    allowedTracks: ['damage', 'cooling', 'heatCapacity', 'fireRate'],
    trackConfig: {
      damage: { values: [9, 11, 13, 16, 19, 23, 28, 34, 41, 50, 61] },
      cooling: { values: [42, 52, 64, 80, 99, 123, 153, 189, 235, 291, 361] },
      heatCapacity: { values: [100, 120, 145, 175, 212, 256, 309, 373, 450, 543, 656] },
      fireRate: { values: [70, 62, 55, 48, 43, 38, 33, 29, 26, 23, 20] },
    },
    recoil: { maxClimbPx: 40, curve: 1.4 },
    zoom: { enabled: false, factor: 1 },
    unlockCost: 0,
  },

  m60: {
    id: 'm60',
    name: 'M60 "Long Gun"',
    description: 'Slower cyclic rate, hits far harder per round. No feed-tuning track — its mechanical pace is its identity, not something to grind away.',
    icon: 'icon-gun-m60.png',
    baseStats: { damagePerShot: 22, coolPerSecond: 30, maxHeat: 70, fireIntervalMs: 160 },
    heatPerShot: 10,
    allowedTracks: ['damage', 'cooling', 'heatCapacity'],
    trackConfig: {
      damage: { stock: 22, ratio: 1.211 },
      cooling: { stock: 30, ratio: 1.211 },
      heatCapacity: { stock: 70, ratio: 1.207 },
    },
    recoil: { maxClimbPx: 70, curve: 1.2 },
    zoom: { enabled: false, factor: 1 },
    unlockCost: 9000,
  },

  gau19: {
    id: 'gau19',
    name: 'GAU-19 ".50 Cal"',
    description: 'A magnified precision weapon for picking off armored/priority targets. Tiny heat pool, no cooling jacket or feed tuning to lean on — every shot has to count.',
    icon: 'icon-gun-gau19.png',
    baseStats: { damagePerShot: 26, coolPerSecond: 20, maxHeat: 40, fireIntervalMs: 220 },
    heatPerShot: 14,
    allowedTracks: ['damage', 'heatCapacity'],
    trackConfig: {
      damage: { stock: 26, ratio: 1.211 },
      heatCapacity: { stock: 40, ratio: 1.207 },
    },
    recoil: { maxClimbPx: 55, curve: 1.6 },
    zoom: { enabled: true, factor: 1.6 },
    unlockCost: 14000,
  },

  saw: {
    id: 'saw',
    name: 'M249 SAW',
    description: 'High cyclic rate, light rounds — built to keep a wall of fire up, not to hit hard. Only feed tuning and cooling are worth investing in.',
    icon: 'icon-gun-saw.png',
    baseStats: { damagePerShot: 5, coolPerSecond: 55, maxHeat: 130, fireIntervalMs: 45 },
    heatPerShot: 4,
    allowedTracks: ['fireRate', 'cooling'],
    trackConfig: {
      fireRate: { stock: 45, ratio: 1 / 1.13 },
      cooling: { stock: 55, ratio: 1.211 },
    },
    recoil: { maxClimbPx: 25, curve: 1.8 },
    zoom: { enabled: false, factor: 1 },
    unlockCost: 6000,
  },
}

export function getGunDef(id: string): GunDef {
  return GUN_DEFS[id] ?? GUN_DEFS[DEFAULT_GUN_ID]
}
