import { ENEMY_DEFS } from '../data/enemyTypes'
import type { LandscapeId, MissionDef, MissionMode, SecondaryObjective, SecondaryObjectiveType, WaveDef } from '../types'
import { generateBriefing, generateMissionName, MISSION_TYPES } from './briefingTemplates'
import { generateHoverField } from './coverGenerator'
import { randomSeed, SeededRandom } from './rng'
import { generateWave, waveBudget } from './waveGenerator'
import { WEATHER_PRESETS } from './weatherThemes'

const BASE_BUDGET = 7
const BUDGET_GROWTH = 1.28
const MIN_WAVES = 4
const MAX_WAVES = 6

// Independent of weather mood — a generated mission can land on any
// landscape/weather combination (e.g. an overcast day at the coast, a dusty
// haze downtown). Not curated for "sensible" pairings; the tint tuning in
// WEATHER_PRESETS was done against the desert art, so some combinations
// (esp. the warmer sand-toned presets over coastal's blue water) will read
// a bit muddier than a hand-picked pairing — acceptable variance for a
// first pass, worth a look once there's real art for all four landscapes
// in front of someone.
const LANDSCAPES: LandscapeId[] = ['desert', 'coastal', 'urban', 'jungle']

const OBJECTIVE_LABELS: Record<SecondaryObjectiveType, string> = {
  'no-damage': 'Untouched — take zero aircraft damage',
  'clean-sweep': 'Clean Sweep — destroy every contact',
  'protect-objective': '', // built dynamically in generateSecondaryObjective, folds in the objective's flavor name
}

// 'protect-objective' only makes sense when there's a defended ground objective to protect
// (hover missions) — excluding it from the flight pool keeps every OBJECTIVE_LABELS lookup
// meaningful. no-damage/clean-sweep both stay valid in hover missions too, since aircraft
// risk stays real there (see CombatScene.spawnEnemyProjectile's drone exception).
const FLIGHT_OBJECTIVE_POOL: SecondaryObjectiveType[] = ['no-damage', 'clean-sweep']
const HOVER_OBJECTIVE_POOL: SecondaryObjectiveType[] = ['no-damage', 'clean-sweep', 'protect-objective']

/** Deterministic: the same seed always produces the same mission (GDD calls
 * for "seeded random generation"). RANDOM_MISSION_ID_PREFIX is what lets
 * both the UI and the Cloud Functions reward-bounds check (see
 * functions/src/missionCatalog.ts) recognize a generated mission by id
 * shape rather than needing every seed pre-registered somewhere. */
export const RANDOM_MISSION_ID_PREFIX = 'random-'

function generateSecondaryObjective(
  rng: SeededRandom,
  waves: WaveDef[],
  mode: MissionMode,
  objectiveLabel?: string,
): SecondaryObjective {
  const type = rng.pick<SecondaryObjectiveType>(mode === 'hover' ? HOVER_OBJECTIVE_POOL : FLIGHT_OBJECTIVE_POOL)
  const maxScore = waves.reduce(
    (sum, wave) => sum + wave.spawns.reduce((s, spawn) => s + ENEMY_DEFS[spawn.enemyType].scoreValue, 0),
    0,
  )
  // Roughly a fifth of what a hypothetical full-clear would earn in credits
  // (creditsEarned = round(score/10) elsewhere) — a meaningful bonus without
  // dwarfing the base reward. Not tuned against real play — see docs.
  const bonusCredits = Math.round((maxScore / 10) * 0.2)
  const label =
    type === 'protect-objective'
      ? `Objective Secure — never let the ${objectiveLabel} take damage`
      : OBJECTIVE_LABELS[type]
  return { type, label, bonusCredits }
}

export function generateMission(seed: number = randomSeed()): MissionDef {
  const rng = new SeededRandom(seed)

  const type = rng.pick(MISSION_TYPES)
  // No new RNG draw — mode falls out of the already-picked type, so every seed that
  // doesn't roll 'Base Defense' produces byte-identical output to before hover missions
  // existed. 'Base Defense' was previously inert flavor text with no mechanical effect,
  // so there's no prior mission at those seeds worth preserving determinism against.
  const mode: MissionMode = type === 'Base Defense' ? 'hover' : 'flight'
  const totalWaves = rng.int(MIN_WAVES, MAX_WAVES)
  const usedWaveNames = new Set<string>()
  const waves = Array.from({ length: totalWaves }, (_, i) =>
    generateWave(rng, i, waveBudget(i, BASE_BUDGET, BUDGET_GROWTH), usedWaveNames),
  )
  const weather = rng.pick(WEATHER_PRESETS)
  const landscape = rng.pick(LANDSCAPES)
  const hoverField = mode === 'hover' ? generateHoverField(rng, waves) : null

  return {
    id: `${RANDOM_MISSION_ID_PREFIX}${seed}`,
    name: generateMissionName(rng),
    type,
    mode,
    briefing: generateBriefing(rng, type),
    theme: { ...weather.theme, landscape },
    secondaryObjective: generateSecondaryObjective(rng, waves, mode, hoverField?.defendObjective.label),
    coverObjects: hoverField?.coverObjects,
    defendObjective: hoverField?.defendObjective,
    waves,
  }
}
