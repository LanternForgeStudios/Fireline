/**
 * Menu/briefing/results background music. A plain HTMLAudioElement rather
 * than Phaser sound — this needs to keep playing across React screens that
 * exist outside the Phaser canvas (which only mounts during combat).
 */
const element = new Audio()
element.loop = true
let currentSrc = ''

export function playMusic(src: string) {
  const resolved = `${import.meta.env.BASE_URL}${src}`
  if (currentSrc === resolved) return
  currentSrc = resolved
  element.src = resolved
  element.play().catch(() => {
    // Autoplay can be blocked before the user's first interaction with the
    // page; the next playMusic()/setVolume() call after a click will retry.
  })
}

export function stopMusic() {
  currentSrc = ''
  element.pause()
}

export function setMusicVolume(volume: number) {
  element.volume = Math.min(1, Math.max(0, volume))
}
