import Phaser from 'phaser'

/**
 * Shared bridge between the Phaser combat scene and the React UI (HUD,
 * briefing, results screen). React and Phaser own separate render trees per
 * the GDD architecture, so this is the seam between them.
 */
export const gameEvents = new Phaser.Events.EventEmitter()
