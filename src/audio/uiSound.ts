import { audioSettings } from './audioSettings'

/** One-shot UI sound effects for React menu screens (Phaser owns in-combat SFX separately). */
type UiSoundFile = 'ui_select' | 'ui_confirm' | 'toggle_on' | 'toggle_off' | 'mission_complete' | 'mission_failed'

export function playUiSound(file: UiSoundFile) {
  const audio = new Audio(`${import.meta.env.BASE_URL}audio/sfx/${file}.wav`)
  audio.volume = audioSettings.sfxVolume
  audio.play().catch(() => {})
}
