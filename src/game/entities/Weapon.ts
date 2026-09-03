import type { WeaponStats } from '../data/upgrades'

/**
 * Door gun heat management. Holding the trigger builds heat; releasing lets
 * it bleed off. Maxing it out force-locks the gun until it cools back down,
 * matching the GDD's "machine gun with heat management" player system.
 * Stats come from the player's purchased upgrades (src/game/data/upgrades.ts)
 * — pass BASE_WEAPON_STATS for the stock gun.
 */
export class Weapon {
  readonly maxHeat: number
  readonly damagePerShot: number
  heat = 0
  overheated = false

  private readonly heatPerShot = 6
  private readonly coolPerSecond: number
  private readonly overheatRecoverAt: number
  private readonly fireIntervalMs: number
  private cooldownSinceLastShotMs = 0

  private triggerDown = false

  constructor(stats: WeaponStats) {
    this.maxHeat = stats.maxHeat
    this.damagePerShot = stats.damagePerShot
    this.coolPerSecond = stats.coolPerSecond
    this.fireIntervalMs = stats.fireIntervalMs
    // Recovery threshold scales with capacity so a bigger heat pool doesn't
    // also mean a disproportionately long recovery wait.
    this.overheatRecoverAt = stats.maxHeat * 0.25
  }

  setTrigger(down: boolean) {
    this.triggerDown = down
  }

  /** Advance cooling/heat-lock state. Call every frame regardless of firing. */
  tick(deltaMs: number) {
    this.cooldownSinceLastShotMs += deltaMs
    if (!this.triggerDown || this.overheated) {
      this.heat = Math.max(0, this.heat - (this.coolPerSecond * deltaMs) / 1000)
    }
    if (this.overheated && this.heat <= this.overheatRecoverAt) {
      this.overheated = false
    }
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
}
