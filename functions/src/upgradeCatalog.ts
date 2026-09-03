/**
 * Server-side mirror of src/game/data/upgrades.ts — only what's needed to
 * validate a purchase (id, track, level, cost), not the flavor labels.
 * Same hand-sync situation as missionCatalog.ts: Cloud Functions deploy as
 * a separate package from the Vite frontend. Update together.
 */
export interface UpgradeInfo {
  id: string
  track: string
  level: number
  cost: number
}

export const ALL_UPGRADES: UpgradeInfo[] = [
  { id: 'damage-1', track: 'damage', level: 1, cost: 150 },
  { id: 'damage-2', track: 'damage', level: 2, cost: 350 },
  { id: 'damage-3', track: 'damage', level: 3, cost: 650 },
  { id: 'cooling-1', track: 'cooling', level: 1, cost: 150 },
  { id: 'cooling-2', track: 'cooling', level: 2, cost: 350 },
  { id: 'cooling-3', track: 'cooling', level: 3, cost: 650 },
  { id: 'heatCapacity-1', track: 'heatCapacity', level: 1, cost: 150 },
  { id: 'heatCapacity-2', track: 'heatCapacity', level: 2, cost: 350 },
  { id: 'heatCapacity-3', track: 'heatCapacity', level: 3, cost: 650 },
  { id: 'fireRate-1', track: 'fireRate', level: 1, cost: 150 },
  { id: 'fireRate-2', track: 'fireRate', level: 2, cost: 350 },
  { id: 'fireRate-3', track: 'fireRate', level: 3, cost: 650 },
]

export function getUpgrade(id: string): UpgradeInfo | undefined {
  return ALL_UPGRADES.find((u) => u.id === id)
}

/** Every level in the same track below this one's level — all must already be owned. */
export function priorLevelsOf(upgrade: UpgradeInfo): UpgradeInfo[] {
  return ALL_UPGRADES.filter((u) => u.track === upgrade.track && u.level < upgrade.level)
}
