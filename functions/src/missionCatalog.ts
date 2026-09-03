/**
 * Server-side mirror of the mission/enemy data used to validate submitted
 * mission results. Cloud Functions run as a separate deployable package
 * from the Vite frontend, so this can't just import src/game/data directly
 * — keep it in sync by hand.
 *
 * Only what's needed for validation is duplicated: per-wave enemy type
 * lists (dropping delayMs/flavor text) so maxPossibleScore/totalEnemyCount
 * are computed here rather than hand-derived, which is easier to verify
 * against src/game/data/missions.ts by eye (same enemyType sequence per
 * wave) and harder to get subtly wrong than pre-computed totals would be.
 *
 * If src/game/data/missions.ts or enemyTypes.ts changes, update this file
 * to match — the `cleanup` skill checks for this drift.
 */

// Mirrors src/game/data/enemyTypes.ts's scoreValue field.
export const ENEMY_SCORE_VALUES: Record<string, number> = {
  infantry: 50,
  gunner: 100,
  rocket: 150,
  technical: 220,
  armored: 350,
  drone: 120,
  commander: 600,
}

// Mirrors src/game/data/missions.ts: each mission is an array of waves,
// each wave an array of the enemy types it spawns (order/count matches the
// source's `spawns`, delayMs dropped since only totals matter here).
const MISSION_WAVES: Record<string, string[][]> = {
  'operation-firebreak': [
    ['infantry', 'infantry', 'infantry'],
    ['infantry', 'gunner', 'infantry', 'gunner', 'drone'],
    ['gunner', 'technical', 'rocket', 'drone', 'drone', 'technical'],
    ['armored', 'rocket', 'gunner', 'technical', 'drone', 'rocket', 'armored'],
    ['gunner', 'gunner', 'technical', 'commander', 'drone', 'drone', 'rocket'],
  ],
  'operation-steel-convoy': [
    ['drone', 'drone', 'infantry'],
    ['technical', 'drone', 'technical', 'infantry', 'infantry'],
    ['rocket', 'gunner', 'rocket', 'technical', 'drone', 'drone'],
    ['armored', 'technical', 'rocket', 'gunner', 'gunner', 'commander'],
  ],
  'operation-nightfall': [
    ['infantry', 'gunner', 'infantry', 'drone'],
    ['technical', 'rocket', 'gunner', 'drone', 'drone', 'technical'],
    ['commander', 'armored', 'rocket', 'rocket', 'gunner', 'gunner', 'armored'],
  ],
}

export interface MissionBounds {
  totalWaves: number
  maxScore: number
  maxEnemies: number
}

export function getMissionBounds(missionId: string): MissionBounds | null {
  const waves = MISSION_WAVES[missionId]
  if (!waves) return null

  let maxScore = 0
  let maxEnemies = 0
  for (const wave of waves) {
    for (const enemyType of wave) {
      maxScore += ENEMY_SCORE_VALUES[enemyType] ?? 0
      maxEnemies += 1
    }
  }

  return { totalWaves: waves.length, maxScore, maxEnemies }
}
