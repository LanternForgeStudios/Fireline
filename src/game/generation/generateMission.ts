import type { MissionDef } from '../types'
import { generateBriefing, generateMissionName, MISSION_TYPES } from './briefingTemplates'
import { randomSeed, SeededRandom } from './rng'
import { generateWave, waveBudget } from './waveGenerator'
import { WEATHER_PRESETS } from './weatherThemes'

const BASE_BUDGET = 7
const BUDGET_GROWTH = 1.28
const MIN_WAVES = 4
const MAX_WAVES = 6

/** Deterministic: the same seed always produces the same mission (GDD calls
 * for "seeded random generation"). RANDOM_MISSION_ID_PREFIX is what lets
 * both the UI and the Cloud Functions reward-bounds check (see
 * functions/src/missionCatalog.ts) recognize a generated mission by id
 * shape rather than needing every seed pre-registered somewhere. */
export const RANDOM_MISSION_ID_PREFIX = 'random-'

export function generateMission(seed: number = randomSeed()): MissionDef {
  const rng = new SeededRandom(seed)

  const type = rng.pick(MISSION_TYPES)
  const totalWaves = rng.int(MIN_WAVES, MAX_WAVES)
  const usedWaveNames = new Set<string>()
  const waves = Array.from({ length: totalWaves }, (_, i) =>
    generateWave(rng, i, waveBudget(i, BASE_BUDGET, BUDGET_GROWTH), usedWaveNames),
  )
  const weather = rng.pick(WEATHER_PRESETS)

  return {
    id: `${RANDOM_MISSION_ID_PREFIX}${seed}`,
    name: generateMissionName(rng),
    type,
    briefing: generateBriefing(rng, type),
    theme: weather.theme,
    waves,
  }
}
