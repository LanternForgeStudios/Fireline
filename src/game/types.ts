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

export interface MissionTheme {
  /** Sky gradient, top and bottom (hex). */
  skyTop: number
  skyBottom: number
  /** Tint applied to the (shared) mountain art so each mission reads differently. */
  mountainTint: number
  mountainAlpha: number
  /** Subtle tint applied to the (shared) ground tile. */
  groundTint: number
}

export interface MissionDef {
  id: string
  name: string
  type: 'Search & Destroy' | 'Escort' | 'Extraction' | 'Rescue' | 'Base Defense' | 'Reconnaissance'
  briefing: string
  theme: MissionTheme
  waves: WaveDef[]
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
}

export interface MissionResult {
  missionId: string
  outcome: 'complete' | 'failed'
  score: number
  wavesCleared: number
  totalWaves: number
  enemiesDestroyed: number
}

export const EVT_HUD_UPDATE = 'hud-update'
export const EVT_MISSION_COMPLETE = 'mission-complete'
export const EVT_MISSION_FAILED = 'mission-failed'
export const EVT_HIT_MARKER = 'hit-marker'
