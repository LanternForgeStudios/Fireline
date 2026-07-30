import Phaser from 'phaser'
import { ENEMY_DEFS } from '../data/enemyTypes'
import { PROTOTYPE_MISSION } from '../data/waves'
import { Enemy, type EnemySpawnPoint } from '../entities/Enemy'
import { Weapon } from '../entities/Weapon'
import {
  EVT_HIT_MARKER,
  EVT_HUD_UPDATE,
  EVT_MISSION_COMPLETE,
  EVT_MISSION_FAILED,
  type EnemyDef,
  type HudState,
  type MissionResult,
} from '../types'
import { gameEvents } from '../events'

export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

const MAX_HEALTH = 100
const DAMAGE_PER_SHOT = 9
const HORIZON_Y = 130
const HORIZON_Y_RANGE: [number, number] = [110, 165]
const IMPACT_Y_RANGE: [number, number] = [545, 610]
const SPAWN_X_MARGIN = 90
const DOOR_SILL_HEIGHT = 56

export class CombatScene extends Phaser.Scene {
  private weapon = new Weapon()
  private enemies: Enemy[] = []
  private crosshair!: Phaser.GameObjects.Image
  private crosshairPos = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  private ground!: Phaser.GameObjects.TileSprite

  private health = MAX_HEALTH
  private score = 0
  private enemiesDestroyed = 0
  private waveIndex = 0
  private waveElapsedMs = 0
  private waveSpawnedCount = 0
  private missionEnded = false

  constructor() {
    super('combat')
  }

  create() {
    this.health = MAX_HEALTH
    this.score = 0
    this.enemiesDestroyed = 0
    this.waveIndex = 0
    this.waveElapsedMs = 0
    this.waveSpawnedCount = 0
    this.missionEnded = false
    this.enemies = []
    this.weapon = new Weapon()

    this.buildBackground()
    this.buildEnemyTextures()
    this.buildHelicopterFrame()
    this.buildCrosshair()
    this.setupInput()

    this.emitHud()
  }

  /**
   * Oblique 3/4-view desert diorama: a shallow sky/horizon strip up top,
   * a large sand-colored ground plane filling most of the frame, and a
   * distance-shading overlay (light near the horizon, dark near the
   * helicopter) to sell camera height. Placeholder procedural art —
   * swap the ground/enemy textures for PixelLab sprites without touching
   * this layout once that's wired up.
   */
  private buildBackground() {
    // Drawn directly (not baked to a texture) because generateTexture uses the
    // Canvas API under the hood, which can't reproduce fillGradientStyle.
    const sky = this.add.graphics()
    sky.fillGradientStyle(0xf7d9a0, 0xf7d9a0, 0xf2b26b, 0xf2b26b, 1)
    sky.fillRect(0, 0, WORLD_WIDTH, HORIZON_Y)

    const sun = this.add.graphics()
    sun.fillStyle(0xfff3d6, 0.22)
    sun.fillCircle(WORLD_WIDTH * 0.78, HORIZON_Y * 0.4, 70)
    sun.fillStyle(0xfff8e6, 0.9)
    sun.fillCircle(WORLD_WIDTH * 0.78, HORIZON_Y * 0.4, 40)

    const mountains = this.add.graphics()
    mountains.fillStyle(0xc98f5e, 0.5)
    for (let i = 0; i < 9; i++) {
      const bx = i * 170 - 40
      mountains.fillTriangle(bx, HORIZON_Y, bx + 90, HORIZON_Y - 50, bx + 180, HORIZON_Y)
    }

    const groundGfx = this.add.graphics()
    groundGfx.fillStyle(0xcfa66a, 1)
    groundGfx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT - HORIZON_Y)
    groundGfx.fillStyle(0xb98f52, 0.6)
    for (let i = 0; i < 26; i++) {
      const rx = (i * 173 + (i % 3) * 61) % WORLD_WIDTH
      const ry = (i * 97 + (i % 5) * 53) % (WORLD_HEIGHT - HORIZON_Y)
      groundGfx.fillEllipse(rx, ry, 20 + (i % 4) * 6, 8 + (i % 3) * 4)
    }
    groundGfx.fillStyle(0x8a6a3c, 0.5)
    for (let i = 0; i < 14; i++) {
      const rx = (i * 233 + (i % 4) * 41) % WORLD_WIDTH
      const ry = (i * 151 + (i % 6) * 37) % (WORLD_HEIGHT - HORIZON_Y)
      groundGfx.fillCircle(rx, ry, 3 + (i % 3))
    }
    groundGfx.generateTexture('ground-tex', WORLD_WIDTH, WORLD_HEIGHT - HORIZON_Y)
    groundGfx.destroy()
    this.ground = this.add.tileSprite(
      WORLD_WIDTH / 2,
      HORIZON_Y + (WORLD_HEIGHT - HORIZON_Y) / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT - HORIZON_Y,
      'ground-tex',
    )

    // Distance shading: fades the ground darker near the helicopter to fake
    // camera height/perspective without needing a warped mesh.
    const shading = this.add.graphics()
    shading.fillGradientStyle(0xcfa66a, 0xcfa66a, 0x5a4322, 0x5a4322, 0, 0, 0.55, 0.55)
    shading.fillRect(0, HORIZON_Y, WORLD_WIDTH, WORLD_HEIGHT - HORIZON_Y)
  }

  /**
   * A sliver of the helicopter's open door frame and skid at the bottom
   * edge of the screen, so the oblique ground view still reads as "looking
   * down out of the aircraft" rather than a flat top-down map.
   */
  private buildHelicopterFrame() {
    const g = this.add.graphics()
    g.setDepth(1500)
    g.fillStyle(0x14120f, 0.94)
    g.beginPath()
    g.moveTo(0, WORLD_HEIGHT)
    g.lineTo(0, WORLD_HEIGHT - DOOR_SILL_HEIGHT * 0.35)
    g.lineTo(WORLD_WIDTH * 0.3, WORLD_HEIGHT - DOOR_SILL_HEIGHT)
    g.lineTo(WORLD_WIDTH * 0.7, WORLD_HEIGHT - DOOR_SILL_HEIGHT)
    g.lineTo(WORLD_WIDTH, WORLD_HEIGHT - DOOR_SILL_HEIGHT * 0.35)
    g.lineTo(WORLD_WIDTH, WORLD_HEIGHT)
    g.closePath()
    g.fillPath()
    g.fillStyle(0x3a352c, 1)
    g.fillRect(WORLD_WIDTH * 0.12, WORLD_HEIGHT - 9, WORLD_WIDTH * 0.76, 4)
  }

  private buildEnemyTextures() {
    for (const def of Object.values(ENEMY_DEFS)) {
      this.buildEnemyTexture(def)
    }
  }

  private buildEnemyTexture(def: EnemyDef) {
    const key = `enemy-${def.id}`
    if (this.textures.exists(key)) return

    const size = 64
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 4
    const g = this.add.graphics()
    g.fillStyle(def.color, 1)
    g.lineStyle(3, 0x11141a, 0.9)

    const poly = (points: Phaser.Math.Vector2[]) => {
      g.fillPoints(points, true)
      g.strokePoints(points, true)
    }

    switch (def.shape) {
      case 'triangle':
        poly([
          new Phaser.Math.Vector2(cx, cy - r),
          new Phaser.Math.Vector2(cx - r, cy + r),
          new Phaser.Math.Vector2(cx + r, cy + r),
        ])
        break
      case 'square':
        g.fillRect(cx - r, cy - r, r * 2, r * 2)
        g.strokeRect(cx - r, cy - r, r * 2, r * 2)
        break
      case 'diamond':
        poly([
          new Phaser.Math.Vector2(cx, cy - r),
          new Phaser.Math.Vector2(cx + r, cy),
          new Phaser.Math.Vector2(cx, cy + r),
          new Phaser.Math.Vector2(cx - r, cy),
        ])
        break
      case 'pentagon': {
        const pts: Phaser.Math.Vector2[] = []
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
          pts.push(new Phaser.Math.Vector2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r))
        }
        poly(pts)
        break
      }
    }

    g.generateTexture(key, size, size)
    g.destroy()
  }

  private buildCrosshair() {
    const g = this.add.graphics()
    g.lineStyle(3, 0xff3b30, 0.95)
    g.strokeCircle(20, 20, 16)
    g.lineBetween(20, 2, 20, 12)
    g.lineBetween(20, 28, 20, 38)
    g.lineBetween(2, 20, 12, 20)
    g.lineBetween(28, 20, 38, 20)
    g.fillStyle(0xff3b30, 1)
    g.fillCircle(20, 20, 2)
    g.generateTexture('crosshair-tex', 40, 40)
    g.destroy()

    this.crosshair = this.add.image(this.crosshairPos.x, this.crosshairPos.y, 'crosshair-tex')
    this.crosshair.setDepth(2000)
  }

  private setupInput() {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.crosshairPos.x = Phaser.Math.Clamp(pointer.x, 0, WORLD_WIDTH)
      this.crosshairPos.y = Phaser.Math.Clamp(pointer.y, 0, WORLD_HEIGHT)
      this.crosshair.setPosition(this.crosshairPos.x, this.crosshairPos.y)
    })
    this.input.on('pointerdown', () => this.weapon.setTrigger(true))
    this.input.on('pointerup', () => this.weapon.setTrigger(false))
    this.input.on('pointerout', () => this.weapon.setTrigger(false))
  }

  private currentWave() {
    return PROTOTYPE_MISSION.waves[this.waveIndex]
  }

  private spawnPoint(): EnemySpawnPoint {
    const x = Phaser.Math.Between(SPAWN_X_MARGIN, WORLD_WIDTH - SPAWN_X_MARGIN)
    const y = Phaser.Math.Between(HORIZON_Y_RANGE[0], HORIZON_Y_RANGE[1])
    const targetX = Phaser.Math.Clamp(x + Phaser.Math.Between(-140, 140), 80, WORLD_WIDTH - 80)
    const targetY = Phaser.Math.Between(IMPACT_Y_RANGE[0], IMPACT_Y_RANGE[1])
    return { x, y, targetX, targetY }
  }

  private spawnEnemy(typeId: EnemyDef['id']) {
    const def = ENEMY_DEFS[typeId]
    const enemy = new Enemy(this, def, this.spawnPoint(), `enemy-${def.id}`, this.time.now)
    this.enemies.push(enemy)
  }

  update(_time: number, delta: number) {
    if (this.missionEnded) return

    this.ground.tilePositionX += delta * 0.06
    this.ground.tilePositionY += delta * 0.03

    this.weapon.tick(delta)
    this.updateWaveSpawning(delta)
    this.updateEnemies(delta)
    this.handleFiring()

    if (this.health <= 0 && !this.missionEnded) {
      this.health = 0
      this.endMission('failed')
    } else if (
      this.waveIndex >= PROTOTYPE_MISSION.waves.length &&
      this.enemies.length === 0 &&
      !this.missionEnded
    ) {
      this.endMission('complete')
    }

    this.emitHud()
  }

  private updateWaveSpawning(_delta: number) {
    if (this.waveIndex >= PROTOTYPE_MISSION.waves.length) return

    const wave = this.currentWave()
    this.waveElapsedMs += _delta

    while (
      this.waveSpawnedCount < wave.spawns.length &&
      this.waveElapsedMs >= wave.spawns[this.waveSpawnedCount].delayMs
    ) {
      this.spawnEnemy(wave.spawns[this.waveSpawnedCount].enemyType)
      this.waveSpawnedCount += 1
    }

    if (this.waveSpawnedCount >= wave.spawns.length && this.enemies.length === 0) {
      this.waveIndex += 1
      this.waveElapsedMs = 0
      this.waveSpawnedCount = 0
    }
  }

  private updateEnemies(delta: number) {
    const now = this.time.now
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      const impacted = enemy.update(delta)

      if (impacted) {
        this.applyAircraftDamage(enemy.def.impactDamage)
        enemy.destroy()
        this.enemies.splice(i, 1)
        continue
      }

      if (enemy.shouldFire(now)) {
        this.applyAircraftDamage(enemy.def.fireDamagePerTick)
      }
    }
  }

  private applyAircraftDamage(amount: number) {
    if (amount <= 0) return
    this.health = Math.max(0, this.health - amount)
    this.cameras.main.shake(120, 0.006)
  }

  private handleFiring() {
    if (!this.weapon.tryFire()) return

    let target: Enemy | null = null
    for (const enemy of this.enemies) {
      if (!enemy.containsPoint(this.crosshairPos.x, this.crosshairPos.y)) continue
      if (!target || enemy.progress > target.progress) target = enemy
    }
    gameEvents.emit(EVT_HIT_MARKER, { hit: Boolean(target), x: this.crosshairPos.x, y: this.crosshairPos.y })

    if (!target) return

    const killed = target.takeDamage(DAMAGE_PER_SHOT)
    if (killed) {
      this.score += target.def.scoreValue
      this.enemiesDestroyed += 1
      target.destroy()
      this.enemies = this.enemies.filter((e) => e !== target)
    }
  }

  private endMission(outcome: 'complete' | 'failed') {
    this.missionEnded = true
    this.weapon.setTrigger(false)
    const result: MissionResult = {
      outcome,
      score: this.score,
      wavesCleared: Math.min(this.waveIndex, PROTOTYPE_MISSION.waves.length),
      totalWaves: PROTOTYPE_MISSION.waves.length,
      enemiesDestroyed: this.enemiesDestroyed,
    }
    gameEvents.emit(outcome === 'complete' ? EVT_MISSION_COMPLETE : EVT_MISSION_FAILED, result)
  }

  private emitHud() {
    const state: HudState = {
      health: this.health,
      maxHealth: MAX_HEALTH,
      heat: this.weapon.heat,
      maxHeat: this.weapon.maxHeat,
      overheated: this.weapon.overheated,
      score: this.score,
      waveIndex: Math.min(this.waveIndex, PROTOTYPE_MISSION.waves.length - 1),
      waveCount: PROTOTYPE_MISSION.waves.length,
      enemiesRemaining: this.enemies.length,
    }
    gameEvents.emit(EVT_HUD_UPDATE, state)
  }
}
