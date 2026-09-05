import Phaser from 'phaser'

export interface HealthPickupSpawn {
  x: number
  y: number
  targetX: number
  targetY: number
}

// Deliberately simpler than Enemy's movement (no hover-wander, no jitter, no fire-back) — a
// pickup is a bonus, not a threat, so it just floats a straight line across the screen on the
// same spawn-to-impact path flight-mode enemies use, regardless of the mission's own mode.
const SPAWN_SCALE = 0.65
const APPROACH_SCALE_GROWTH = 1.1
const APPROACH_MS = 5200
const RADIUS = 22
const BOB_AMPLITUDE = 6
const BOB_FREQ = (Math.PI * 2) / 900

/**
 * A shootable health crate drifting across the field. Destroying it heals the aircraft
 * (CombatScene.handleFiring); left alone, it just reaches its target point and vanishes with no
 * penalty — same "impact" idea as an enemy reaching the aircraft, just harmless.
 */
export class HealthPickup {
  readonly container: Phaser.GameObjects.Container
  progress = 0

  private readonly spawn: HealthPickupSpawn
  private readonly bobSeed = Math.random() * Math.PI * 2

  constructor(scene: Phaser.Scene, spawn: HealthPickupSpawn, textureKey: string) {
    this.spawn = spawn
    const glow = scene.add.circle(0, 0, RADIUS * 1.3, 0x4ade80, 0.2)
    const sprite = scene.add.image(0, 0, textureKey)
    sprite.setDisplaySize(RADIUS * 2, RADIUS * 2)
    this.container = scene.add.container(spawn.x, spawn.y, [glow, sprite])
    this.container.setScale(SPAWN_SCALE)
  }

  /** Returns true once it has reached its target point unshot (caller removes it silently). */
  update(deltaMs: number): boolean {
    this.progress = Phaser.Math.Clamp(this.progress + deltaMs / APPROACH_MS, 0, 1)
    const eased = Math.pow(this.progress, 1.4)
    const scale = SPAWN_SCALE + eased * APPROACH_SCALE_GROWTH
    const bob = Math.sin(this.bobSeed + this.progress * APPROACH_MS * BOB_FREQ) * BOB_AMPLITUDE

    const x = Phaser.Math.Linear(this.spawn.x, this.spawn.targetX, eased)
    const y = Phaser.Math.Linear(this.spawn.y, this.spawn.targetY, eased) + bob
    this.container.setPosition(x, y)
    this.container.setScale(scale)
    this.container.setDepth(Math.floor(this.progress * 1000))

    return this.progress >= 1
  }

  containsPoint(x: number, y: number): boolean {
    const radius = RADIUS * this.container.scale
    return Phaser.Math.Distance.Between(x, y, this.container.x, this.container.y) <= radius
  }

  destroy() {
    this.container.destroy()
  }
}
