/**
 * Server-side mirror of src/game/data/guns.ts — only what's needed to
 * validate a gun purchase (id, cost), not stats/flavor. Same hand-sync
 * situation as missionCatalog.ts/upgradeCatalog.ts: Cloud Functions deploy
 * as a separate package from the Vite frontend. Update together.
 */
export interface GunInfo {
  id: string
  cost: number
}

export const ALL_GUNS: GunInfo[] = [
  { id: 'm134', cost: 0 },
  { id: 'm60', cost: 9000 },
  { id: 'gau19', cost: 14000 },
  { id: 'saw', cost: 6000 },
]

export function getGun(id: string): GunInfo | undefined {
  return ALL_GUNS.find((g) => g.id === id)
}
