import Phaser from 'phaser'

export interface BarFill {
  width: number
  /** Offset from the bar's own center — add to wherever the bar is actually anchored. */
  x: number
  color: number
}

/** Health-bar fill geometry + color, shared by Enemy's per-enemy floating bar and
 * CombatScene's defend-objective bar — same "green above 50%, yellow above 25%, red below"
 * ramp, just parameterized by full width and the healthy-state color. */
export function computeBarFill(healthFraction: number, fullWidth: number, healthyColor: number): BarFill {
  const pct = Phaser.Math.Clamp(healthFraction, 0, 1)
  const width = fullWidth * pct
  return {
    width,
    x: -fullWidth / 2 + width / 2,
    color: pct > 0.5 ? healthyColor : pct > 0.25 ? 0xf2c14e : 0xef4444,
  }
}
