import type { EnemyTypeId } from '../types'

/**
 * Relative "threat budget" cost per enemy type — roughly scoreValue/50,
 * rounded, since scoreValue already encodes relative toughness/danger.
 * Kept as its own table (not derived at runtime) so budget tuning can
 * diverge from score tuning later without the two fighting each other.
 */
export const THREAT_COST: Record<EnemyTypeId, number> = {
  infantry: 1,
  drone: 2,
  gunner: 2,
  rocket: 3,
  technical: 4,
  armored: 7,
  commander: 12,
}
