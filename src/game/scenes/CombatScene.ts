import Phaser from 'phaser'
import { audioSettings } from '../../audio/audioSettings'
import type { Difficulty } from '../../firebase/playerProfile'
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

// Difficulty scales enemy toughness and how hard they hit back; spawn timing
// and enemy variety stay the same across difficulties for this prototype.
const DIFFICULTY_MULTIPLIERS: Record<Difficulty, { health: number; damage: number }> = {
  easy: { health: 0.75, damage: 0.7 },
  normal: { health: 1, damage: 1 },
  hard: { health: 1.35, damage: 1.3 },
}

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

  preload() {
    for (const def of Object.values(ENEMY_DEFS)) {
      this.load.image(`enemy-${def.id}`, `${import.meta.env.BASE_URL}enemies/${def.id}.png`)
    }
    this.load.image('ground-art', `${import.meta.env.BASE_URL}env/ground.png`)
    this.load.image('mountains-art', `${import.meta.env.BASE_URL}env/mountains.png`)

    this.load.audio('sfx-shot', `${import.meta.env.BASE_URL}audio/sfx/shot.wav`)
    this.load.audio('sfx-kill', `${import.meta.env.BASE_URL}audio/sfx/kill.wav`)
    this.load.audio('sfx-aircraft-damage', `${import.meta.env.BASE_URL}audio/sfx/aircraft_damage.wav`)
    this.load.audio('sfx-overheat', `${import.meta.env.BASE_URL}audio/sfx/overheat.wav`)
    this.load.audio('music-combat', `${import.meta.env.BASE_URL}audio/music/combat.ogg`)
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

    this.sound.play('music-combat', { loop: true, volume: audioSettings.musicVolume })

    this.emitHud()
  }

  /**
   * Oblique 3/4-view desert diorama: a shallow sky/horizon strip up top, a
   * mountain silhouette (real PixelLab art, stretched to width — a single
   * static image rather than a tiled texture avoids seams a freeform-painted
   * range can't guarantee), a tiled sand ground plane (real seamless PixelLab
   * tile, scrolls via tilePositionX/Y), and a distance-shading overlay
   * (light near the horizon, dark near the helicopter) to sell camera height.
   */
  private buildBackground() {
    // Drawn directly (not baked to a texture) because generateTexture uses the
    // Canvas API under the hood, which can't reproduce fillGradientStyle.
    const sky = this.add.graphics()
    sky.fillGradientStyle(0xf7d9a0, 0xf7d9a0, 0xf2b26b, 0xf2b26b, 1)
    sky.fillRect(0, 0, WORLD_WIDTH, HORIZON_Y)

    // The mountain art already bakes in a sun glow, so there's no separate
    // procedural sun layer here.
    const mountains = this.add.image(WORLD_WIDTH / 2, HORIZON_Y, 'mountains-art')
    mountains.setOrigin(0.5, 1)
    mountains.setDisplaySize(WORLD_WIDTH, 90)
    mountains.setAlpha(0.75)

    this.ground = this.add.tileSprite(
      WORLD_WIDTH / 2,
      HORIZON_Y + (WORLD_HEIGHT - HORIZON_Y) / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT - HORIZON_Y,
      'ground-art',
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
    const baseDef = ENEMY_DEFS[typeId]
    const mult = DIFFICULTY_MULTIPLIERS[audioSettings.difficulty]
    const def: EnemyDef = {
      ...baseDef,
      maxHealth: Math.round(baseDef.maxHealth * mult.health),
      impactDamage: Math.round(baseDef.impactDamage * mult.damage),
      fireDamagePerTick: Math.round(baseDef.fireDamagePerTick * mult.damage),
    }
    const enemy = new Enemy(this, def, this.spawnPoint(), `enemy-${baseDef.id}`, this.time.now)
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
    this.sound.play('sfx-aircraft-damage', { volume: audioSettings.sfxVolume })
  }

  private handleFiring() {
    const wasOverheated = this.weapon.overheated
    if (!this.weapon.tryFire()) return

    this.sound.play('sfx-shot', { volume: audioSettings.sfxVolume * 0.5 })
    if (this.weapon.overheated && !wasOverheated) {
      this.sound.play('sfx-overheat', { volume: audioSettings.sfxVolume })
    }

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
      this.sound.play('sfx-kill', { volume: audioSettings.sfxVolume })
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
