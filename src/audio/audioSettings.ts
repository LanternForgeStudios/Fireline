import type { ControlSide, Difficulty } from '../firebase/playerProfile'

/**
 * Live mirror of the player's settings — not just audio despite the name
 * (kept as-is to avoid a wider rename; see docs/AUDIO_AND_POLISH.md) —
 * readable by both React (menu UI sounds) and Phaser (CombatScene, which
 * isn't mounted until a mission starts and can't easily receive React
 * props). App.tsx keeps this in sync with the Firestore-backed
 * PlayerProfile whenever it changes.
 */
export const audioSettings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  difficulty: 'normal' as Difficulty,
  controlSide: 'left' as ControlSide,
}
