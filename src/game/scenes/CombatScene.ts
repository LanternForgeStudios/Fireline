import Phaser from 'phaser'
import { audioSettings } from '../../audio/audioSettings'
import type { Difficulty } from '../../firebase/playerProfile'
import { computeWeaponStats } from '../data/upgrades'
import { ENEMY_DEFS } from '../data/enemyTypes'
import { missionState } from '../missionState'
import { Enemy, type EnemySpawnPoint } from '../entities/Enemy'
import { Weapon } from '../entities/Weapon'
import { playerLoadout } from '../playerLoadout'
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
const HORIZON_Y = 130
const HORIZON_Y_RANGE: [number, number] = [110, 165]
const IMPACT_Y_RANGE: [number, number] = [545, 610]
const SPAWN_X_MARGIN = 90
const DOOR_SILL_HEIGHT = 56
// Where tracer fire visually originates from — the M134 mount at the open
// door, just above the sill silhouette drawn at the bottom of the screen.
const GUN_ORIGIN = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT - 24 }
// Touch aim uses a fixed-position virtual trackpad rather than positioning
// the crosshair directly under the finger — a direct-touch scheme means the
// finger itself blocks whatever it's aiming at. Mouse input is unaffected
// (still direct absolute positioning).
//
// Behaves like a laptop trackpad, not an analog stick: crosshair movement
// tracks the finger's *movement* (delta), scaled by TOUCH_PAD_SENSITIVITY,
// not its distance from a center point. A rate/deflection-based joystick
// was tried first and felt imprecise for aiming — it keeps moving the
// crosshair as long as you hold any offset, which fights fine placement.
// Delta tracking stops the instant the finger stops, same as a real mouse.
//
// Both a left and a right pad exist simultaneously (no handedness setting
// — the player just uses whichever thumb suits the target) but only one is
// live at a time: touching one while the other is already engaged is
// ignored outright, so there's no way to drive both at once. Releasing the
// active one frees the other up again.
const TOUCH_PAD_Y = WORLD_HEIGHT - 150
const TOUCH_PAD_MARGIN_X = 150
const TOUCH_PAD_RADIUS = 80
// Generous vs. the visual radius so a slightly-off first touch still grabs
// the pad — once engaged, dragging can go beyond the ring (clamped for the
// knob's rendered position, not for how it's interpreted as input).
const TOUCH_PAD_ACTIVATION_RADIUS = 110
const TOUCH_PAD_SENSITIVITY = 2.2
// Touch aiming is meaningfully harder than mouse aiming — a phone screen is
// smaller, fingers are less precise than a cursor, and fast-approaching
// enemies can close the gap before a trackpad drag lands exactly on them.
// This nudges the crosshair toward whichever enemy it's already closest to,
// once within that enemy's own hit radius plus a bit of slack — a soft pull
// on final approach, not a hard lock (the touch delta each frame can still
// overpower it and move away freely). Scoped to touch input only: mouse
// aiming isn't the problem being solved here, and unrequested aim-assist on
// a precise input device would just feel like it's fighting the player.
const AIM_ASSIST_RADIUS_BONUS = 34
const AIM_ASSIST_STRENGTH = 0.16
// Enemy return fire used to be an instant, invisible damage tick the moment
// an enemy was in range — no way to see it coming or connect it to its
// source. Now it's a real traveling bolt (px/sec) from the shooter to the
// gun mount; damage lands when the bolt arrives, not when it's fired, so
// there's a real window to kill the shooter before its *next* volley.
const ENEMY_PROJECTILE_SPEED = 1400
const ENEMY_PROJECTILE_MIN_MS = 220
const ENEMY_PROJECTILE_MAX_MS = 650

type PadSide = 'left' | 'right'
interface TouchPad {
  center: { x: number; y: number }
  ring: Phaser.GameObjects.Arc
  knob: Phaser.GameObjects.Arc
}

// Difficulty scales enemy toughness and how hard they hit back; spawn timing
// and enemy variety stay the same across difficulties for this prototype.
const DIFFICULTY_MULTIPLIERS: Record<Difficulty, { health: number; damage: number }> = {
  easy: { health: 0.75, damage: 0.7 },
  normal: { health: 1, damage: 1 },
  hard: { health: 1.35, damage: 1.3 },
}

export class CombatScene extends Phaser.Scene {
  private weapon!: Weapon
  private enemies: Enemy[] = []
  private crosshair!: Phaser.GameObjects.Image
  private crosshairPos = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  private ground!: Phaser.GameObjects.TileSprite
  private damageVignette!: Phaser.GameObjects.Rectangle
  private rotorFlicker!: Phaser.GameObjects.Rectangle
  private nextDustAtMs = 0
  private nextFlickerAtMs = 0

  private pads!: Record<PadSide, TouchPad>
  private activePad: PadSide | null = null
  private padPointerId: number | null = null
  // Last raw touch position for the active pad pointer — the *movement*
  // between this and the current touch each frame is what drives the
  // crosshair, not the position itself. null while no pad is engaged.
  private padLastPos: { x: number; y: number } | null = null

  private health = MAX_HEALTH
  private score = 0
  private enemiesDestroyed = 0
  private waveIndex = 0
  private waveElapsedMs = 0
  private waveSpawnedCount = 0
  private missionEnded = false
  // Secondary objective tracking (see missionState.current.secondaryObjective).
  private noDamageTaken = true
  private totalEnemiesSpawned = 0

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
    this.noDamageTaken = true
    this.totalEnemiesSpawned = 0
    this.enemies = []
    this.weapon = new Weapon(computeWeaponStats(playerLoadout.unlockedUpgrades))

    this.buildBackground()
    this.buildEnemyTextures()
    this.buildHelicopterFrame()
    this.buildVfxTextures()
    this.buildDamageVignette()
    this.buildRotorFlicker()
    this.buildCrosshair()
    this.buildTouchPad()
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
    const theme = missionState.current.theme

    // Drawn directly (not baked to a texture) because generateTexture uses the
    // Canvas API under the hood, which can't reproduce fillGradientStyle.
    const sky = this.add.graphics()
    sky.fillGradientStyle(theme.skyTop, theme.skyTop, theme.skyBottom, theme.skyBottom, 1)
    sky.fillRect(0, 0, WORLD_WIDTH, HORIZON_Y)

    // The mountain art already bakes in a sun glow, so there's no separate
    // procedural sun layer here.
    const mountains = this.add.image(WORLD_WIDTH / 2, HORIZON_Y, 'mountains-art')
    mountains.setOrigin(0.5, 1)
    mountains.setDisplaySize(WORLD_WIDTH, 90)
    mountains.setAlpha(theme.mountainAlpha)
    mountains.setTint(theme.mountainTint)

    this.ground = this.add.tileSprite(
      WORLD_WIDTH / 2,
      HORIZON_Y + (WORLD_HEIGHT - HORIZON_Y) / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT - HORIZON_Y,
      'ground-art',
    )
    this.ground.setTint(theme.groundTint)

    // Distance shading: fades the ground darker near the helicopter to fake
    // camera height/perspective without needing a warped mesh.
    const shading = this.add.graphics()
    shading.fillGradientStyle(theme.groundTint, theme.groundTint, 0x2a1f18, 0x2a1f18, 0, 0, 0.55, 0.55)
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

  /** A single soft radial dot, tinted and scaled per-use for muzzle flash / hit / kill sparks. */
  private buildVfxTextures() {
    const g = this.add.graphics()
    g.fillStyle(0xffffff, 1)
    g.fillCircle(16, 16, 16)
    g.generateTexture('spark-tex', 32, 32)
    g.destroy()
  }

  /** Full-screen red flash on aircraft damage, alpha 0 at rest. */
  private buildDamageVignette() {
    this.damageVignette = this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0xff1a1a, 0)
    this.damageVignette.setDepth(2500)
  }

  /**
   * Full-screen dark overlay, alpha 0 at rest, briefly pulsed on an uneven
   * interval to read as an overhead rotor blade sweeping past — the cabin
   * itself isn't in view from a door-gunner POV, so this is the cheapest way
   * to sell "we're under a spinning rotor" without new art. Sits below the
   * damage vignette (2500) so a red hit flash still reads clearly on top.
   */
  private buildRotorFlicker() {
    this.rotorFlicker = this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x000000, 0)
    this.rotorFlicker.setDepth(2400)
    this.nextFlickerAtMs = Phaser.Math.Between(160, 260)
  }

  private spawnSpark(x: number, y: number, tint: number, endScale: number, durationMs: number) {
    const spark = this.add.image(x, y, 'spark-tex')
    spark.setTint(tint)
    spark.setDepth(1800)
    spark.setScale(0.25)
    spark.setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({
      targets: spark,
      scale: endScale,
      alpha: 0,
      duration: durationMs,
      ease: 'Cubic.Out',
      onComplete: () => spark.destroy(),
    })
  }

  /**
   * A fast-fading streak from the door gun to the aim point so rapid fire
   * (~14 shots/sec) reads as a visible line of tracers rather than invisible
   * hit-scan — there's no travel-time projectile simulation, just a quick
   * flash along the shot's path, which is legible at this fire rate where
   * an actually-traveling bullet sprite would just be visual noise.
   */
  private spawnTracer(toX: number, toY: number) {
    const g = this.add.graphics()
    g.setDepth(1700)
    g.lineStyle(2, 0xfff3c4, 0.85)
    g.lineBetween(GUN_ORIGIN.x, GUN_ORIGIN.y, toX, toY)
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 90,
      ease: 'Cubic.Out',
      onComplete: () => g.destroy(),
    })
  }

  /** "+150" text that drifts up and fades on a kill — score feedback beyond the HUD counter. */
  private spawnScorePopup(x: number, y: number, value: number) {
    const text = this.add.text(x, y, `+${value}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffe08a',
      stroke: '#2a1a0a',
      strokeThickness: 3,
    })
    text.setOrigin(0.5, 1)
    text.setDepth(1900)
    this.tweens.add({
      targets: text,
      y: y - 46,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    })
  }

  /**
   * A soft puff of dust drifting up and sideways from near the door sill,
   * reusing the same spark-tex the muzzle flash/hit spark share (tinted,
   * larger, slower, near-ground) — rotor wash kicking up terrain dust right
   * around the aircraft. Depth 1400 sits above enemies (max depth ~1000) but
   * below the helicopter frame silhouette (1500), so it reads as outside the
   * cabin, occluded by the door frame near the very bottom edge.
   */
  private spawnDustPuff() {
    const theme = missionState.current.theme
    const x = Phaser.Math.Between(WORLD_WIDTH * 0.15, WORLD_WIDTH * 0.85)
    const y = Phaser.Math.Between(WORLD_HEIGHT - 70, WORLD_HEIGHT - 40)
    const puff = this.add.image(x, y, 'spark-tex')
    puff.setTint(theme.groundTint)
    puff.setDepth(1400)
    puff.setAlpha(0.22)
    puff.setScale(0.4)
    puff.setBlendMode(Phaser.BlendModes.NORMAL)
    this.tweens.add({
      targets: puff,
      x: x + Phaser.Math.Between(-40, 40),
      y: y - Phaser.Math.Between(30, 60),
      scale: 1.1,
      alpha: 0,
      duration: 1400,
      ease: 'Sine.Out',
      onComplete: () => puff.destroy(),
    })
  }

  private updateDustKickup(delta: number) {
    this.nextDustAtMs -= delta
    if (this.nextDustAtMs > 0) return
    this.spawnDustPuff()
    this.nextDustAtMs = Phaser.Math.Between(220, 420)
  }

  /** Uneven timing (not a metronomic strobe) reads more like a physical blade thump. */
  private updateRotorFlicker(delta: number) {
    this.nextFlickerAtMs -= delta
    if (this.nextFlickerAtMs > 0) return
    this.tweens.add({
      targets: this.rotorFlicker,
      alpha: 0.07,
      duration: 40,
      yoyo: true,
      ease: 'Sine.InOut',
    })
    this.nextFlickerAtMs = Phaser.Math.Between(160, 260)
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

  /** Always built (harmless, low-opacity for a mouse player who'll never touch it). */
  private buildTouchPad() {
    this.pads = {
      left: this.buildPadSide(TOUCH_PAD_MARGIN_X),
      right: this.buildPadSide(WORLD_WIDTH - TOUCH_PAD_MARGIN_X),
    }
  }

  private buildPadSide(x: number): TouchPad {
    const center = { x, y: TOUCH_PAD_Y }

    const ring = this.add.circle(center.x, center.y, TOUCH_PAD_RADIUS, 0xffffff, 0.08)
    ring.setStrokeStyle(2, 0xffffff, 0.35)
    ring.setDepth(2100)
    const knob = this.add.circle(center.x, center.y, 26, 0xffffff, 0.25)
    knob.setDepth(2101)

    const label = this.add.text(center.x, center.y + TOUCH_PAD_RADIUS + 16, 'AIM', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
    })
    label.setOrigin(0.5, 0)
    label.setAlpha(0.35)
    label.setDepth(2100)

    return { center, ring, knob }
  }

  private updateCrosshairFromMouse(pointer: Phaser.Input.Pointer) {
    this.crosshairPos.x = Phaser.Math.Clamp(pointer.x, 0, WORLD_WIDTH)
    this.crosshairPos.y = Phaser.Math.Clamp(pointer.y, 0, WORLD_HEIGHT)
    this.crosshair.setPosition(this.crosshairPos.x, this.crosshairPos.y)
  }

  /** Only one pad can be live at a time — if either is already engaged, a touch
   * anywhere (including on the other pad) is ignored until it's released. */
  private engagePad(pointer: Phaser.Input.Pointer) {
    if (this.activePad !== null) return false

    for (const side of ['left', 'right'] as const) {
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.pads[side].center.x, this.pads[side].center.y)
      if (dist > TOUCH_PAD_ACTIVATION_RADIUS) continue

      this.activePad = side
      this.padPointerId = pointer.id
      this.padLastPos = { x: pointer.x, y: pointer.y }
      this.pads[side].ring.setStrokeStyle(2, 0xfff3c4, 0.6)
      this.updatePadKnobVisual(pointer)
      this.weapon.setTrigger(true)
      return true
    }
    return false
  }

  /** Trackpad-style: crosshair moves by the finger's *movement* since last frame, not its
   * absolute position — stops the instant the finger stops, unlike a deflection-based stick. */
  private updatePadDrag(pointer: Phaser.Input.Pointer) {
    if (!this.padLastPos) return
    const deltaX = pointer.x - this.padLastPos.x
    const deltaY = pointer.y - this.padLastPos.y
    this.padLastPos = { x: pointer.x, y: pointer.y }

    this.crosshairPos.x = Phaser.Math.Clamp(this.crosshairPos.x + deltaX * TOUCH_PAD_SENSITIVITY, 0, WORLD_WIDTH)
    this.crosshairPos.y = Phaser.Math.Clamp(this.crosshairPos.y + deltaY * TOUCH_PAD_SENSITIVITY, 0, WORLD_HEIGHT)
    this.applyTouchAimAssist()
    this.crosshair.setPosition(this.crosshairPos.x, this.crosshairPos.y)

    this.updatePadKnobVisual(pointer)
  }

  /** See AIM_ASSIST_RADIUS_BONUS/AIM_ASSIST_STRENGTH above. */
  private applyTouchAimAssist() {
    let nearest: Enemy | null = null
    let nearestDist = Infinity

    for (const enemy of this.enemies) {
      const radius = enemy.def.baseRadius * enemy.container.scale + AIM_ASSIST_RADIUS_BONUS
      const dist = Phaser.Math.Distance.Between(
        this.crosshairPos.x,
        this.crosshairPos.y,
        enemy.container.x,
        enemy.container.y,
      )
      if (dist < radius && dist < nearestDist) {
        nearest = enemy
        nearestDist = dist
      }
    }

    if (!nearest) return
    this.crosshairPos.x = Phaser.Math.Linear(this.crosshairPos.x, nearest.container.x, AIM_ASSIST_STRENGTH)
    this.crosshairPos.y = Phaser.Math.Linear(this.crosshairPos.y, nearest.container.y, AIM_ASSIST_STRENGTH)
  }

  /** Knob just shows "which way is the finger currently offset" — purely visual, doesn't drive aim. */
  private updatePadKnobVisual(pointer: Phaser.Input.Pointer) {
    if (!this.activePad) return
    const pad = this.pads[this.activePad]
    const dx = pointer.x - pad.center.x
    const dy = pointer.y - pad.center.y
    const dist = Math.max(1, Math.hypot(dx, dy))
    const knobDist = Math.min(dist, TOUCH_PAD_RADIUS)
    pad.knob.setPosition(pad.center.x + (dx / dist) * knobDist, pad.center.y + (dy / dist) * knobDist)
  }

  private releasePad() {
    if (this.activePad) {
      const pad = this.pads[this.activePad]
      pad.ring.setStrokeStyle(2, 0xffffff, 0.35)
      pad.knob.setPosition(pad.center.x, pad.center.y)
    }
    this.activePad = null
    this.padPointerId = null
    this.padLastPos = null
    this.weapon.setTrigger(false)
  }

  private setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        this.engagePad(pointer)
        return
      }
      this.updateCrosshairFromMouse(pointer)
      this.weapon.setTrigger(true)
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        if (pointer.id === this.padPointerId) this.updatePadDrag(pointer)
        return
      }
      this.updateCrosshairFromMouse(pointer)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        if (pointer.id === this.padPointerId) this.releasePad()
        return
      }
      this.weapon.setTrigger(false)
    })
    this.input.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        if (pointer.id === this.padPointerId) this.releasePad()
        return
      }
      this.weapon.setTrigger(false)
    })
  }

  private currentWave() {
    return missionState.current.waves[this.waveIndex]
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
    this.totalEnemiesSpawned += 1
  }

  update(_time: number, delta: number) {
    if (this.missionEnded) return

    this.ground.tilePositionX += delta * 0.06
    this.ground.tilePositionY += delta * 0.03

    this.weapon.tick(delta)
    this.updateWaveSpawning(delta)
    this.updateEnemies(delta)
    this.updateDustKickup(delta)
    this.updateRotorFlicker(delta)
    this.handleFiring()

    if (this.health <= 0 && !this.missionEnded) {
      this.health = 0
      this.endMission('failed')
    } else if (
      this.waveIndex >= missionState.current.waves.length &&
      this.enemies.length === 0 &&
      !this.missionEnded
    ) {
      this.endMission('complete')
    }

    this.emitHud()
  }

  private updateWaveSpawning(_delta: number) {
    if (this.waveIndex >= missionState.current.waves.length) return

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
        this.spawnEnemyProjectile(enemy)
      }
    }
  }

  /**
   * A visible return-fire bolt from an enemy's current position to the gun
   * mount, tinted distinctly from the player's own pale-yellow tracer so the
   * two directions of fire never read as ambiguous. Damage applies on
   * arrival, not on launch — see ENEMY_PROJECTILE_SPEED above.
   */
  private spawnEnemyProjectile(enemy: Enemy) {
    const fromX = enemy.container.x
    const fromY = enemy.container.y
    const damage = enemy.def.fireDamagePerTick

    this.spawnSpark(fromX, fromY, 0xff6644, 0.9, 140)

    const bolt = this.add.image(fromX, fromY, 'spark-tex')
    bolt.setTint(0xff5533)
    bolt.setDepth(1750)
    bolt.setScale(0.3)
    bolt.setBlendMode(Phaser.BlendModes.ADD)

    const dist = Phaser.Math.Distance.Between(fromX, fromY, GUN_ORIGIN.x, GUN_ORIGIN.y)
    const travelMs = Phaser.Math.Clamp(
      (dist / ENEMY_PROJECTILE_SPEED) * 1000,
      ENEMY_PROJECTILE_MIN_MS,
      ENEMY_PROJECTILE_MAX_MS,
    )

    this.tweens.add({
      targets: bolt,
      x: GUN_ORIGIN.x,
      y: GUN_ORIGIN.y,
      duration: travelMs,
      ease: 'Linear',
      onComplete: () => {
        bolt.destroy()
        if (this.missionEnded) return
        this.spawnSpark(GUN_ORIGIN.x, GUN_ORIGIN.y, 0xff5533, 1.1, 160)
        this.applyAircraftDamage(damage)
      },
    })
  }

  private applyAircraftDamage(amount: number) {
    if (amount <= 0) return
    this.health = Math.max(0, this.health - amount)
    this.noDamageTaken = false
    this.cameras.main.shake(120, 0.006)
    this.sound.play('sfx-aircraft-damage', { volume: audioSettings.sfxVolume })

    this.tweens.killTweensOf(this.damageVignette)
    this.damageVignette.setAlpha(0.32)
    this.tweens.add({ targets: this.damageVignette, alpha: 0, duration: 350, ease: 'Cubic.Out' })
  }

  private handleFiring() {
    const wasOverheated = this.weapon.overheated
    if (!this.weapon.tryFire()) return

    this.sound.play('sfx-shot', { volume: audioSettings.sfxVolume * 0.5 })
    this.spawnTracer(this.crosshairPos.x, this.crosshairPos.y)
    this.spawnSpark(this.crosshairPos.x, this.crosshairPos.y, 0xfff3c4, 1, 90)
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
    this.spawnSpark(target.container.x, target.container.y, 0xffa64d, 0.8, 140)

    const killed = target.takeDamage(this.weapon.damagePerShot)
    if (killed) {
      const killedTarget = target
      this.score += killedTarget.def.scoreValue
      this.enemiesDestroyed += 1
      this.enemies = this.enemies.filter((e) => e !== killedTarget)
      this.spawnSpark(killedTarget.container.x, killedTarget.container.y, 0xff6b3d, 1.8, 260)
      this.spawnScorePopup(killedTarget.container.x, killedTarget.container.y, killedTarget.def.scoreValue)
      this.tweens.add({
        targets: killedTarget.container,
        scaleX: killedTarget.container.scaleX * 1.3,
        scaleY: killedTarget.container.scaleY * 1.3,
        alpha: 0,
        duration: 220,
        ease: 'Cubic.Out',
        onComplete: () => killedTarget.destroy(),
      })
      this.sound.play('sfx-kill', { volume: audioSettings.sfxVolume })
    }
  }

  private endMission(outcome: 'complete' | 'failed') {
    this.missionEnded = true
    this.weapon.setTrigger(false)

    // Secondary objectives only ever pay out on a successful extraction —
    // no partial credit for "would have kept the streak if the mission
    // hadn't failed."
    let secondaryObjectiveComplete = false
    if (outcome === 'complete') {
      const objective = missionState.current.secondaryObjective
      if (objective.type === 'no-damage') secondaryObjectiveComplete = this.noDamageTaken
      else if (objective.type === 'clean-sweep') secondaryObjectiveComplete = this.enemiesDestroyed >= this.totalEnemiesSpawned
    }

    const result: MissionResult = {
      missionId: missionState.current.id,
      outcome,
      score: this.score,
      wavesCleared: Math.min(this.waveIndex, missionState.current.waves.length),
      totalWaves: missionState.current.waves.length,
      enemiesDestroyed: this.enemiesDestroyed,
      secondaryObjectiveComplete,
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
      waveIndex: Math.min(this.waveIndex, missionState.current.waves.length - 1),
      waveCount: missionState.current.waves.length,
      enemiesRemaining: this.enemies.length,
    }
    gameEvents.emit(EVT_HUD_UPDATE, state)
  }
}
