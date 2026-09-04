import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'

// Fixed 1280x720 world, landscape-only layout (horizon-based flight view,
// thumb pads on the left/right edges) — Scale.FIT would otherwise letterbox
// hard on a tall/narrow portrait phone (scale is capped by the *width*,
// leaving most of the screen's height empty). Rather than re-tuning every
// gameplay position constant to a dynamic aspect ratio, a touch device held
// in portrait gets a "rotate to landscape" prompt instead, with the scene
// paused underneath until it does.
function isMobilePortrait() {
  return typeof window !== 'undefined' && window.matchMedia('(orientation: portrait) and (pointer: coarse)').matches
}

// Phaser (plus CombatScene and everything it pulls in) is the bulk of the
// bundle and only matters once a mission actually starts — dynamically
// importing it here keeps it out of the initial menu/login page load.
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneKeyRef = useRef<string | null>(null)
  const [portrait, setPortrait] = useState(isMobilePortrait)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    Promise.all([import('phaser'), import('../game/config'), import('../game/scenes/CombatScene')]).then(
      ([{ default: Phaser }, { createGameConfig }, { COMBAT_SCENE_KEY }]) => {
        if (cancelled || !containerRef.current) return
        const game = new Phaser.Game(createGameConfig(containerRef.current))
        gameRef.current = game
        sceneKeyRef.current = COMBAT_SCENE_KEY
        if (isMobilePortrait()) game.scene.pause(COMBAT_SCENE_KEY)
      },
    )

    return () => {
      cancelled = true
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait) and (pointer: coarse)')
    const onChange = () => setPortrait(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const game = gameRef.current
    const key = sceneKeyRef.current
    if (!game || !key) return
    if (portrait) game.scene.pause(key)
    else game.scene.resume(key)
  }, [portrait])

  return (
    <>
      <div ref={containerRef} className="game-canvas" />
      {portrait && (
        <div className="rotate-prompt">
          <div className="rotate-prompt-icon">⟳</div>
          <p>Rotate your device to landscape to fly</p>
        </div>
      )}
    </>
  )
}
