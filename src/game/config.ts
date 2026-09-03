import Phaser from 'phaser'
import { CombatScene, WORLD_WIDTH, WORLD_HEIGHT } from './scenes/CombatScene'

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0a0d12',
    pixelArt: true,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [CombatScene],
  }
}
