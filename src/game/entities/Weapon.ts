/**
 * Door gun heat management. Holding the trigger builds heat; releasing lets
 * it bleed off. Maxing it out force-locks the gun until it cools back down,
 * matching the GDD's "machine gun with heat management" player system.
 */
export class Weapon {
  readonly maxHeat = 100
  heat = 0
  overheated = false

  private readonly heatPerShot = 6
  private readonly coolPerSecond = 42
  private readonly overheatRecoverAt = 25
  private readonly fireIntervalMs = 70
  private cooldownSinceLastShotMs = 0

  private triggerDown = false

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
