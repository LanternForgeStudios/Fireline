export type EnemyTypeId =
  | 'infantry'
  | 'gunner'
  | 'rocket'
  | 'technical'
  | 'armored'
  | 'drone'
  | 'commander'

export interface EnemyDef {
  id: EnemyTypeId
  label: string
  color: number
  shape: 'triangle' | 'square' | 'diamond' | 'pentagon'
  baseRadius: number
  maxHealth: number
  scoreValue: number
  /** Time in ms for the enemy to close from spawn to the helicopter. */
  approachMs: number
  /** Damage dealt to the aircraft if this enemy reaches the helicopter alive. */
  impactDamage: number
  firesBack: boolean
  fireDamagePerTick: number
  fireIntervalMs: number
  /** Lateral jitter amplitude, for erratic movers like drones. */
  jitter: number
  /** Whether a looping `${id}-walk` approach animation exists for this type
   * (Character API only supports humanoid/quadruped body types — vehicles
   * and aircraft don't have one, see docs/ART_ASSETS.md). Drives both
   * CombatScene's preload (skip fetching walk frames that don't exist) and
   * Enemy's constructor (skip trying to play them). */
  hasWalkCycle: boolean
}

export interface WaveSpawn {
  enemyType: EnemyTypeId
  /** Milliseconds after wave start that this enemy spawns. */
  delayMs: number
}

export interface WaveDef {
  name: string
  spawns: WaveSpawn[]
}

/** Which ground/backdrop art set a mission uses — independent of `MissionTheme`'s
 * mood tinting, which layers on top of whichever landscape is picked. */
export type LandscapeId = 'desert' | 'coastal' | 'urban' | 'jungle'

export interface MissionTheme {
  landscape: LandscapeId
  /** Sky gradient, top and bottom (hex). */
  skyTop: number
  skyBottom: number
  /** Tint applied to the mountain/backdrop art so each mission reads differently. */
  mountainTint: number
  mountainAlpha: number
  /** Subtle tint applied to the ground tile. */
  groundTint: number
}

export type Difficulty = 'easy' | 'normal' | 'hard'

export type SecondaryObjectiveType = 'no-damage' | 'clean-sweep'

export interface SecondaryObjective {
  type: SecondaryObjectiveType
  label: string
  bonusCredits: number
}

export interface MissionDef {
  id: string
  name: string
  type: 'Search & Destroy' | 'Escort' | 'Extraction' | 'Rescue' | 'Base Defense' | 'Reconnaissance'
  briefing: string
  theme: MissionTheme
  waves: WaveDef[]
  secondaryObjective: SecondaryObjective
}

export interface HudState {
  health: number
  maxHealth: number
  heat: number
  maxHeat: number
  overheated: boolean
  score: number
  waveIndex: number
  waveCount: number
  enemiesRemaining: number
  zoomed: boolean
}

export interface MissionResult {
  missionId: string
  outcome: 'complete' | 'failed'
  score: number
  wavesCleared: number
  totalWaves: number
  enemiesDestroyed: number
  /** Whether the mission's secondary objective was met — only meaningful (and only
   * ever awarded) when outcome is 'complete'; the server re-checks this isn't just
   * trusted, see functions/src/index.ts. */
  secondaryObjectiveComplete: boolean
  /** The difficulty this attempt was played at — informational only (doesn't affect
   * server-side reward clamping), tracked so the player can see their highest
   * difficulty clear per operation. See MissionStats. */
  difficulty: Difficulty
}

/** Per-mission (per-"operation") lifetime stats, server-maintained in
 * players/{uid}/missionStats/{missionId} — only successful runs count toward
 * either field, see functions/src/index.ts. */
export interface MissionStats {
  completions: number
  highestDifficulty: Difficulty
}

export const EVT_HUD_UPDATE = 'hud-update'
export const EVT_MISSION_COMPLETE = 'mission-complete'
export const EVT_MISSION_FAILED = 'mission-failed'
export const EVT_HIT_MARKER = 'hit-marker'
