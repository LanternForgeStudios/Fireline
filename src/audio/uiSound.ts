import { audioSettings } from './audioSettings'

/** One-shot UI sound effects for React menu screens (Phaser owns in-combat SFX separately). */
type UiSoundFile = 'ui_select' | 'ui_confirm' | 'toggle_on' | 'toggle_off' | 'mission_complete' | 'mission_failed'

const ALL_SOUND_FILES: UiSoundFile[] = ['ui_select', 'ui_confirm', 'toggle_on', 'toggle_off', 'mission_complete', 'mission_failed']

// mission_complete/mission_failed are musical stings (synth fanfare/shutdown
// phrases — see docs/AUDIO_AND_POLISH.md), not discrete UI clicks. A player
// muting "music" expects these silent too, even though technically they're
// one-shot files like the rest of this module — so they respect musicVolume,
// not sfxVolume, unlike every other sound played through this function.
const MUSIC_CLASSIFIED_SOUNDS: ReadonlySet<UiSoundFile> = new Set(['mission_complete', 'mission_failed'])

// One Audio element per sound, created and preloaded up front instead of
// `new Audio()` + immediate .play() on every call — building an element from
// scratch forces the browser to fetch and decode the file before playback
// can start, which is exactly what made clicks feel laggy (most noticeable
// on a sound's first play, but the decode overhead was paid every time).
// Pre-creating with preload='auto' lets that fetch/decode happen up front
// during idle time, so playUiSound() itself just resets and plays.
const cache = new Map<UiSoundFile, HTMLAudioElement>()
function getCachedAudio(file: UiSoundFile): HTMLAudioElement {
  let audio = cache.get(file)
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}audio/sfx/${file}.wav`)
    audio.preload = 'auto'
    cache.set(file, audio)
  }
  return audio
}
for (const file of ALL_SOUND_FILES) getCachedAudio(file)

export function playUiSound(file: UiSoundFile) {
  const audio = getCachedAudio(file)
  audio.volume = MUSIC_CLASSIFIED_SOUNDS.has(file) ? audioSettings.musicVolume : audioSettings.sfxVolume
  audio.currentTime = 0
  audio.play().catch(() => {})
}
