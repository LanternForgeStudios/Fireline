import { audioSettings } from './audioSettings'

/** One-shot UI sound effects for React menu screens (Phaser owns in-combat SFX separately). */
const ALL_SOUND_FILES = ['ui_select', 'ui_confirm', 'toggle_on', 'toggle_off', 'mission_complete', 'mission_failed'] as const
type UiSoundFile = (typeof ALL_SOUND_FILES)[number]

// mission_complete/mission_failed are musical stings (synth fanfare/shutdown
// phrases — see docs/AUDIO_AND_POLISH.md), not discrete UI clicks. A player
// muting "music" expects these silent too, even though technically they're
// one-shot files like the rest of this module — so they respect musicVolume,
// not sfxVolume, unlike every other sound played through this function.
const MUSIC_CLASSIFIED_SOUNDS: ReadonlySet<UiSoundFile> = new Set(['mission_complete', 'mission_failed'])

// A small round-robin pool per sound, not a single shared element — one
// element per sound would cut the first playback short if the same sound
// fires again (e.g. a double-click, or rapid toggle_on/toggle_off) before it
// finished, since resetting currentTime/play() on a still-playing element
// interrupts it. 2 is enough headroom for how these actually get triggered
// (quick repeats of the *same* sound), without pooling every sound file N
// times over for no benefit.
const POOL_SIZE = 2

// Pre-created and preloaded (preload='auto') instead of `new Audio()` +
// immediate .play() on every call — building an element from scratch forces
// the browser to fetch and decode the file before playback can start, which
// is exactly what made clicks feel laggy (most noticeable on a sound's first
// play, but the decode overhead was paid every time). Pre-creating lets that
// fetch/decode happen up front, so playUiSound() itself just resets and
// plays. The warm-up pass itself is deferred (see bottom of file) so it
// doesn't compete with the initial page load/auth fetch for bandwidth — the
// six files here total over 1MB.
const pools = new Map<UiSoundFile, HTMLAudioElement[]>()
const nextIndex = new Map<UiSoundFile, number>()

function getPool(file: UiSoundFile): HTMLAudioElement[] {
  let pool = pools.get(file)
  if (!pool) {
    pool = Array.from({ length: POOL_SIZE }, () => {
      const audio = new Audio(`${import.meta.env.BASE_URL}audio/sfx/${file}.wav`)
      audio.preload = 'auto'
      return audio
    })
    pools.set(file, pool)
  }
  return pool
}

export function playUiSound(file: UiSoundFile) {
  const pool = getPool(file)
  const i = (nextIndex.get(file) ?? 0) % pool.length
  nextIndex.set(file, i + 1)
  const audio = pool[i]
  audio.volume = MUSIC_CLASSIFIED_SOUNDS.has(file) ? audioSettings.musicVolume : audioSettings.sfxVolume
  audio.currentTime = 0
  audio.play().catch(() => {})
}

function warmUp() {
  for (const file of ALL_SOUND_FILES) getPool(file)
}
if (typeof requestIdleCallback === 'function') requestIdleCallback(warmUp)
else setTimeout(warmUp, 0)
