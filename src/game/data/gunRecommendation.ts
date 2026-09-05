import type { MissionDef } from '../types'

export interface GunRecommendation {
  gunIds: string[]
  note: string
}

// Keyed by the mission's own type — that's the actual "objective" a mission
// is built around (hold a convoy, get in and out fast, clear and secure an
// area), which says more about which gun fits than tallying enemy types
// does: every hand-authored mission escalates to armor/commander by its
// final wave regardless of type, so composition alone doesn't differentiate
// much. Works identically for procedural missions since they draw from the
// same MissionDef['type'] union (see generation/briefingTemplates.ts).
const TYPE_RECOMMENDATION: Record<MissionDef['type'], GunRecommendation> = {
  'Search & Destroy': {
    gunIds: ['m134'],
    note: 'Sustained multi-wave clearing with no single fixed threat — the balanced all-rounder handles every wave shape.',
  },
  Escort: {
    gunIds: ['saw', 'm134'],
    note: 'Protecting a moving target rewards constant suppressive fire over burst damage.',
  },
  Extraction: {
    gunIds: ['m60', 'gau19'],
    note: 'Short, urgent contact at the LZ — a hard-hitting gun clears it before it gets worse.',
  },
  Rescue: {
    gunIds: ['m60', 'gau19'],
    note: "Time pressure to reach the objective favors killing fast over sustained spray.",
  },
  'Base Defense': {
    gunIds: ['saw'],
    note: 'Holding one position against repeated waves favors fire-rate over precision.',
  },
  Reconnaissance: {
    gunIds: ['gau19', 'm134'],
    note: 'Light, scattered contact — the zoomed precision gun picks threats off before they close.',
  },
}

/** Suggests which gun(s) suit an operation, from its type and secondary objective —
 * works identically for hand-authored and generated missions. */
export function recommendGuns(mission: Pick<MissionDef, 'type' | 'secondaryObjective'>): GunRecommendation {
  const base = TYPE_RECOMMENDATION[mission.type]
  if (mission.secondaryObjective.type === 'no-damage') {
    return { ...base, note: `${base.note} The no-damage bonus also rewards finishing contacts off from range.` }
  }
  if (mission.secondaryObjective.type === 'clean-sweep') {
    return { ...base, note: `${base.note} The clean-sweep bonus also rewards not letting stragglers slip past.` }
  }
  if (mission.secondaryObjective.type === 'protect-objective') {
    return { ...base, note: `${base.note} The objective-defense bonus also rewards killing contacts before they get a shot off.` }
  }
  return base
}
