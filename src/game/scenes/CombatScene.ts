import Phaser from 'phaser'
import { audioSettings } from '../../audio/audioSettings'
import type { Difficulty } from '../../firebase/playerProfile'
import { computeGunStats, getGunDef, type GunDef } from '../data/guns'
import { ENEMY_DEFS } from '../data/enemyTypes'
import { missionState } from '../missionState'
import { Enemy, type EnemySpawnPoint } from '../entities/Enemy'
import { HealthPickup } from '../entities/HealthPickup'
import { computeBarFill } from '../entities/healthBarFill'
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
import { WORLD_WIDTH, WORLD_HEIGHT } from '../worldConstants'

export { WORLD_WIDTH, WORLD_HEIGHT }

/** The touch pads are functionally touch-only regardless (engageMove/engageFire only fire for
 * touch pointers) — this just decides whether to show them, so a mouse/trackpad player on
 * desktop doesn't see two dead thumbsticks over the combat view. */
function supportsTouch(): boolean {
  return typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0)
}

const MAX_HEALTH = 100
const HEALTH_CRATE_TEXTURE = 'pickup-health-crate'
// Rolled once per wave-clear rather than continuously — ties resupply pacing to the game's
// existing natural rhythm instead of a separate timer. Both amounts are independently tunable
// balance knobs, not derived from anything else.
const HEALTH_CRATE_SPAWN_CHANCE = 0.5
const HEALTH_CRATE_HEAL_AMOUNT = 25
// A rarer, unannounced bonus on top of the deliberate crate-shooting above — most kills are just
// kills, but every one gets a coin flip against this chance. spawnHealEffect (see
// applyAircraftHeal) is what makes an otherwise-invisible bonus actually register to the player.
const KILL_HEAL_CHANCE = 0.08
const KILL_HEAL_AMOUNT = 10
const HORIZON_Y = 130
const HORIZON_Y_RANGE: [number, number] = [110, 165]
const IMPACT_Y_RANGE: [number, number] = [545, 610]
// Sits in the mid-ground, above where enemies grow largest/most visually busy
// (IMPACT_Y_RANGE) so it doesn't fight with them for attention.
const ESCORT_VEHICLE_Y = 460
const SPAWN_X_MARGIN = 90
// Hover missions ("Base Defense") — see docs/PROGRESS.md. Kept as its own named constant
// even though it shares ESCORT_VEHICLE_Y's value, since Escort and hover missions never
// coexist and the two concepts shouldn't be coupled just because they land on the same y.
const DEFEND_OBJECTIVE_Y = 460
// Bigger than the escort vehicle's 96 — props read larger on a small mobile screen without
// needing a camera zoom (which would clip the touch pads — they're rendered in raw world
// coordinates with no scroll-factor exemption, so zooming the one shared camera moves/enlarges
// them right off the edges of the screen; verified by the math before going this route
// instead). The placement zone itself (see COVER_X_MARGIN in coverGenerator.ts) stays spread
// out across most of the field — bigger sprites, not a cramped cluster, is what reads "bigger."
const COVER_OBJECT_SIZE = 140
const DEFEND_OBJECTIVE_SIZE = 140
// A hover-mode enemy's spawn point is the cover object it emerges from; its target is a
// nearby "peek out" attack point this far to one side (random), staying close to the cover's
// own y (HOVER_Y_SAFE_MARGIN below) rather than the flight-mode IMPACT_Y_RANGE band, which
// sits well below where hover cover is actually placed.
const HOVER_ATTACK_OFFSET_MIN = 50
const HOVER_ATTACK_OFFSET_MAX = 90
const HOVER_ATTACK_Y_JITTER = 20
// Keeps hover enemy attack positions (and, incidentally, anything else placed with it) safely
// inside the canvas regardless of which cover object they're near.
const HOVER_Y_SAFE_MARGIN = 100
const HOVER_X_SAFE_MARGIN = 180
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
// Both a left and a right pad exist simultaneously (no handedness setting — the player just
// uses whichever thumb suits them) but they're not independent thumbsticks: whichever side is
// touched first becomes the move/aim pad for as long as it's held, and the OTHER side doubles
// as a hold-to-fire button for that same span — movement alone never fires, and firing alone
// never moves the crosshair. Releasing the move side ends the whole engagement (stops firing
// too, even if the fire thumb is still down) and resets both back to idle circles until either
// is touched again. See engageMove/engageFire/releaseMove/releaseFire.
const TOUCH_PAD_Y = WORLD_HEIGHT - 150
const TOUCH_PAD_MARGIN_X = 150
const TOUCH_PAD_RADIUS = 80
// Generous vs. the visual radius so a slightly-off first touch still grabs
// the pad — once engaged, dragging can go beyond the ring (clamped for the
// knob's rendered position, not for how it's interpreted as input).
const TOUCH_PAD_ACTIVATION_RADIUS = 110
const TOUCH_PAD_SENSITIVITY = 2.2
// Mobile hold-to-zoom button, placed away from both aim pads (bottom-center)
// so a thumb can hold zoom while the other thumb drags the aim pad — tracked
// by its own touch pointer id, entirely independent of the aim pads'
// one-live-pad-at-a-time exclusivity.
const ZOOM_BUTTON_X = WORLD_WIDTH / 2
const ZOOM_BUTTON_Y = WORLD_HEIGHT - 90
const ZOOM_BUTTON_RADIUS = 44
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
  // Holds ring/knob/label at local (0,0)-relative positions — see syncTouchUiForZoom, which
  // repositions/rescales this container every frame to counter the camera's current zoom, so
  // the pad stays visually fixed on screen regardless of a zoom-capable gun's zoom level.
  container: Phaser.GameObjects.Container
  ring: Phaser.GameObjects.Arc
  knob: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
}
// The pad a player isn't using to move doubles as a hold-to-fire button — a distinct color
// from the idle/move "AIM" styling so it visibly reads as a different control once toggled.
const FIRE_BUTTON_COLOR = 0xfff3c4

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
  private equippedGunDef!: GunDef
  private enemies: Enemy[] = []
  private healthPickups: HealthPickup[] = []
  private crosshair!: Phaser.GameObjects.Image
  private crosshairPos = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  // Recomputed every frame from crosshairPos + the weapon's current recoil
  // offset — the only thing recoil ever touches. crosshairPos itself stays
  // the untouched source of true aim intent (mouse-absolute, touch-relative
  // + aim-assist), so aim-assist keeps pulling toward the player's real
  // target even while recoil is visually displacing where shots land.
  private effectiveAim = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  // Whether the camera is currently zoomed in — desktop sets this via a right-click *hold*
  // (see setupInput's mouse branch), but mobile's zoom button is a tap *toggle* instead (a
  // hold would tie up the thumb that's needed for the fire button once move/fire are split
  // across the two aim pads), hence the input-neutral name rather than "zoomHeld".
  private zoomActive = false
  private zoomButton?: Phaser.GameObjects.Arc
  // See TouchPad.container's comment — same zoom-compensation treatment.
  private zoomButtonContainer?: Phaser.GameObjects.Container
  private ground!: Phaser.GameObjects.TileSprite
  private groundTextureKey!: string
  private mountainTextureKey!: string
  private escortVehicleTextureKey!: string
  // Hover missions ("Base Defense") only — see buildCoverObjects/buildDefendObjective.
  private coverDepthById = new Map<string, number>()
  private defendObjectiveSprite?: Phaser.GameObjects.Image
  private objectiveHealthBarBg?: Phaser.GameObjects.Rectangle
  private objectiveHealthBarFill?: Phaser.GameObjects.Rectangle
  private objectiveHealth = 0
  private objectiveMaxHealth = 0
  private objectiveNoDamageTaken = true
  private damageVignette!: Phaser.GameObjects.Rectangle
  private rotorFlicker!: Phaser.GameObjects.Rectangle
  private nextDustAtMs = 0
  private nextFlickerAtMs = 0
  private combatMusicSource: AudioBufferSourceNode | null = null

  private pads!: Record<PadSide, TouchPad>
  // Whichever side the player is currently using to move/aim — the other side doubles as a
  // fire button for the duration of this engagement. null when neither pad is touched, at
  // which point both show as plain idle circles until either one is touched again.
  private moveSide: PadSide | null = null
  private movePointerId: number | null = null
  // Last raw touch position for the move pointer — the *movement* between this and the
  // current touch each frame is what drives the crosshair, not the position itself. null
  // while no pad is engaged.
  private movePadLastPos: { x: number; y: number } | null = null
  // The touch pointer currently holding the fire button (the side opposite moveSide), if any.
  private fireTouchPointerId: number | null = null

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
    this.load.image(HEALTH_CRATE_TEXTURE, `${import.meta.env.BASE_URL}env/health-crate.png`)

    if (missionState.current.type === 'Escort') {
      const { key, file } = escortVehicleAsset(landscape)
      this.escortVehicleTextureKey = key
      this.load.image(key, `${import.meta.env.BASE_URL}env/${file}`)
    }

    if (missionState.current.mode === 'hover') {
      for (const variant of ['crates', 'sandbags', 'rubble', 'rocks'] as const) {
        this.load.image(`cover-${variant}`, `${import.meta.env.BASE_URL}env/cover-${variant}.png`)
      }
      const art = missionState.current.defendObjective!.artVariant
      this.load.image(`objective-${art}`, `${import.meta.env.BASE_URL}env/objective-${art}.png`)
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
    this.healthPickups = []
    this.coverDepthById.clear()
    this.objectiveNoDamageTaken = true
    this.objectiveMaxHealth = missionState.current.defendObjective?.maxHealth ?? 0
    this.objectiveHealth = this.objectiveMaxHealth
    this.zoomActive = false
    this.equippedGunDef = getGunDef(playerLoadout.equippedGun)
    this.weapon = new Weapon(
      computeGunStats(this.equippedGunDef, playerLoadout.unlockedUpgrades),
      this.equippedGunDef.heatPerShot,
      this.equippedGunDef.recoil,
    )
    this.cameras.main.setZoom(1)
    this.input.mouse?.disableContextMenu()

    this.buildBackground()
    this.buildEnemyTextures()
    this.buildEnemyAnimations()
    if (missionState.current.type === 'Escort') this.buildEscortVehicle()
    if (missionState.current.mode === 'hover') {
      this.buildCoverObjects()
      this.buildDefendObjective()
    }
    this.buildHelicopterFrame()
    this.buildVfxTextures()
    this.buildDamageVignette()
    this.buildRotorFlicker()
    this.buildCrosshair()
    this.buildTouchPad()
    if (this.equippedGunDef.zoom.enabled) this.buildZoomButton()
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
   * Stationary terrain cover for hover missions — enemies spawn behind these and emerge
   * from them (see hoverSpawnPoint/Enemy's hover branch). Deliberately no idle tween, unlike
   * buildEscortVehicle's convoy prop: the user asked for visibly stationary obstacles, not a
   * riding-along vehicle. Depth is purely y-based (consistent with everything else in the
   * scene's pseudo-3D depth sort), recorded per cover id so Enemy can render behind/in front
   * of the specific cover it emerged from.
   */
  private buildCoverObjects() {
    for (const placement of missionState.current.coverObjects ?? []) {
      const img = this.add.image(placement.x, placement.y, `cover-${placement.variant}`)
      img.setDisplaySize(COVER_OBJECT_SIZE, COVER_OBJECT_SIZE)
      const depth = Math.floor(placement.y)
      img.setDepth(depth)
      this.coverDepthById.set(placement.id, depth)
    }
  }

  /**
   * The thing hover missions defend — a fixed ground prop plus an in-world health bar
   * (modeled on Enemy's own) so damage is visible on the objective itself, not just in the
   * HUD. Explicitly stationary (no idle bob/sway, unlike buildEscortVehicle's convoy prop) —
   * this is meant to read as a planted structure (relay tower, depot, checkpoint), not
   * something riding along on uneven ground. It still reacts to being hit (see
   * applyObjectiveDamage's angle-shake tween).
   */
  private buildDefendObjective() {
    const objective = missionState.current.defendObjective
    if (!objective) return

    const sprite = this.add.image(WORLD_WIDTH / 2, DEFEND_OBJECTIVE_Y, `objective-${objective.artVariant}`)
    sprite.setDisplaySize(DEFEND_OBJECTIVE_SIZE, DEFEND_OBJECTIVE_SIZE)
    sprite.setDepth(Math.floor(DEFEND_OBJECTIVE_Y))
    this.defendObjectiveSprite = sprite

    const barY = DEFEND_OBJECTIVE_Y - DEFEND_OBJECTIVE_SIZE / 2 - 14
    this.objectiveHealthBarBg = this.add.rectangle(WORLD_WIDTH / 2, barY, 60, 7, 0x000000, 0.55)
    this.objectiveHealthBarBg.setDepth(2200)
    this.objectiveHealthBarFill = this.add.rectangle(WORLD_WIDTH / 2, barY, 60, 7, 0x4ea8f2, 0.95)
    this.objectiveHealthBarFill.setDepth(2201)
  }

  /** Fixed anchor, not the objective sprite's own live (tweened/shaking) position — same
   * reasoning GUN_ORIGIN is a fixed anchor rather than the crosshair's live position. */
  private objectivePosition(): { x: number; y: number } {
    return { x: WORLD_WIDTH / 2, y: DEFEND_OBJECTIVE_Y }
  }

  private updateObjectiveHealthBar() {
    if (!this.objectiveHealthBarFill || !this.objectiveMaxHealth) return
    const fill = computeBarFill(this.objectiveHealth / this.objectiveMaxHealth, 60, 0x4ea8f2)
    this.objectiveHealthBarFill.width = fill.width
    this.objectiveHealthBarFill.x = WORLD_WIDTH / 2 + fill.x
    this.objectiveHealthBarFill.fillColor = fill.color
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

  /** Always built (touch-only functionally — engageMove/engageFire only fire for touch
   * pointers — but the visuals are hidden on devices with no touch support so a mouse/
   * trackpad player doesn't see two dead thumbsticks sitting over their screen). */
  private buildTouchPad() {
    this.pads = {
      left: this.buildPadSide(TOUCH_PAD_MARGIN_X),
      right: this.buildPadSide(WORLD_WIDTH - TOUCH_PAD_MARGIN_X),
    }
  }

  private buildPadSide(x: number): TouchPad {
    const center = { x, y: TOUCH_PAD_Y }
    const visible = supportsTouch()

    // Children are positioned local-to-(0,0) — the container itself carries them to `center`
    // and is what syncTouchUiForZoom repositions/rescales every frame, not these directly.
    const ring = this.add.circle(0, 0, TOUCH_PAD_RADIUS, 0xffffff, 0.08)
    ring.setStrokeStyle(2, 0xffffff, 0.35)
    const knob = this.add.circle(0, 0, 26, 0xffffff, 0.25)

    // Starts idle — either pad could become move or fire depending on which is touched
    // first, so the label says both until a role is actually assigned (see setPadRole).
    const label = this.add.text(0, TOUCH_PAD_RADIUS + 16, 'FIRE/MOVE', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
    })
    label.setOrigin(0.5, 0)
    label.setAlpha(0.35)

    const container = this.add.container(center.x, center.y, [ring, knob, label])
    container.setDepth(2100)
    container.setVisible(visible)

    return { center, container, ring, knob, label }
  }

  /** Switches one pad's visuals between the three states a touch engagement cycles through:
   * idle (neither pad touched — either role is still possible, so the label names both),
   * move (this side is currently being dragged to aim — never fires by itself), and fire
   * (the side opposite whichever is moving, a plain hold-to-fire button). */
  private setPadRole(side: PadSide, role: 'idle' | 'move' | 'fire') {
    const pad = this.pads[side]
    if (role === 'move') {
      pad.ring.setStrokeStyle(2, FIRE_BUTTON_COLOR, 0.6)
      pad.ring.setFillStyle(0xffffff, 0.08)
      pad.label.setText('MOVE')
      pad.label.setColor('#ffffff')
    } else if (role === 'fire') {
      pad.ring.setStrokeStyle(2, FIRE_BUTTON_COLOR, 0.7)
      pad.ring.setFillStyle(0xffffff, 0.08)
      pad.label.setText('FIRE')
      pad.label.setColor('#fff3c4')
    } else {
      pad.ring.setStrokeStyle(2, 0xffffff, 0.35)
      pad.ring.setFillStyle(0xffffff, 0.08)
      pad.knob.setPosition(0, 0) // local to the container, not pad.center — see buildPadSide
      pad.label.setText('FIRE/MOVE')
      pad.label.setColor('#ffffff')
    }
  }

  /** Brightens the fire pad's ring while actually held, for tactile confirmation a tap
   * registered — separate from setPadRole('fire') so it can layer on top without needing to
   * re-set the label/stroke color each press. */
  private setFirePressed(side: PadSide, pressed: boolean) {
    this.pads[side].ring.setFillStyle(0xffffff, pressed ? 0.22 : 0.08)
  }

  /** Mobile tap-to-toggle zoom button — only built when the equipped gun has zoom enabled.
   * A toggle rather than a hold: once move/fire are split across the two aim pads, both
   * thumbs are already spoken for, so there's no spare thumb left to hold a third button
   * down while also firing. Tap once to zoom in, tap again to zoom back out. */
  private buildZoomButton() {
    const visible = supportsTouch()
    // Local-origin children, same container-based zoom-compensation treatment as the aim
    // pads — see TouchPad.container's comment and syncTouchUiForZoom.
    const button = this.add.circle(0, 0, ZOOM_BUTTON_RADIUS, 0xffffff, 0.1)
    button.setStrokeStyle(2, 0xf2c14e, 0.5)

    const label = this.add.text(0, 0, 'ZOOM', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f2c14e',
    })
    label.setOrigin(0.5, 0.5)

    const container = this.add.container(ZOOM_BUTTON_X, ZOOM_BUTTON_Y, [button, label])
    container.setDepth(2100)
    container.setVisible(visible)

    this.zoomButton = button
    this.zoomButtonContainer = container
  }

  /** Reflects the current on/off zoom state on the mobile button, regardless of whether it
   * was toggled by touch or (in principle) is active for some other reason — called once per
   * frame in update() rather than threaded through every place zoomActive changes. */
  private setZoomButtonVisual(active: boolean) {
    if (!this.zoomButton) return
    this.zoomButton.setFillStyle(0xf2c14e, active ? 0.35 : 0.1)
    this.zoomButton.setStrokeStyle(2, 0xf2c14e, active ? 0.9 : 0.5)
  }

  /** Counter-scales/repositions the touch-control containers (aim pads, zoom button) so they
   * stay visually fixed on screen regardless of the camera's current zoom — these are UI
   * controls a thumb rests on, not world elements, and shouldn't visually drift or resize just
   * because a zoom-capable gun happens to be zoomed in. Works by pre-dividing each container's
   * position (relative to the camera's fixed center) and scale by the current zoom, so the
   * camera's own zoom multiplication exactly cancels out — the container ends up rendered
   * exactly where/how big it would be at zoom 1, at any zoom level. (The crosshair is
   * deliberately NOT treated this way — it's supposed to shift with the zoomed world, like a
   * real scope reticle tracking the same target as the world magnifies around it; see
   * updateCrosshairFromMouse's getWorldPoint conversion, which is the correct handling for
   * that case.) A no-op at zoom 1 (identity transform), so this is safe to call every frame
   * unconditionally rather than gating it on whether zoom is currently active. */
  private syncTouchUiForZoom() {
    const zoom = this.cameras.main.zoom
    const centerX = WORLD_WIDTH / 2
    const centerY = WORLD_HEIGHT / 2
    const compensate = (container: Phaser.GameObjects.Container, nominalX: number, nominalY: number) => {
      container.setScale(1 / zoom)
      container.setPosition(centerX + (nominalX - centerX) / zoom, centerY + (nominalY - centerY) / zoom)
    }
    compensate(this.pads.left.container, this.pads.left.center.x, this.pads.left.center.y)
    compensate(this.pads.right.container, this.pads.right.center.x, this.pads.right.center.y)
    if (this.zoomButtonContainer) compensate(this.zoomButtonContainer, ZOOM_BUTTON_X, ZOOM_BUTTON_Y)
  }

  private hitsZoomButton(pointer: Phaser.Input.Pointer): boolean {
    if (!this.zoomButton) return false
    return Phaser.Math.Distance.Between(pointer.x, pointer.y, ZOOM_BUTTON_X, ZOOM_BUTTON_Y) <= ZOOM_BUTTON_RADIUS
  }

  /** Converts a raw screen-space pointer to world coordinates when zoomed — the
   * camera's zoom pivots around its fixed center (this scene never pans), so
   * everything downstream of crosshairPos (clamps, aim-assist, hit-testing) stays
   * correct with no further changes since getWorldPoint always returns the same
   * 0..WORLD_WIDTH/HEIGHT space regardless of zoom. */
  private updateCrosshairFromMouse(pointer: Phaser.Input.Pointer) {
    const zoom = this.cameras.main.zoom
    const world = zoom !== 1 ? this.cameras.main.getWorldPoint(pointer.x, pointer.y) : pointer
    this.crosshairPos.x = Phaser.Math.Clamp(world.x, 0, WORLD_WIDTH)
    this.crosshairPos.y = Phaser.Math.Clamp(world.y, 0, WORLD_HEIGHT)
  }

  /** Only reachable while no side is engaged yet — the first touch on either pad claims that
   * side for movement (aim only; holding it alone never fires) and turns the OTHER pad into a
   * fire button for as long as this movement engagement lasts. */
  private engageMove(pointer: Phaser.Input.Pointer): boolean {
    if (this.moveSide !== null) return false

    for (const side of ['left', 'right'] as const) {
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.pads[side].center.x, this.pads[side].center.y)
      if (dist > TOUCH_PAD_ACTIVATION_RADIUS) continue

      this.moveSide = side
      this.movePointerId = pointer.id
      this.movePadLastPos = { x: pointer.x, y: pointer.y }
      this.setPadRole(side, 'move')
      this.setPadRole(side === 'left' ? 'right' : 'left', 'fire')
      this.updatePadKnobVisual(pointer)
      return true
    }
    return false
  }

  /** Only reachable once movement is already engaged — a touch on the fire-labeled pad (the
   * side opposite moveSide) fires for as long as it's held, same trigger the mouse/desktop
   * path uses. Doesn't aim; the move pad already owns that. */
  private engageFire(pointer: Phaser.Input.Pointer): boolean {
    if (this.moveSide === null || this.fireTouchPointerId !== null) return false
    const fireSide = this.moveSide === 'left' ? 'right' : 'left'
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.pads[fireSide].center.x, this.pads[fireSide].center.y)
    if (dist > TOUCH_PAD_ACTIVATION_RADIUS) return false

    this.fireTouchPointerId = pointer.id
    this.setFirePressed(fireSide, true)
    this.weapon.setTrigger(true)
    return true
  }

  /** Trackpad-style: crosshair moves by the finger's *movement* since last frame, not its
   * absolute position — stops the instant the finger stops, unlike a deflection-based stick. */
  private updatePadDrag(pointer: Phaser.Input.Pointer) {
    if (!this.movePadLastPos) return
    const deltaX = pointer.x - this.movePadLastPos.x
    const deltaY = pointer.y - this.movePadLastPos.y
    this.movePadLastPos = { x: pointer.x, y: pointer.y }

    // A fixed finger-pixel movement maps to a smaller world-space movement
    // while zoomed in, matching the reduced sensitivity a magnified scope
    // implies (mirrors updateCrosshairFromMouse's getWorldPoint conversion).
    const zoom = this.cameras.main.zoom
    this.crosshairPos.x = Phaser.Math.Clamp(this.crosshairPos.x + (deltaX * TOUCH_PAD_SENSITIVITY) / zoom, 0, WORLD_WIDTH)
    this.crosshairPos.y = Phaser.Math.Clamp(this.crosshairPos.y + (deltaY * TOUCH_PAD_SENSITIVITY) / zoom, 0, WORLD_HEIGHT)
    this.applyTouchAimAssist()

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

  /** Knob just shows "which way is the finger currently offset" — purely visual, doesn't drive
   * aim. dx/dy compare the raw pointer against the pad's nominal (unzoomed) center, same as
   * the activation-radius hit-test — correct regardless of zoom since neither side of that
   * comparison is ever actually rendered-and-zoomed. The knob's own position is set local to
   * the container (see buildPadSide), which is what actually gets zoom-compensated. */
  private updatePadKnobVisual(pointer: Phaser.Input.Pointer) {
    if (!this.moveSide) return
    const pad = this.pads[this.moveSide]
    const dx = pointer.x - pad.center.x
    const dy = pointer.y - pad.center.y
    const dist = Math.max(1, Math.hypot(dx, dy))
    const knobDist = Math.min(dist, TOUCH_PAD_RADIUS)
    pad.knob.setPosition((dx / dist) * knobDist, (dy / dist) * knobDist)
  }

  /** Ends the whole touch-control engagement — releasing movement stops firing too (even if
   * the fire thumb is still physically down) and resets both pads back to idle circles, per
   * the design: only a fresh touch on either pad re-establishes move/fire roles. */
  private releaseMove() {
    if (this.moveSide) {
      this.setPadRole(this.moveSide, 'idle')
      this.setPadRole(this.moveSide === 'left' ? 'right' : 'left', 'idle')
    }
    this.moveSide = null
    this.movePointerId = null
    this.movePadLastPos = null
    this.fireTouchPointerId = null
    this.weapon.setTrigger(false)
  }

  /** Releasing just the fire thumb stops firing but leaves movement (and the fire pad's
   * labeling) engaged — only releasing the move side ends the engagement entirely. */
  private releaseFire() {
    if (this.moveSide !== null) {
      this.setFirePressed(this.moveSide === 'left' ? 'right' : 'left', false)
    }
    this.fireTouchPointerId = null
    this.weapon.setTrigger(false)
  }

  private setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        if (this.zoomButton && this.hitsZoomButton(pointer)) {
          // A tap toggle, not a hold — see buildZoomButton's doc comment. Releasing this
          // same touch (pointerup/pointerout below) deliberately does nothing.
          this.zoomActive = !this.zoomActive
          return
        }
        if (this.moveSide === null) this.engageMove(pointer)
        else this.engageFire(pointer)
        return
      }
      if (this.equippedGunDef.zoom.enabled && pointer.rightButtonDown()) {
        this.zoomActive = true
        return // right-click zooms, doesn't fire — desktop keeps hold-to-zoom
      }
      this.updateCrosshairFromMouse(pointer)
      this.weapon.setTrigger(true)
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        if (pointer.id === this.movePointerId) this.updatePadDrag(pointer)
        return
      }
      this.updateCrosshairFromMouse(pointer)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        if (pointer.id === this.movePointerId) {
          this.releaseMove()
        } else if (pointer.id === this.fireTouchPointerId) {
          this.releaseFire()
        }
        return
      }
      if (pointer.button === 2) {
        this.zoomActive = false
        return
      }
      this.weapon.setTrigger(false)
    })
    this.input.on('pointerout', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        if (pointer.id === this.movePointerId) this.releaseMove()
        else if (pointer.id === this.fireTouchPointerId) this.releaseFire()
        return
      }
      this.zoomActive = false
      this.weapon.setTrigger(false)
    })
  }

  private currentWave() {
    return missionState.current.waves[this.waveIndex]
  }

  private spawnPoint(): EnemySpawnPoint {
    return missionState.current.mode === 'hover' ? this.hoverSpawnPoint() : this.flightSpawnPoint()
  }

  private flightSpawnPoint(): EnemySpawnPoint {
    const x = Phaser.Math.Between(SPAWN_X_MARGIN, WORLD_WIDTH - SPAWN_X_MARGIN)
    const y = Phaser.Math.Between(HORIZON_Y_RANGE[0], HORIZON_Y_RANGE[1])
    const targetX = Phaser.Math.Clamp(x + Phaser.Math.Between(-140, 140), 80, WORLD_WIDTH - 80)
    const targetY = Phaser.Math.Between(IMPACT_Y_RANGE[0], IMPACT_Y_RANGE[1])
    return { x, y, targetX, targetY }
  }

  /** The enemy's spawn point is literally the cover object's own position (perfectly
   * occluded at spawn — see Enemy's hover branch); its target is a nearby lateral
   * "peek out" point. */
  private hoverSpawnPoint(): EnemySpawnPoint {
    const coverObjects = missionState.current.coverObjects ?? []
    const cover = Phaser.Utils.Array.GetRandom(coverObjects)
    const depth = this.coverDepthById.get(cover.id) ?? Math.floor(cover.y)
    const side = Phaser.Math.Between(0, 1) === 0 ? -1 : 1
    const attackX = Phaser.Math.Clamp(
      cover.x + side * Phaser.Math.Between(HOVER_ATTACK_OFFSET_MIN, HOVER_ATTACK_OFFSET_MAX),
      HOVER_X_SAFE_MARGIN,
      WORLD_WIDTH - HOVER_X_SAFE_MARGIN,
    )
    // Stays near the cover's own y (a small lateral peek), not the flight-mode IMPACT_Y_RANGE
    // band — that band sits well below where hover cover is actually placed and previously
    // forced every hover enemy's attack point down into it regardless of its cover's real y.
    const attackY = Phaser.Math.Clamp(
      cover.y + Phaser.Math.Between(-HOVER_ATTACK_Y_JITTER, HOVER_ATTACK_Y_JITTER),
      HOVER_Y_SAFE_MARGIN,
      WORLD_HEIGHT - HOVER_Y_SAFE_MARGIN,
    )
    return { x: cover.x, y: cover.y, targetX: attackX, targetY: attackY, hoverMode: true, coverDepth: depth }
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

    // Hover missions hold position — the ground shouldn't visibly scroll under a stationary
    // aircraft the way it does while flying forward.
    if (missionState.current.mode !== 'hover') {
      this.ground.tilePositionX += delta * 0.06
      this.ground.tilePositionY += delta * 0.03
    }

    this.weapon.tick(delta)
    this.updateAimWithRecoil()
    this.cameras.main.setZoom(this.zoomActive ? this.equippedGunDef.zoom.factor : 1)
    this.setZoomButtonVisual(this.zoomActive)
    this.syncTouchUiForZoom()
    this.updateWaveSpawning(delta)
    this.updateEnemies(delta)
    this.updateHealthPickups(delta)
    this.updateDustKickup(delta)
    this.updateRotorFlicker(delta)
    this.handleFiring()

    if (this.health <= 0 && !this.missionEnded) {
      this.health = 0
      this.endMission('failed', 'aircraft-destroyed')
    } else if (missionState.current.mode === 'hover' && this.objectiveHealth <= 0 && !this.missionEnded) {
      this.objectiveHealth = 0
      this.endMission('failed', 'objective-destroyed')
    } else if (
      this.waveIndex >= missionState.current.waves.length &&
      this.enemies.length === 0 &&
      !this.missionEnded
    ) {
      this.endMission('complete')
    }

    this.emitHud()
  }

  /** Recomputes effectiveAim from crosshairPos + the weapon's current recoil offset,
   * and moves the crosshair sprite to it. Runs every frame (not just on pointer
   * events) so recoil keeps climbing while the trigger's held even with a
   * motionless pointer, and keeps decaying after release. */
  private updateAimWithRecoil() {
    const recoilY = this.weapon.getRecoilOffsetY()
    this.effectiveAim.x = this.crosshairPos.x
    this.effectiveAim.y = Phaser.Math.Clamp(this.crosshairPos.y - recoilY, 0, WORLD_HEIGHT)
    this.crosshair.setPosition(this.effectiveAim.x, this.effectiveAim.y)
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
      // Only while another wave is still coming — one spawned right as the mission ends would
      // never get a chance to be shot before the Result screen takes over.
      if (this.waveIndex < missionState.current.waves.length && Math.random() < HEALTH_CRATE_SPAWN_CHANCE) {
        this.healthPickups.push(new HealthPickup(this, this.flightSpawnPoint(), HEALTH_CRATE_TEXTURE))
      }
    }
  }

  private updateHealthPickups(delta: number) {
    for (let i = this.healthPickups.length - 1; i >= 0; i--) {
      const pickup = this.healthPickups[i]
      if (pickup.update(delta)) {
        pickup.destroy()
        this.healthPickups.splice(i, 1)
      }
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

    // In hover missions, enemies mostly attack the defended objective, not the aircraft —
    // rocket teams are the one exception (the plausibly anti-air-capable type), so aircraft
    // health and the no-damage bonus stay meaningfully at risk rather than decorative.
    // (Originally routed 'drone' instead, but drone.firesBack is false — it can never reach
    // this method at all, which made the exception dead code and the aircraft fully
    // invulnerable in every hover mission. Fixed 2026-09-05, see docs/PROGRESS.md.)
    // Outside hover mode, behavior is unchanged: everything always targets the aircraft.
    const targetsAircraft = missionState.current.mode !== 'hover' || enemy.def.id === 'rocket'
    const targetPoint = targetsAircraft ? GUN_ORIGIN : this.objectivePosition()

    this.spawnSpark(fromX, fromY, 0xff6644, 0.9, 140)

    const bolt = this.add.image(fromX, fromY, 'spark-tex')
    bolt.setTint(0xff5533)
    bolt.setDepth(1750)
    bolt.setScale(0.3)
    bolt.setBlendMode(Phaser.BlendModes.ADD)

    const dist = Phaser.Math.Distance.Between(fromX, fromY, targetPoint.x, targetPoint.y)
    const travelMs = Phaser.Math.Clamp(
      (dist / ENEMY_PROJECTILE_SPEED) * 1000,
      ENEMY_PROJECTILE_MIN_MS,
      ENEMY_PROJECTILE_MAX_MS,
    )

    this.tweens.add({
      targets: bolt,
      x: targetPoint.x,
      y: targetPoint.y,
      duration: travelMs,
      ease: 'Linear',
      onComplete: () => {
        bolt.destroy()
        if (this.missionEnded) return
        this.spawnSpark(targetPoint.x, targetPoint.y, 0xff5533, 1.1, 160)
        if (targetsAircraft) this.applyAircraftDamage(damage)
        else this.applyObjectiveDamage(damage)
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

  /** Restores aircraft health (health crates, the random kill-heal chance) — no-ops silently
   * once already at max, rather than showing an effect for a heal that didn't actually happen. */
  private applyAircraftHeal(amount: number, x: number, y: number) {
    const before = this.health
    this.health = Math.min(this.maxHealth, this.health + amount)
    if (this.health > before) this.spawnHealEffect(x, y, this.health - before)
  }

  /** Green burst + a "+N HP" popup — distinct from the orange kill-spark/gold score popup so a
   * heal reads as its own kind of moment, not just another hit, especially for the unannounced
   * random kill-heal chance where nothing else on screen would otherwise call it out. */
  private spawnHealEffect(x: number, y: number, amount: number) {
    this.spawnSpark(x, y, 0x4ade80, 2.2, 420)
    const text = this.add.text(x, y, `+${amount} HP`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#8effa3',
      stroke: '#0a2a12',
      strokeThickness: 3,
    })
    text.setOrigin(0.5, 1)
    text.setDepth(1900)
    this.tweens.add({
      targets: text,
      y: y - 46,
      alpha: 0,
      duration: 750,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    })
  }

  /**
   * Hover-mission analogue of applyAircraftDamage, for enemy fire routed at the defended
   * objective instead of the aircraft (see spawnEnemyProjectile). Deliberately not the
   * full-screen damageVignette — that stays reserved for aircraft hits, so the two damage
   * types read as visually distinct (a localized spark + a shake on the objective itself).
   */
  private applyObjectiveDamage(amount: number) {
    if (amount <= 0) return
    this.objectiveHealth = Math.max(0, this.objectiveHealth - amount)
    this.objectiveNoDamageTaken = false
    this.updateObjectiveHealthBar()
    this.sound.play('sfx-aircraft-damage', { volume: audioSettings.sfxVolume })
    const pos = this.objectivePosition()
    this.spawnSpark(pos.x, pos.y - 10, 0xff5533, 1.4, 220)
    if (this.defendObjectiveSprite) {
      // Targets `angle` specifically (not x/y, which the idle bob/sway tweens already own)
      // so this shake layers on top of them instead of fighting or needing to kill/restart.
      this.tweens.add({ targets: this.defendObjectiveSprite, angle: { from: -2, to: 2 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => this.defendObjectiveSprite?.setAngle(0) })
    }
  }

  private handleFiring() {
    const wasOverheated = this.weapon.overheated
    if (!this.weapon.tryFire()) return

    this.sound.play('sfx-shot', { volume: audioSettings.sfxVolume * 0.5 })
    this.spawnSpark(this.effectiveAim.x, this.effectiveAim.y, 0xfff3c4, 1, 90)
    if (this.weapon.overheated && !wasOverheated) {
      this.sound.play('sfx-overheat', { volume: audioSettings.sfxVolume })
    }

    let target: Enemy | null = null
    for (const enemy of this.enemies) {
      if (!enemy.containsPoint(this.effectiveAim.x, this.effectiveAim.y)) continue
      // Depth, not progress: once several hover-mode enemies sit at progress === 1
      // simultaneously, progress stops differentiating between them. Depth stays a valid
      // tie-break for flight mode too since its depth (Math.floor(progress * 1000)) is
      // already monotonic with progress — this is a strict unification, not a new branch.
      if (!target || enemy.container.depth > target.container.depth) target = enemy
    }

    // Checked only when no enemy is under the crosshair — a health crate never steals a shot
    // that would otherwise have hit a hostile.
    if (!target) {
      const pickup = this.healthPickups.find((p) => p.containsPoint(this.effectiveAim.x, this.effectiveAim.y))
      if (pickup) {
        gameEvents.emit(EVT_HIT_MARKER, { hit: true, x: this.effectiveAim.x, y: this.effectiveAim.y })
        this.spawnTracer(pickup.container.x, pickup.container.y)
        this.healthPickups = this.healthPickups.filter((p) => p !== pickup)
        const px = pickup.container.x
        const py = pickup.container.y
        this.tweens.add({
          targets: pickup.container,
          alpha: 0,
          scale: pickup.container.scale * 1.5,
          duration: 220,
          ease: 'Cubic.Out',
          onComplete: () => pickup.destroy(),
        })
        this.applyAircraftHeal(HEALTH_CRATE_HEAL_AMOUNT, px, py)
        return
      }
    }

    gameEvents.emit(EVT_HIT_MARKER, { hit: Boolean(target), x: this.effectiveAim.x, y: this.effectiveAim.y })

    // Staggered across the hit circle, not always dead-center — at high
    // Fire Rate upgrade levels, every shot landing on the exact same pixel
    // (both the spark AND, previously, the tracer's own endpoint) read as a
    // static laser line rather than a stream of separate hits. The tracer
    // now terminates at this same point so the line and the spark agree —
    // it still starts every shot from the gun, it just doesn't all land on
    // one pixel anymore.
    const impact = target ? target.randomImpactPoint() : this.effectiveAim
    this.spawnTracer(impact.x, impact.y)

    if (!target) return
    this.spawnSpark(impact.x, impact.y, 0xffa64d, 0.8, 140)

    const killed = target.takeDamage(this.weapon.damagePerShot)
    if (killed) {
      const killedTarget = target
      this.score += killedTarget.def.scoreValue
      this.enemiesDestroyed += 1
      this.enemies = this.enemies.filter((e) => e !== killedTarget)
      this.spawnSpark(killedTarget.container.x, killedTarget.container.y, 0xff6b3d, 1.8, 260)
      this.spawnScorePopup(killedTarget.container.x, killedTarget.container.y, killedTarget.def.scoreValue)
      // Unannounced bonus, independent of the deliberate health-crate mechanic above — offset
      // slightly from the score popup so the two floating texts don't stack on the same spot.
      if (Math.random() < KILL_HEAL_CHANCE) {
        this.applyAircraftHeal(KILL_HEAL_AMOUNT, killedTarget.container.x + 26, killedTarget.container.y - 12)
      }
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

  private endMission(outcome: 'complete' | 'failed', failureReason?: 'aircraft-destroyed' | 'objective-destroyed') {
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
      else if (objective.type === 'protect-objective') secondaryObjectiveComplete = this.objectiveNoDamageTaken
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
      failureReason,
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
      zoomed: this.zoomActive,
      objectiveHealth: missionState.current.mode === 'hover' ? this.objectiveHealth : undefined,
      objectiveMaxHealth: missionState.current.mode === 'hover' ? this.objectiveMaxHealth : undefined,
    }
    gameEvents.emit(EVT_HUD_UPDATE, state)
  }
}
