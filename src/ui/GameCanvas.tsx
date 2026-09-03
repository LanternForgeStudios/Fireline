import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'

// Phaser (plus CombatScene and everything it pulls in) is the bulk of the
// bundle and only matters once a mission actually starts — dynamically
// importing it here keeps it out of the initial menu/login page load.
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let game: Phaser.Game | undefined
    let cancelled = false

    Promise.all([import('phaser'), import('../game/config')]).then(([{ default: Phaser }, { createGameConfig }]) => {
      if (cancelled || !containerRef.current) return
      game = new Phaser.Game(createGameConfig(containerRef.current))
    })

    return () => {
      cancelled = true
      game?.destroy(true)
    }
  }, [])

  return <div ref={containerRef} className="game-canvas" />
}
