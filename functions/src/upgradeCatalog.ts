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

// Cost curve mirrors src/game/data/upgrades.ts: cost(n) = k*(n^2+n+1), k=62
// as of 2026-09-04 (was 50) to close a rank-vs-gear balance gap — see that
// file's comment for the full reasoning.
const LEVEL_COST = (n: number): number => 62 * (n * n + n + 1)

function buildLevels(track: string): UpgradeInfo[] {
  return Array.from({ length: 10 }, (_, i) => {
    const level = i + 1
    return { id: `${track}-${level}`, track, level, cost: LEVEL_COST(level) }
  })
}

export const ALL_UPGRADES: UpgradeInfo[] = [
  ...buildLevels('damage'),
  ...buildLevels('cooling'),
  ...buildLevels('heatCapacity'),
  ...buildLevels('fireRate'),
]

export function getUpgrade(id: string): UpgradeInfo | undefined {
  return ALL_UPGRADES.find((u) => u.id === id)
}

/** Every level in the same track below this one's level — all must already be owned. */
export function priorLevelsOf(upgrade: UpgradeInfo): UpgradeInfo[] {
  return ALL_UPGRADES.filter((u) => u.track === upgrade.track && u.level < upgrade.level)
}
