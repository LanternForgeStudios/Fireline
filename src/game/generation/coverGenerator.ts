import { WORLD_WIDTH } from '../worldConstants'
import type { CoverObjectPlacement, CoverObjectVariant, DefendObjectiveArtVariant, DefendObjectiveDef, WaveDef } from '../types'
import type { SeededRandom } from './rng'

const COVER_VARIANTS: CoverObjectVariant[] = ['crates', 'sandbags', 'rubble', 'rocks']
const MIN_COVER = 3
const MAX_COVER = 5
// A hover mission's arena is deliberately more compact than a flight mission's full-field
// approach (600x160 vs. the old 1000x240) — on a small mobile screen, spreading cover across
// the whole canvas read as everything being too small/scattered; a tighter cluster makes
// props, enemies, and the objective all read bigger without needing a camera zoom (which
// would clip the touch pads — see the comment on COVER_OBJECT_SIZE in CombatScene.ts).
const COVER_X_MARGIN = 340
const COVER_Y_RANGE: [number, number] = [320, 480]
const MIN_SEPARATION = 130
// Bumped from 40 — the tighter arena above (600x160, down from the original 1000x240) makes
// rejection sampling fail more often at 4-5 objects; more attempts costs nothing (a bounded
// loop, not a perf concern) and meaningfully improves how often a mission actually gets the
// cover count it drew instead of settling for fewer.
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
