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
  type EnemyTypeId,
  type HudState,
  type LandscapeId,
  type MissionResult,
} from '../types'
import { gameEvents } from '../events'

/** The touch pads are functionally touch-only regardless (engagePad only fires for touch
 * pointers) — this just decides whether to show them, so a mouse/trackpad player on desktop
 * doesn't see two dead thumbsticks over the combat view. */
function supportsTouch(): boolean {
  return typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0)
}

export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

const MAX_HEALTH = 100
const HORIZON_Y = 130
const HORIZON_Y_RANGE: [number, number] = [110, 165]
const IMPACT_Y_RANGE: [number, number] = [545, 610]
// Sits in the mid-ground, above where enemies grow largest/most visually busy
// (IMPACT_Y_RANGE) so it doesn't fight with them for attention.
const ESCORT_VEHICLE_Y = 460
const SPAWN_X_MARGIN = 90
const DOOR_SILL_HEIGHT = 56
// Real PixelLab death-animation frames per enemy type (see docs/ART_ASSETS.md)
// — 6 generated frames plus PixelLab's own retained reference frame as frame
// 0 (animate_object's default keep_first_frame behavior).
const DEATH_FRAME_COUNT = 7
const DEATH_FRAME_RATE = 12
// Boat reskins previously had no death animation of their own and fell back
// to silently reusing the land type's ${id}-death frames — a soldier or
// vehicle explosion playing on top of a sunk boat. Generated real ones via
// animate_image (frame_count=8 -> 9 stored frames: the boat's own idle art
// unchanged as frame 0, then 8 generated sinking/exploding frames), a
// different pipeline from the land types' animate_object-based 7, hence the
// separate frame count.
const BOAT_DEATH_FRAME_COUNT = 9
// A looping walk cycle for the approach itself (previously a single static
// frame the whole way in) — only the humanoid/soldier enemy types, since
// the PixelLab Character API this comes from doesn't support vehicles or
// aircraft (see docs/ART_ASSETS.md). South-direction only: enemies close in
// almost straight toward the viewer in this game (only minor lateral
// jitter), so the other 7 compass directions Character API generates would
// rarely if ever be seen — not worth the extra generations/complexity of
// wiring up direction-switching for a game that doesn't really have one.
const WALK_FRAME_COUNT = 8
const WALK_FRAME_RATE = 9

// combat.ogg loops from 0 (the very start, intro included) rather than a
// proper loop point — see docs/AUDIO_AND_POLISH.md. The pack's license PDF
// documents a dedicated loop-optimized export with its own exact loop
// start/length, but that file isn't in this project's copy of the pack, and
// automated waveform analysis (cross-correlation for an exact repeated
// section, an energy envelope scan for a structural intro/body boundary)
// found no strong signal either way in the file we do have — this is a
// best-guess pick from the least-weak correlation candidate, not a verified
// splice. If it still sounds like it "restarts" on loop, that's a sign this
// needs the pack's real Loopable file rather than a smaller timestamp nudge.
const COMBAT_MUSIC_LOOP_START_SEC = 29.0
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

// Difficulty scales enemy toughness, how hard/often they hit back, and the
// player's own aircraft health; spawn timing and enemy variety stay the same
// across difficulties for this prototype. fireIntervalMult multiplies each
// enemy's fireIntervalMs (>1 = fires back less often), aircraftHealthMult
// multiplies MAX_HEALTH.
const DIFFICULTY_MULTIPLIERS: Record<
  Difficulty,
  { health: number; damage: number; fireIntervalMult: number; aircraftHealthMult: number }
> = {
  easy: { health: 0.75, damage: 0.7, fireIntervalMult: 1.4, aircraftHealthMult: 1.3 },
  normal: { health: 1, damage: 1, fireIntervalMult: 1, aircraftHealthMult: 1 },
  hard: { health: 1.35, damage: 1.3, fireIntervalMult: 0.85, aircraftHealthMult: 0.9 },
}

// Texture keys are landscape-specific (not a fixed 'ground-art'/'mountains-art'
// pair reused every mission) because Phaser's texture manager caches loaded
// images by key across scene restarts: this.load.image() silently skips
// re-loading a key that's already present. A fixed key would mean the first
// landscape played in a session sticks around forever, no matter what the
// next mission's theme.landscape says.
const LANDSCAPE_GROUND_FILE: Record<LandscapeId, string> = {
  desert: 'ground.png',
  coastal: 'coastal-ground.png',
  urban: 'urban-ground.png',
  jungle: 'jungle-ground.png',
}
const LANDSCAPE_MOUNTAIN_FILE: Record<LandscapeId, string> = {
  desert: 'mountains.png',
  coastal: 'coastal.png',
  urban: 'urban.png',
  jungle: 'jungle.png',
}

// Foot soldiers and wheeled/tracked vehicles don't make sense standing on
// open water — these get a boat/watercraft reskin (public/enemies/boat-*.png)
// for coastal missions instead of their normal land sprite. Drones fly
// regardless of landscape, so they're untouched. Purely a base-texture swap
// — same stats, same death animation (see docs/ART_ASSETS.md).
const COASTAL_BOAT_TYPES: ReadonlySet<EnemyTypeId> = new Set([
  'infantry',
  'gunner',
  'rocket',
  'technical',
  'armored',
  'commander',
])

function enemyTextureKey(id: EnemyTypeId, landscape: LandscapeId): string {
  return landscape === 'coastal' && COASTAL_BOAT_TYPES.has(id) ? `boat-${id}` : `enemy-${id}`
}

/** Escort missions show a friendly boat instead of a truck on a coastal
 * landscape (e.g. Operation Riverine Shield) — same reskin idea as
 * COASTAL_BOAT_TYPES above, just for the one non-enemy ground prop. Fixed
 * keys per asset (not per-landscape) since there are only ever these two
 * variants — loaded once, cached forever, same as everything else here. */
function escortVehicleAsset(landscape: LandscapeId): { key: string; file: string } {
  return landscape === 'coastal' ? { key: 'escort-boat', file: 'escort-boat.png' } : { key: 'escort-vehicle', file: 'escort-vehicle.png' }
}

export const COMBAT_SCENE_KEY = 'combat'

export class CombatScene extends Phaser.Scene {
  private weapon!: Weapon
  private enemies: Enemy[] = []
  private crosshair!: Phaser.GameObjects.Image
  private crosshairPos = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  private ground!: Phaser.GameObjects.TileSprite
  private groundTextureKey!: string
  private mountainTextureKey!: string
  private escortVehicleTextureKey!: string
  private damageVignette!: Phaser.GameObjects.Rectangle
  private rotorFlicker!: Phaser.GameObjects.Rectangle
  private nextDustAtMs = 0
  private nextFlickerAtMs = 0
  private combatMusicSource: AudioBufferSourceNode | null = null

  private pads!: Record<PadSide, TouchPad>
  private activePad: PadSide | null = null
  private padPointerId: number | null = null
  // Last raw touch position for the active pad pointer — the *movement*
  // between this and the current touch each frame is what drives the
  // crosshair, not the position itself. null while no pad is engaged.
  private padLastPos: { x: number; y: number } | null = null

  private health = MAX_HEALTH
  private maxHealth = MAX_HEALTH
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
    super(COMBAT_SCENE_KEY)
  }

  preload() {
    const landscape = missionState.current.theme.landscape
    for (const def of Object.values(ENEMY_DEFS)) {
      const key = enemyTextureKey(def.id, landscape)
      const file = key.startsWith('boat-') ? `boat-${def.id}.png` : `${def.id}.png`
      this.load.image(key, `${import.meta.env.BASE_URL}enemies/${file}`)
      if (key.startsWith('boat-')) {
        for (let i = 0; i < BOAT_DEATH_FRAME_COUNT; i++) {
          this.load.image(`boat-${def.id}-death-${i}`, `${import.meta.env.BASE_URL}enemies/boat-${def.id}-death-${i}.png`)
        }
      } else {
        for (let i = 0; i < DEATH_FRAME_COUNT; i++) {
          this.load.image(`enemy-${def.id}-death-${i}`, `${import.meta.env.BASE_URL}enemies/${def.id}-death-${i}.png`)
        }
      }
      // Skip fetching walk frames a coastal boat reskin can never play (see
      // Enemy.ts's own textureKey guard) — key === the plain enemy-${id}
      // form specifically excludes boat-${id}, so this doesn't waste
      // bandwidth/GPU memory loading soldier walk art for a mission where
      // these types render as boats instead.
      if (def.hasWalkCycle && key === `enemy-${def.id}`) {
        for (let i = 0; i < WALK_FRAME_COUNT; i++) {
          this.load.image(`enemy-${def.id}-walk-${i}`, `${import.meta.env.BASE_URL}enemies/${def.id}-walk-${i}.png`)
        }
      }
    }
    this.groundTextureKey = `ground-art-${landscape}`
    this.mountainTextureKey = `mountains-art-${landscape}`
    this.load.image(this.groundTextureKey, `${import.meta.env.BASE_URL}env/${LANDSCAPE_GROUND_FILE[landscape]}`)
    this.load.image(this.mountainTextureKey, `${import.meta.env.BASE_URL}env/${LANDSCAPE_MOUNTAIN_FILE[landscape]}`)

    if (missionState.current.type === 'Escort') {
      const { key, file } = escortVehicleAsset(landscape)
      this.escortVehicleTextureKey = key
      this.load.image(key, `${import.meta.env.BASE_URL}env/${file}`)
    }

    this.load.audio('sfx-shot', `${import.meta.env.BASE_URL}audio/sfx/shot.wav`)
    this.load.audio('sfx-kill', `${import.meta.env.BASE_URL}audio/sfx/kill.wav`)
    this.load.audio('sfx-aircraft-damage', `${import.meta.env.BASE_URL}audio/sfx/aircraft_damage.wav`)
    this.load.audio('sfx-overheat', `${import.meta.env.BASE_URL}audio/sfx/overheat.wav`)
    this.load.audio('music-combat', `${import.meta.env.BASE_URL}audio/music/combat.ogg`)
  }

  create() {
    this.maxHealth = Math.round(MAX_HEALTH * DIFFICULTY_MULTIPLIERS[audioSettings.difficulty].aircraftHealthMult)
    this.health = this.maxHealth
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
    this.buildEnemyAnimations()
    if (missionState.current.type === 'Escort') this.buildEscortVehicle()
    this.buildHelicopterFrame()
    this.buildVfxTextures()
    this.buildDamageVignette()
    this.buildRotorFlicker()
    this.buildCrosshair()
    this.buildTouchPad()
    this.setupInput()

    this.playCombatMusic()
    // Real mission-end path (GameCanvas unmounting -> game.destroy()) tears
    // scenes down via Systems.destroy(), which only ever emits DESTROY, not
    // SHUTDOWN (that's reserved for scene.stop()/restart() transitions) —
    // registering on SHUTDOWN alone meant this never fired in production,
    // only in a test that used scene.restart() to simulate it. Registered
    // on both: stopCombatMusic() is safe to call twice (combatMusicSource
    // is nulled out after the first stop, so a second call is a no-op).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopCombatMusic())
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.stopCombatMusic())

    this.emitHud()
  }

  /**
   * Plays combat.ogg once through in full (intro included), then loops only
   * [COMBAT_MUSIC_LOOP_START_SEC, end] forever after — using the raw Web
   * Audio API's native `AudioBufferSourceNode.loopStart`/`loopEnd` rather
   * than Phaser's `sound.play({ loop: true })`, which always loops the
   * entire buffer back to 0 with no way to offset just the *repeat* passes.
   * Falls back to Phaser's normal whole-buffer loop if the WebAudio backend
   * isn't active (e.g. HTML5 Audio fallback) or the buffer isn't a decoded
   * AudioBuffer in the cache.
   *
   * gain.gain.value is set once here from audioSettings.musicVolume and
   * never re-read — unlike uiSound.ts/musicPlayer.ts, which re-read it on
   * every play, or CombatScene's other this.sound.play(...) SFX calls,
   * which do the same. That's fine only because Settings isn't reachable
   * once a mission is running (no way to change musicVolume/mute mid-
   * combat today) — if that ever changes, this needs to become a live
   * subscription instead of a snapshot.
   */
  private playCombatMusic() {
    const soundManager = this.sound
    // The decoded buffer lives directly in the WebAudio-backend loader's
    // cache under the same key passed to load.audio() in preload().
    const buffer = this.cache.audio.get('music-combat') as unknown
    if (!(soundManager instanceof Phaser.Sound.WebAudioSoundManager) || !(buffer instanceof AudioBuffer)) {
      this.sound.play('music-combat', { loop: true, volume: audioSettings.musicVolume })
      return
    }

    const context = soundManager.context
    const gain = context.createGain()
    gain.gain.value = audioSettings.musicVolume
    gain.connect(context.destination)

    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopStart = Math.min(COMBAT_MUSIC_LOOP_START_SEC, buffer.duration - 1)
    source.loopEnd = buffer.duration
    source.connect(gain)
    source.start(0)

    this.combatMusicSource = source
  }

  private stopCombatMusic() {
    this.combatMusicSource?.stop()
    this.combatMusicSource = null
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
    const mountains = this.add.image(WORLD_WIDTH / 2, HORIZON_Y, this.mountainTextureKey)
    mountains.setOrigin(0.5, 1)
    mountains.setDisplaySize(WORLD_WIDTH, 90)
    mountains.setAlpha(theme.mountainAlpha)
    mountains.setTint(theme.mountainTint)

    this.ground = this.add.tileSprite(
      WORLD_WIDTH / 2,
      HORIZON_Y + (WORLD_HEIGHT - HORIZON_Y) / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT - HORIZON_Y,
      this.groundTextureKey,
    )
    this.ground.setTint(theme.groundTint)

    // Distance shading: fades the ground darker near the helicopter to fake
    // camera height/perspective without needing a warped mesh.
    const shading = this.add.graphics()
    shading.fillGradientStyle(theme.groundTint, theme.groundTint, 0x2a1f18, 0x2a1f18, 0, 0, 0.55, 0.55)
    shading.fillRect(0, HORIZON_Y, WORLD_WIDTH, WORLD_HEIGHT - HORIZON_Y)
  }

  /**
   * A friendly ground vehicle sitting in the mid-ground for Escort-type
   * missions ("Operation Steel Convoy" today) — sells the "you're escorting
   * this convoy" premise instead of the ground just being empty terrain.
   * Purely decorative: never added to `this.enemies`, so containsPoint/
   * handleFiring can never target or damage it. Held roughly fixed on
   * screen (a gentle bob, not a scroll) since it travels at the same pace
   * as the helicopter — same reasoning the helicopter itself never moves
   * on screen, only the ground scrolls under both of them.
   */
  private buildEscortVehicle() {
    const vehicle = this.add.image(WORLD_WIDTH / 2, ESCORT_VEHICLE_Y, this.escortVehicleTextureKey)
    vehicle.setDisplaySize(96, 96)
    vehicle.setDepth(60)
    this.tweens.add({
      targets: vehicle,
      y: ESCORT_VEHICLE_Y + 6,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
    // A slower, wider sway on a different period than the vertical bob so
    // the two don't lock into an obvious repeating diagonal loop — reads as
    // a vehicle picking its way over uneven ground rather than a static
    // prop with a single canned wiggle.
    this.tweens.add({
      targets: vehicle,
      x: WORLD_WIDTH / 2 + 14,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
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

  /**
   * Registers `${id}-death` on the shared Phaser AnimationManager (global
   * across scenes, like the texture cache — this.anims.create() is a no-op
   * with a warning if the key's already registered from a prior mission, the
   * same dedup buildEnemyTexture relies on via textures.exists).
   */
  private buildEnemyAnimations() {
    const landscape = missionState.current.theme.landscape
    for (const def of Object.values(ENEMY_DEFS)) {
      const key = enemyTextureKey(def.id, landscape)

      // Boat reskins get their own death animation (real sinking/exploding
      // frames, generated per boat type via animate_image) instead of
      // silently falling back to the land type's ${id}-death — that used to
      // play a soldier collapsing or a truck exploding on top of a boat.
      if (key.startsWith('boat-')) {
        const boatDeathKey = `boat-${def.id}-death`
        if (!this.anims.exists(boatDeathKey)) {
          this.anims.create({
            key: boatDeathKey,
            frames: Array.from({ length: BOAT_DEATH_FRAME_COUNT }, (_, i) => ({ key: `boat-${def.id}-death-${i}` })),
            frameRate: DEATH_FRAME_RATE,
            repeat: 0,
          })
        }
      } else {
        const deathKey = `${def.id}-death`
        if (!this.anims.exists(deathKey)) {
          this.anims.create({
            key: deathKey,
            frames: Array.from({ length: DEATH_FRAME_COUNT }, (_, i) => ({ key: `enemy-${def.id}-death-${i}` })),
            frameRate: DEATH_FRAME_RATE,
            repeat: 0,
          })
        }
      }

      // Same gate preload() uses to decide whether it fetched walk frames
      // this mission — registering the animation without that guard would
      // reference texture keys that were never loaded on a coastal mission
      // (boat reskin), the first time a humanoid type happens to spawn
      // coastal before spawning anywhere else this session.
      const walkKey = `${def.id}-walk`
      if (def.hasWalkCycle && key === `enemy-${def.id}` && !this.anims.exists(walkKey)) {
        this.anims.create({
          key: walkKey,
          frames: Array.from({ length: WALK_FRAME_COUNT }, (_, i) => ({ key: `enemy-${def.id}-walk-${i}` })),
          frameRate: WALK_FRAME_RATE,
          repeat: -1,
        })
      }
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

  /** Always built (touch-only functionally — engagePad only fires for touch pointers — but the
   * visuals are hidden on devices with no touch support so a mouse/trackpad player doesn't see
   * two dead thumbsticks sitting over their screen). */
  private buildTouchPad() {
    this.pads = {
      left: this.buildPadSide(TOUCH_PAD_MARGIN_X),
      right: this.buildPadSide(WORLD_WIDTH - TOUCH_PAD_MARGIN_X),
    }
  }

  private buildPadSide(x: number): TouchPad {
    const center = { x, y: TOUCH_PAD_Y }
    const visible = supportsTouch()

    const ring = this.add.circle(center.x, center.y, TOUCH_PAD_RADIUS, 0xffffff, 0.08)
    ring.setStrokeStyle(2, 0xffffff, 0.35)
    ring.setDepth(2100)
    ring.setVisible(visible)
    const knob = this.add.circle(center.x, center.y, 26, 0xffffff, 0.25)
    knob.setDepth(2101)
    knob.setVisible(visible)

    const label = this.add.text(center.x, center.y + TOUCH_PAD_RADIUS + 16, 'AIM', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
    })
    label.setOrigin(0.5, 0)
    label.setAlpha(0.35)
    label.setDepth(2100)
    label.setVisible(visible)

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
      fireIntervalMs: Math.round(baseDef.fireIntervalMs * mult.fireIntervalMult),
    }
    const textureKey = enemyTextureKey(baseDef.id, missionState.current.theme.landscape)
    const enemy = new Enemy(this, def, this.spawnPoint(), textureKey, this.time.now)
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
    // Staggered across the hit circle, not always dead-center — at high
    // Fire Rate upgrade levels, every shot landing on the exact same pixel
    // reads as a static laser dot rather than a stream of separate hits.
    const impact = target.randomImpactPoint()
    this.spawnSpark(impact.x, impact.y, 0xffa64d, 0.8, 140)

    const killed = target.takeDamage(this.weapon.damagePerShot)
    if (killed) {
      const killedTarget = target
      this.score += killedTarget.def.scoreValue
      this.enemiesDestroyed += 1
      this.enemies = this.enemies.filter((e) => e !== killedTarget)
      this.spawnSpark(killedTarget.container.x, killedTarget.container.y, 0xff6b3d, 1.8, 260)
      this.spawnScorePopup(killedTarget.container.x, killedTarget.container.y, killedTarget.def.scoreValue)
      // Real death-animation frames (docs/ART_ASSETS.md) replace the old
      // placeholder scale-up-and-fade — a short fade after the animation's
      // last frame avoids an abrupt pop when the container is destroyed.
      killedTarget.playDeath(() => {
        this.tweens.add({
          targets: killedTarget.container,
          alpha: 0,
          duration: 200,
          ease: 'Cubic.Out',
          onComplete: () => killedTarget.destroy(),
        })
      })
      this.sound.play('sfx-kill', { volume: audioSettings.sfxVolume })
    } else {
      target.playHitFlinch()
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
      difficulty: audioSettings.difficulty,
    }
    gameEvents.emit(outcome === 'complete' ? EVT_MISSION_COMPLETE : EVT_MISSION_FAILED, result)
  }

  private emitHud() {
    const state: HudState = {
      health: this.health,
      maxHealth: this.maxHealth,
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
