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
const HORIZON_Y_RANGE: [number, number] = [170, 250]
const IMPACT_Y_RANGE: [number, number] = [560, 650]
const SPAWN_X_MARGIN = 90

export class CombatScene extends Phaser.Scene {
  private weapon = new Weapon()
  private enemies: Enemy[] = []
  private crosshair!: Phaser.GameObjects.Image
  private crosshairPos = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  private ground!: Phaser.GameObjects.TileSprite
  private clouds!: Phaser.GameObjects.TileSprite

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
    this.buildCrosshair()
    this.setupInput()

    this.emitHud()
  }

  private buildBackground() {
    // Drawn directly (not baked to a texture) because generateTexture uses the
    // Canvas API under the hood, which can't reproduce fillGradientStyle.
    const sky = this.add.graphics()
    sky.fillGradientStyle(0x142033, 0x142033, 0x4a6b8a, 0x4a6b8a, 1)
    sky.fillRect(0, 0, WORLD_WIDTH, 420)

    const cloudGfx = this.add.graphics()
    cloudGfx.fillStyle(0xffffff, 0.06)
    for (let i = 0; i < 10; i++) {
      cloudGfx.fillEllipse(i * 130 + 40, 60 + (i % 3) * 40, 90, 22)
    }
    cloudGfx.generateTexture('clouds-tex', WORLD_WIDTH, 420)
    cloudGfx.destroy()
    this.clouds = this.add.tileSprite(WORLD_WIDTH / 2, 210, WORLD_WIDTH, 420, 'clouds-tex')

    const groundGfx = this.add.graphics()
    groundGfx.fillStyle(0x2b3a24, 1)
    groundGfx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT - 420)
    groundGfx.fillStyle(0x354a2c, 1)
    for (let i = 0; i < 16; i++) {
      groundGfx.fillTriangle(i * 90, WORLD_HEIGHT - 420, i * 90 + 45, WORLD_HEIGHT - 460, i * 90 + 90, WORLD_HEIGHT - 420)
    }
    groundGfx.generateTexture('ground-tex', WORLD_WIDTH, WORLD_HEIGHT - 420)
    groundGfx.destroy()
    this.ground = this.add.tileSprite(
      WORLD_WIDTH / 2,
      420 + (WORLD_HEIGHT - 420) / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT - 420,
      'ground-tex',
    )
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

    this.clouds.tilePositionX += delta * 0.01
    this.ground.tilePositionX += delta * 0.09

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
