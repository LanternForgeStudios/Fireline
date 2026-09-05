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
    // Default is 1 (mouse + a single touch) — too few for this game's touch scheme, which
    // needs at least 2 simultaneous touches (move + fire), and up to 3 when a zoom-capable
    // gun's hold-to-zoom button is also in play. Without this, a second simultaneous touch's
    // native pointerdown fires (confirmed via a raw DOM listener) but Phaser's InputManager
    // silently drops it for lack of an allocated Pointer slot — nothing in CombatScene ever
    // sees it. Found while building the move/fire split; the existing zoom-while-aiming touch
    // combo likely never worked with genuine simultaneous touches either, only verified via a
    // mouse right-click-hold in this session's earlier automated check.
    input: { activePointers: 3 },
    scene: [CombatScene],
  }
}
