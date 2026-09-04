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

// Mirrors each mission's secondaryObjective.bonusCredits in
// src/game/data/missions.ts.
const SECONDARY_OBJECTIVE_BONUS: Record<string, number> = {
  'operation-firebreak': 100,
  'operation-steel-convoy': 90,
  'operation-green-hell': 95,
  'operation-nightfall': 90,
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
  'operation-green-hell': [
    ['infantry', 'infantry', 'infantry'],
    ['gunner', 'infantry', 'rocket', 'infantry', 'drone'],
    ['technical', 'drone', 'gunner', 'rocket', 'drone', 'technical'],
    ['gunner', 'armored', 'rocket', 'commander', 'gunner', 'drone', 'rocket'],
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
  secondaryObjectiveBonus: number
}

// Procedurally generated missions (src/game/generation/generateMission.ts)
// use ids like "random-<seed>" — there's no finite catalog to enumerate
// them against. Rather than porting the whole seeded generator here (a
// second implementation that could drift out of sync with the client's and
// either wrongly reject real plays or under-validate), use a generous but
// finite ceiling derived from the generator's own caps: no more waves or
// enemies-per-wave than it can ever produce, at the single highest-value
// enemy type for every slot. Real generated missions score far below this;
// it just bounds the worst case a tampered submission could claim.
// Mirrors src/game/generation/generateMission.ts (MAX_WAVES) and
// waveGenerator.ts (MAX_SPAWNS_PER_WAVE) — update together if those change.
const RANDOM_MISSION_PREFIX = 'random-'
const RANDOM_MISSION_MAX_WAVES = 6
const RANDOM_MISSION_MAX_SPAWNS_PER_WAVE = 12

function randomMissionBounds(): MissionBounds {
  const highestEnemyScore = Math.max(...Object.values(ENEMY_SCORE_VALUES))
  const maxEnemies = RANDOM_MISSION_MAX_WAVES * RANDOM_MISSION_MAX_SPAWNS_PER_WAVE
  const maxScore = maxEnemies * highestEnemyScore
  return {
    totalWaves: RANDOM_MISSION_MAX_WAVES,
    maxEnemies,
    maxScore,
    // Mirrors generateMission.ts's generateSecondaryObjective formula (~20%
    // of a hypothetical full-clear's credits), applied to this same
    // generous ceiling rather than the mission's real (much lower) score.
    secondaryObjectiveBonus: Math.round((maxScore / 10) * 0.2),
  }
}

export function getMissionBounds(missionId: string): MissionBounds | null {
  const waves = MISSION_WAVES[missionId]
  if (waves) {
    let maxScore = 0
    let maxEnemies = 0
    for (const wave of waves) {
      for (const enemyType of wave) {
        maxScore += ENEMY_SCORE_VALUES[enemyType] ?? 0
        maxEnemies += 1
      }
    }
    return { totalWaves: waves.length, maxScore, maxEnemies, secondaryObjectiveBonus: SECONDARY_OBJECTIVE_BONUS[missionId] ?? 0 }
  }

  if (missionId.startsWith(RANDOM_MISSION_PREFIX)) {
    return randomMissionBounds()
  }

  return null
}
