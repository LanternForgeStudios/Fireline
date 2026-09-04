import type { RecoilProfile } from '../data/guns'
import type { WeaponStats } from '../data/upgrades'

// Recoil doesn't jump in step with each discrete +heatPerShot heat tick —
// it eases toward the heat-driven target over this window so the climb
// reads as a smooth mechanical push rather than a per-shot stair-step.
const RECOIL_SMOOTHING_MS = 140

/**
 * Door gun heat management. Holding the trigger builds heat; releasing lets
 * it bleed off. Maxing it out force-locks the gun until it cools back down,
 * matching the GDD's "machine gun with heat management" player system.
 * As heat rises the gun also visibly climbs off-target (getRecoilOffsetY) —
 * a real firing-mechanic consequence to holding the trigger, not just an
 * overheat gate. Stats/heatPerShot/recoil profile all come from the
 * equipped gun (src/game/data/guns.ts) — each gun feels different to fire.
 */
export class Weapon {
  readonly maxHeat: number
  readonly damagePerShot: number
  heat = 0
  overheated = false

  private readonly heatPerShot: number
  private readonly coolPerSecond: number
  private readonly overheatRecoverAt: number
  private readonly fireIntervalMs: number
  private readonly recoil: RecoilProfile
  private cooldownSinceLastShotMs = 0
  private currentRecoilPx = 0

  private triggerDown = false

  constructor(stats: WeaponStats, heatPerShot: number, recoil: RecoilProfile) {
    this.maxHeat = stats.maxHeat
    this.damagePerShot = stats.damagePerShot
    this.coolPerSecond = stats.coolPerSecond
    this.fireIntervalMs = stats.fireIntervalMs
    this.heatPerShot = heatPerShot
    this.recoil = recoil
    // Recovery threshold scales with capacity so a bigger heat pool doesn't
    // also mean a disproportionately long recovery wait.
    this.overheatRecoverAt = stats.maxHeat * 0.25
  }

  setTrigger(down: boolean) {
    this.triggerDown = down
  }

  /** Advance cooling/heat-lock/recoil state. Call every frame regardless of firing. */
  tick(deltaMs: number) {
    this.cooldownSinceLastShotMs += deltaMs
    if (!this.triggerDown || this.overheated) {
      this.heat = Math.max(0, this.heat - (this.coolPerSecond * deltaMs) / 1000)
    }
    if (this.overheated && this.heat <= this.overheatRecoverAt) {
      this.overheated = false
    }

    const heatFraction = this.heat / this.maxHeat
    const targetPx = Math.pow(heatFraction, this.recoil.curve) * this.recoil.maxClimbPx
    const smoothing = 1 - Math.exp(-deltaMs / RECOIL_SMOOTHING_MS)
    this.currentRecoilPx += (targetPx - this.currentRecoilPx) * smoothing
  }

  /** Returns true if a shot should be fired this frame, and applies its heat cost. */
  tryFire(): boolean {
    if (!this.triggerDown || this.overheated) return false
    if (this.cooldownSinceLastShotMs < this.fireIntervalMs) return false

    this.cooldownSinceLastShotMs = 0
    this.heat = Math.min(this.maxHeat, this.heat + this.heatPerShot)
    if (this.heat >= this.maxHeat) {
      this.overheated = true
    }
    return true
  }

  /** Positive px the effective aim point should be pushed up (subtract from screen Y). */
  getRecoilOffsetY(): number {
    return this.currentRecoilPx
  }
}
