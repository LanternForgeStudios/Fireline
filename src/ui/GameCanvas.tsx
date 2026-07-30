import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { createGameConfig } from '../game/config'

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const game = new Phaser.Game(createGameConfig(containerRef.current))
    return () => {
      game.destroy(true)
    }
  }, [])

  return <div ref={containerRef} className="game-canvas" />
}
