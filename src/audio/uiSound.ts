import { audioSettings } from './audioSettings'

/** One-shot UI sound effects for React menu screens (Phaser owns in-combat SFX separately). */
type UiSoundFile = 'ui_select' | 'ui_confirm' | 'toggle_on' | 'toggle_off' | 'mission_complete' | 'mission_failed'

// mission_complete/mission_failed are musical stings (synth fanfare/shutdown
// phrases — see docs/AUDIO_AND_POLISH.md), not discrete UI clicks. A player
// muting "music" expects these silent too, even though technically they're
// one-shot files like the rest of this module — so they respect musicVolume,
// not sfxVolume, unlike every other sound played through this function.
const MUSIC_CLASSIFIED_SOUNDS: ReadonlySet<UiSoundFile> = new Set(['mission_complete', 'mission_failed'])

export function playUiSound(file: UiSoundFile) {
  const audio = new Audio(`${import.meta.env.BASE_URL}audio/sfx/${file}.wav`)
  audio.volume = MUSIC_CLASSIFIED_SOUNDS.has(file) ? audioSettings.musicVolume : audioSettings.sfxVolume
  audio.play().catch(() => {})
}
