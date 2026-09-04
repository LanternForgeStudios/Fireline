import Phaser from 'phaser'
import type { EnemyDef } from '../types'

export interface EnemySpawnPoint {
  x: number
  y: number
  targetX: number
  targetY: number
}

// Spawn-time scale, and how much scale grows on top of that by the time an
// enemy reaches impact (added to SPAWN_SCALE, not multiplied by it) — bumped
// 50% larger twice now per player feedback that targets were hard to
// track/hit, especially on mobile (0.35 -> 0.525 -> 0.7875); the
// growth-as-it-approaches curve itself is unchanged both times, so bigger
// spawn size also means a bigger impact size, not just a bigger start.
// containsPoint()'s hit radius (Enemy) and the touch aim-assist radius
// (CombatScene) both read container.scale directly, so both grow in step
// with this automatically — no separate tuning needed.
const SPAWN_SCALE = 0.7875
const APPROACH_SCALE_GROWTH = 1.55

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
  private readonly sprite: Phaser.GameObjects.Sprite
  // The sprite's scale right after setDisplaySize() — the fixed reference
  // point playHitFlinch()'s punch tween animates away from and back to.
  // Captured once here rather than re-read from sprite.scaleX/Y at flinch
  // time: mid-tween that property holds whatever interpolated value the
  // punch has reached, not the true base, so re-reading it on a second hit
  // during the first hit's tween would ratchet the scale away permanently.
  private readonly spriteBaseScaleX: number
  private readonly spriteBaseScaleY: number
  // Boat reskins have their own death animation (real sinking/exploding
  // frames per boat type) instead of the land type's — resolved once here
  // from the actual texture in use, not just def.id, so a boat never plays
  // a soldier/vehicle death animation on top of itself.
  private readonly deathAnimKey: string
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
    this.deathAnimKey = textureKey === `boat-${def.id}` ? `boat-${def.id}-death` : `${def.id}-death`

    const shadow = scene.add.ellipse(0, def.baseRadius * 0.75, def.baseRadius * 1.7, def.baseRadius * 0.7, 0x000000, 0.35)

    // A Sprite, not an Image — needs to be able to play the `${id}-death`
    // animation CombatScene.buildEnemyAnimations registers globally.
    this.sprite = scene.add.sprite(0, 0, textureKey)
    this.sprite.setDisplaySize(def.baseRadius * 2, def.baseRadius * 2)
    this.spriteBaseScaleX = this.sprite.scaleX
    this.spriteBaseScaleY = this.sprite.scaleY
    // Humanoid types (def.hasWalkCycle) get a looping walk cycle for the
    // approach instead of sitting on the static texture the whole way in.
    // Also gated on textureKey matching the plain `enemy-${id}` key
    // specifically (not e.g. a coastal `boat-${id}` reskin): the walk
    // frames were generated from the soldier art, not the boat art, so
    // playing them over a boat sprite would yank its texture over to a
    // soldier mid-animation. Coastal boat reskins just keep their static
    // texture. CombatScene only ever registers the animation when both of
    // these are true (see buildEnemyAnimations), so anims.exists() here is
    // just a defensive check, not the primary signal.
    const walkKey = `${def.id}-walk`
    if (def.hasWalkCycle && textureKey === `enemy-${def.id}` && scene.anims.exists(walkKey)) this.sprite.play(walkKey)

    this.healthBarBg = scene.add.rectangle(0, -def.baseRadius - 14, 34, 5, 0x000000, 0.55)
    this.healthBarFill = scene.add.rectangle(0, -def.baseRadius - 14, 34, 5, 0x4ade80, 0.95)

    this.container = scene.add.container(spawn.x, spawn.y, [shadow, this.sprite, this.healthBarBg, this.healthBarFill])
    this.container.setScale(SPAWN_SCALE)
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
    const scale = SPAWN_SCALE + eased * APPROACH_SCALE_GROWTH
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

  /**
   * A random point within the contact's hit circle, for the impact-spark
   * VFX to land at — always the exact container center previously, which
   * at high fire-rate upgrade levels stacked every spark on one pixel and
   * read as a static laser dot instead of a stream of separate hits.
   * Clamped to 65% of the hit radius so it stays visually inside the
   * sprite's silhouette rather than grazing the fuzzy edge of the hitbox.
   */
  randomImpactPoint(): { x: number; y: number } {
    const maxOffset = this.def.baseRadius * this.container.scale * 0.65
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * maxOffset
    return {
      x: this.container.x + Math.cos(angle) * dist,
      y: this.container.y + Math.sin(angle) * dist,
    }
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

  /**
   * Brief non-lethal hit reaction: a white flash plus a quick scale "punch"
   * on the sprite itself (never on `container.scale`, which update() rewrites
   * every frame from `progress` — a tween on it would just get stomped next
   * tick). Purely procedural, no new art, so it works uniformly across every
   * enemy type/texture (humanoid, vehicle, drone, boat reskin alike) instead
   * of needing a dedicated animation per type the way walk/death do.
   */
  playHitFlinch() {
    const scene = this.sprite.scene
    scene.tweens.killTweensOf(this.sprite)
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.sprite.setScale(this.spriteBaseScaleX * 1.18, this.spriteBaseScaleY * 1.18)
    scene.tweens.add({
      targets: this.sprite,
      scaleX: this.spriteBaseScaleX,
      scaleY: this.spriteBaseScaleY,
      duration: 140,
      ease: 'Back.Out',
    })
    scene.time.delayedCall(70, () => {
      if (this.sprite.active) this.sprite.clearTint()
    })
  }

  /**
   * Plays this enemy type's `${id}-death` animation (real PixelLab frames —
   * see docs/ART_ASSETS.md — registered globally by CombatScene's
   * buildEnemyAnimations, not per-instance here) and invokes onComplete once
   * it finishes. Doesn't destroy the container itself — the caller still
   * owns that, same as it did for the old placeholder scale-and-fade.
   */
  playDeath(onComplete: () => void) {
    this.healthBarBg.setVisible(false)
    this.healthBarFill.setVisible(false)
    // A hit-flinch tween/tint can still be in flight from the shot that
    // just killed this enemy (playHitFlinch() only runs on non-lethal hits,
    // but the *previous* shot may not have been lethal) — clear both before
    // switching to the death animation so it doesn't start visibly
    // stretched or tinted mid-transition.
    this.sprite.scene.tweens.killTweensOf(this.sprite)
    this.sprite.setScale(this.spriteBaseScaleX, this.spriteBaseScaleY)
    this.sprite.clearTint()
    this.sprite.play(this.deathAnimKey)
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, onComplete)
  }

  destroy() {
    this.container.destroy()
  }
}
