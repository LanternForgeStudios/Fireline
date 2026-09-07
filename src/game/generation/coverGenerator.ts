import { COVER_OBJECT_SIZE, DEFEND_OBJECTIVE_Y, WORLD_WIDTH } from '../worldConstants'
import type { CoverObjectPlacement, CoverObjectVariant, DefendObjectiveArtVariant, DefendObjectiveDef, WaveDef } from '../types'
import type { SeededRandom } from './rng'

const COVER_VARIANTS: CoverObjectVariant[] = ['crates', 'sandbags', 'wreckage', 'outpost']
const MIN_COVER = 3
const MAX_COVER = 5
// Player-reported: cover objects (and the boats that emerge from them) sometimes overlapped
// the defended objective, and separately asked for the full map to be usable for spawn points —
// a prior, deliberately-cramped-and-central arena (840x220, see git history for the "more
// central than the original" reasoning that no longer applies) didn't check against the
// objective's position at all. X now spans nearly the entire canvas width (just enough margin
// to keep a cover sprite's edge on-screen); Y mirrors CombatScene's own flight-mode
// HORIZON_Y_RANGE[1]..IMPACT_Y_RANGE[1] band (165..610) — the same near-full vertical depth
// already used, and visually proven, for flight-mode enemies in that exact scene, from just
// below the horizon/mountain backdrop to just above the door sill.
const COVER_X_MARGIN = COVER_OBJECT_SIZE / 2 + 20
const COVER_Y_RANGE: [number, number] = [165, 610]
// Bigger than the object size's own radius (140/2=70, so two objects at old MIN_SEPARATION=130
// would visually overlap by 10px) — 180 guarantees a clear gap between sprite edges now that
// they're bigger than when this constant was first tuned. Also enforced against the defend
// objective's own fixed position (OBJECTIVE_POSITION below) so cover — and the boats that spawn
// from it — can never land on top of it; COVER_OBJECT_SIZE and DEFEND_OBJECTIVE_SIZE are equal
// (both 140), so the same gap distance works for both checks without a second hand-tuned number.
const MIN_SEPARATION = 180
const PLACEMENT_ATTEMPTS = 100

const OBJECTIVE_POSITION = { x: WORLD_WIDTH / 2, y: DEFEND_OBJECTIVE_Y }

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
    if (Math.hypot(OBJECTIVE_POSITION.x - x, OBJECTIVE_POSITION.y - y) < MIN_SEPARATION) continue
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
