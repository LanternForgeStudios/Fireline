import type { EnemyTypeId, WaveDef, WaveSpawn } from '../types'
import { blockCost, blockDurationMs, ENCOUNTER_BLOCKS } from './encounterBlocks'
import type { SeededRandom } from './rng'

// Enemy-count safety net: without this, a run of budget could pick cheap
// blocks (infantry-squad) repeatedly and pad a wave with many weak enemies
// instead of escalating toughness — bloats enemy count without a matching
// rise in actual difficulty, and reads as spammy rather than tense. Caps it
// well above what the hand-authored missions' heaviest wave uses (7).
const MAX_SPAWNS_PER_WAVE = 12

interface WaveNameOption {
  name: string
  /** If set, this name only gets used when the wave actually contains at
   * least one of these enemy types — avoids "Commander Sighted" on a wave
   * with no commander in it. */
  requires?: EnemyTypeId[]
}

const WAVE_NAME_POOL: WaveNameOption[] = [
  { name: 'Contact' },
  { name: 'First Wave' },
  { name: 'Reinforcements' },
  { name: 'Pressing In' },
  { name: 'Closing In' },
  { name: 'Final Push' },
  { name: 'Last Stand' },
  { name: 'Armor Up', requires: ['technical', 'armored'] },
  { name: 'Heavy Resistance', requires: ['armored'] },
  { name: 'Commander Sighted', requires: ['commander'] },
]

/** Threat budget for a given wave — ramps up across the mission, matching
 * the escalating feel of the hand-authored missions (light contact early,
 * armor/commanders late). */
export function waveBudget(waveIndex: number, baseBudget: number, growth: number): number {
  return Math.round(baseBudget * Math.pow(growth, waveIndex))
}

function pickWaveName(rng: SeededRandom, spawns: WaveSpawn[], usedNames: Set<string>): string {
  const present = new Set(spawns.map((s) => s.enemyType))
  const eligible = WAVE_NAME_POOL.filter((opt) => !opt.requires || opt.requires.some((t) => present.has(t)))
  const unused = eligible.filter((opt) => !usedNames.has(opt.name))
  const pool = unused.length > 0 ? unused : eligible
  const chosen = rng.pick(pool).name
  usedNames.add(chosen)
  return chosen
}

/** Assembles encounter blocks (gated by minWaveIndex) until the budget's
 * roughly spent, staggering each block's start so waves read as a sequence
 * of distinct pushes rather than one big simultaneous dump. */
export function generateWave(rng: SeededRandom, waveIndex: number, budget: number, usedNames: Set<string>): WaveDef {
  const available = ENCOUNTER_BLOCKS.filter((b) => b.minWaveIndex <= waveIndex)
  const spawns: WaveSpawn[] = []
  let cursor = 0
  let remaining = budget
  let safety = 0

  while (remaining > 0 && spawns.length < MAX_SPAWNS_PER_WAVE && safety < 20) {
    safety++
    const affordable = available.filter(
      (b) => blockCost(b) <= remaining + 2 && spawns.length + b.spawns.length <= MAX_SPAWNS_PER_WAVE,
    )
    if (affordable.length === 0) break
    const chosen = rng.pick(affordable)
    for (const spawn of chosen.spawns) {
      spawns.push({ enemyType: spawn.enemyType, delayMs: cursor + spawn.delayMs })
    }
    cursor += blockDurationMs(chosen) + rng.int(600, 1100)
    remaining -= blockCost(chosen)
  }

  spawns.sort((a, b) => a.delayMs - b.delayMs)

  return { name: pickWaveName(rng, spawns, usedNames), spawns }
}
