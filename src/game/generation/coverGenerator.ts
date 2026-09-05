import { WORLD_WIDTH } from '../worldConstants'
import type { CoverObjectPlacement, CoverObjectVariant, DefendObjectiveArtVariant, DefendObjectiveDef, WaveDef } from '../types'
import type { SeededRandom } from './rng'

const COVER_VARIANTS: CoverObjectVariant[] = ['crates', 'sandbags', 'rubble', 'rocks']
const MIN_COVER = 3
const MAX_COVER = 5
const COVER_X_MARGIN = 140
// Mid-ground band — above IMPACT_Y_RANGE (where enemies grow largest/most visually busy)
// so cover doesn't fight with them for attention, below the horizon.
const COVER_Y_RANGE: [number, number] = [280, 520]
const MIN_SEPARATION = 160
const PLACEMENT_ATTEMPTS = 40

const OBJECTIVE_FLAVORS: { label: string; artVariant: DefendObjectiveArtVariant }[] = [
  { label: 'Comms Relay', artVariant: 'relay' },
  { label: 'Fuel Depot', artVariant: 'depot' },
  { label: 'Forward Checkpoint', artVariant: 'checkpoint' },
]

function placeCoverObjects(rng: SeededRandom): CoverObjectPlacement[] {
  const count = rng.int(MIN_COVER, MAX_COVER)
  const placements: CoverObjectPlacement[] = []
  let attempts = 0
  while (placements.length < count && attempts < PLACEMENT_ATTEMPTS) {
    attempts++
    const x = rng.int(COVER_X_MARGIN, WORLD_WIDTH - COVER_X_MARGIN)
    const y = rng.int(COVER_Y_RANGE[0], COVER_Y_RANGE[1])
    if (placements.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_SEPARATION)) continue
    placements.push({ id: `cover-${placements.length}`, variant: rng.pick(COVER_VARIANTS), x, y })
  }
  return placements
}

// Scales with total spawn count across the mission (same "sum over waves" idea
// generateSecondaryObjective already uses for maxScore) so a longer/harder generated
// hover mission gives the objective proportionally more effective health — roughly 14hp
// per enemy expected to fire at least once, floored so the very first wave alone can
// never one-shot it.
function pickDefendObjective(rng: SeededRandom, waves: WaveDef[]): DefendObjectiveDef {
  const totalSpawns = waves.reduce((sum, w) => sum + w.spawns.length, 0)
  const maxHealth = Math.max(220, Math.round(totalSpawns * 14))
  const flavor = rng.pick(OBJECTIVE_FLAVORS)
  return { label: flavor.label, artVariant: flavor.artVariant, maxHealth }
}

export function generateHoverField(rng: SeededRandom, waves: WaveDef[]) {
  return { coverObjects: placeCoverObjects(rng), defendObjective: pickDefendObjective(rng, waves) }
}
