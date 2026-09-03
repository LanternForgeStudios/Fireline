import { DEFAULT_MISSION } from './data/missions'
import type { MissionDef } from './types'

/**
 * Live handle to the mission the player picked, readable by both React
 * (briefing/HUD) and Phaser (CombatScene, mounted separately and can't
 * easily receive React props) — same pattern as audioSettings.
 */
export const missionState = {
  current: DEFAULT_MISSION as MissionDef,
}
