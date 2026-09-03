import type { EnemyTypeId, WaveSpawn } from '../types'
import { THREAT_COST } from './threatCost'

export interface EncounterBlock {
  id: string
  label: string
  /** Enemy spawns with delayMs relative to the block's own start (0). */
  spawns: WaveSpawn[]
  /** Blocks below this wave index (0-based) never get picked — gates heavier
   * blocks to later waves the same way the hand-authored missions ramp up. */
  minWaveIndex: number
}

function block(id: string, label: string, enemyTypes: EnemyTypeId[], gapMs: number, minWaveIndex = 0): EncounterBlock {
  return {
    id,
    label,
    minWaveIndex,
    spawns: enemyTypes.map((enemyType, i) => ({ enemyType, delayMs: i * gapMs })),
  }
}

export const ENCOUNTER_BLOCKS: EncounterBlock[] = [
  block('infantry-squad', 'Infantry Squad', ['infantry', 'infantry', 'infantry'], 700),
  block('recon-flight', 'Recon Flight', ['drone', 'drone', 'infantry'], 500),
  block('skirmish-line', 'Skirmish Line', ['gunner', 'rocket'], 1000),
  block('gunner-nest', 'Gunner Nest', ['gunner', 'gunner'], 900),
  block('drone-swarm', 'Drone Swarm', ['drone', 'drone', 'drone'], 400),
  block('convoy-runner', 'Convoy Runner', ['technical', 'infantry'], 800, 1),
  block('rocket-pair', 'Rocket Pair', ['rocket', 'rocket'], 1200, 1),
  block('armor-push', 'Armor Push', ['technical', 'armored'], 1500, 2),
  block('heavy-column', 'Heavy Column', ['armored', 'armored'], 1800, 3),
  block('commander-detail', 'Commander Detail', ['commander', 'gunner', 'gunner'], 1000, 3),
]

export function blockCost(b: EncounterBlock): number {
  return b.spawns.reduce((sum, spawn) => sum + THREAT_COST[spawn.enemyType], 0)
}

export function blockDurationMs(b: EncounterBlock): number {
  return b.spawns.length === 0 ? 0 : Math.max(...b.spawns.map((s) => s.delayMs))
}
