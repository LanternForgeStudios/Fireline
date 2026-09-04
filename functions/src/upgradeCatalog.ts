/**
 * Server-side mirror of src/game/data/guns.ts's per-gun upgrade tracks —
 * only what's needed to validate a purchase (id, gunId, track, level, cost),
 * not the flavor labels or stat curves (cost is the same formula everywhere,
 * regardless of what stat a track actually grants). Same hand-sync situation
 * as missionCatalog.ts: Cloud Functions deploy as a separate package from
 * the Vite frontend. Update together.
 */
export interface UpgradeInfo {
  id: string
  gunId: string
  track: string
  level: number
  cost: number
}

// Cost curve mirrors src/game/data/upgrades.ts: cost(n) = k*(n^2+n+1), k=62
// as of 2026-09-04 — see that file's comment for the full reasoning.
const LEVEL_COST = (n: number): number => 62 * (n * n + n + 1)

// Mirrors each GunDef.allowedTracks in src/game/data/guns.ts — hand-synced,
// same convention as missionCatalog.ts. Update both when adding a gun.
const GUN_ALLOWED_TRACKS: Record<string, string[]> = {
  m134: ['damage', 'cooling', 'heatCapacity', 'fireRate'],
  m60: ['damage', 'cooling', 'heatCapacity'],
  gau19: ['damage', 'heatCapacity'],
  saw: ['fireRate', 'cooling'],
}

function buildLevels(gunId: string, track: string): UpgradeInfo[] {
  return Array.from({ length: 10 }, (_, i) => {
    const level = i + 1
    return { id: `${gunId}-${track}-${level}`, gunId, track, level, cost: LEVEL_COST(level) }
  })
}

export const ALL_UPGRADES: UpgradeInfo[] = Object.entries(GUN_ALLOWED_TRACKS).flatMap(([gunId, tracks]) =>
  tracks.flatMap((track) => buildLevels(gunId, track)),
)

export function getUpgrade(id: string): UpgradeInfo | undefined {
  return ALL_UPGRADES.find((u) => u.id === id)
}

/** Every lower level in the same gun+track — all must already be owned. */
export function priorLevelsOf(upgrade: UpgradeInfo): UpgradeInfo[] {
  return ALL_UPGRADES.filter((u) => u.gunId === upgrade.gunId && u.track === upgrade.track && u.level < upgrade.level)
}
