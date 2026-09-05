import { WORLD_WIDTH } from '../worldConstants'
import type { CoverObjectPlacement, CoverObjectVariant, DefendObjectiveArtVariant, DefendObjectiveDef, WaveDef } from '../types'
import type { SeededRandom } from './rng'

const COVER_VARIANTS: CoverObjectVariant[] = ['crates', 'sandbags', 'rubble', 'rocks']
const MIN_COVER = 3
const MAX_COVER = 5
// A hover mission's arena is a middle ground between a flight mission's full-field spread
// (the original 1000x240) and an overly-cramped first attempt at "bigger" (600x160, which
// read as everything piled on top of itself once cover/objective sprites got bigger — see
// COVER_OBJECT_SIZE in CombatScene.ts) — 840x220 gives enough room to spread out while still
// being more central than the original.
const COVER_X_MARGIN = 220
const COVER_Y_RANGE: [number, number] = [280, 500]
// Bigger than the object size's own radius (140/2=70, so two objects at old MIN_SEPARATION=130
// would visually overlap by 10px) — 180 guarantees a clear gap between sprite edges now that
// they're bigger than when this constant was first tuned.
const MIN_SEPARATION = 180
const PLACEMENT_ATTEMPTS = 100

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
