import Phaser from 'phaser'
import type { EnemyDef } from '../types'

export interface EnemySpawnPoint {
  x: number
  y: number
  targetX: number
  targetY: number
}

/**
 * A single hostile contact closing on the helicopter. Owns its Phaser
 * display objects and its own approach/health/fire-back state; CombatScene
 * just drives update() and reads back the outcome each frame.
 */
export class Enemy {
  readonly def: EnemyDef
  readonly container: Phaser.GameObjects.Container
  health: number
  progress = 0
  alive = true

  private readonly spawn: EnemySpawnPoint
  private readonly jitterSeed: number
  private nextFireAt: number
  private readonly healthBarBg: Phaser.GameObjects.Rectangle
  private readonly healthBarFill: Phaser.GameObjects.Rectangle

  constructor(
    scene: Phaser.Scene,
    def: EnemyDef,
    spawn: EnemySpawnPoint,
    textureKey: string,
    spawnTime: number,
  ) {
    this.def = def
    this.spawn = spawn
    this.health = def.maxHealth
    this.jitterSeed = Math.random() * Math.PI * 2
    this.nextFireAt = spawnTime + def.fireIntervalMs * (0.4 + Math.random() * 0.6)

    const shadow = scene.add.ellipse(0, def.baseRadius * 0.75, def.baseRadius * 1.7, def.baseRadius * 0.7, 0x000000, 0.35)

    const sprite = scene.add.image(0, 0, textureKey)
    sprite.setDisplaySize(def.baseRadius * 2, def.baseRadius * 2)

    this.healthBarBg = scene.add.rectangle(0, -def.baseRadius - 14, 34, 5, 0x000000, 0.55)
    this.healthBarFill = scene.add.rectangle(0, -def.baseRadius - 14, 34, 5, 0x4ade80, 0.95)

    this.container = scene.add.container(spawn.x, spawn.y, [shadow, sprite, this.healthBarBg, this.healthBarFill])
    this.container.setScale(0.35)
    this.updateHealthBar()
  }

  private updateHealthBar() {
    const pct = Phaser.Math.Clamp(this.health / this.def.maxHealth, 0, 1)
    this.healthBarFill.width = 34 * pct
    this.healthBarFill.x = -17 + (34 * pct) / 2
    this.healthBarFill.fillColor = pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xf2c14e : 0xef4444
    const damaged = pct < 1
    this.healthBarBg.setVisible(damaged)
    this.healthBarFill.setVisible(damaged)
  }

  /** Advances position/scale. Returns true once it has reached the helicopter. */
  update(deltaMs: number): boolean {
    this.progress = Phaser.Math.Clamp(this.progress + deltaMs / this.def.approachMs, 0, 1)
    const eased = Math.pow(this.progress, 1.4)
    const scale = 0.35 + eased * 1.55
    const jitterX =
      this.def.jitter > 0 ? Math.sin(this.jitterSeed + this.progress * 14) * this.def.jitter : 0

    const x = Phaser.Math.Linear(this.spawn.x, this.spawn.targetX, eased) + jitterX
    const y = Phaser.Math.Linear(this.spawn.y, this.spawn.targetY, eased)
    this.container.setPosition(x, y)
    this.container.setScale(scale)
    this.container.setDepth(Math.floor(this.progress * 1000))

    return this.progress >= 1
  }

  /** True at most once per fireIntervalMs once the contact is close enough to shoot. */
  shouldFire(now: number): boolean {
    if (!this.def.firesBack || this.progress < 0.18) return false
    if (now < this.nextFireAt) return false
    this.nextFireAt = now + this.def.fireIntervalMs
    return true
  }

  containsPoint(x: number, y: number): boolean {
    const radius = this.def.baseRadius * this.container.scale
    return Phaser.Math.Distance.Between(x, y, this.container.x, this.container.y) <= radius
  }

  /** Applies damage; returns true if this shot killed the contact. */
  takeDamage(amount: number): boolean {
    this.health -= amount
    if (this.health <= 0) {
      this.alive = false
      return true
    }
    this.updateHealthBar()
    return false
  }

  destroy() {
    this.container.destroy()
  }
}
