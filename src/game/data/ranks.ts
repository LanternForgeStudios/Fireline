export interface RankTier {
  id: string
  name: string
  minXp: number
  icon: string
}

// A full mission clear nets roughly 1000-4500 XP depending on the operation
// (xpEarned === score server-side, see functions/src/index.ts), so these
// thresholds are spaced to clear a handful of missions per tier early on and
// many more per tier at the top, rather than a flat XP-per-rank curve.
export const RANK_TIERS: RankTier[] = [
  { id: 'recruit', name: 'Recruit', minXp: 0, icon: 'icon-rank-recruit.png' },
  { id: 'private', name: 'Private', minXp: 1000, icon: 'icon-rank-private.png' },
  { id: 'corporal', name: 'Corporal', minXp: 2500, icon: 'icon-rank-corporal.png' },
  { id: 'sergeant', name: 'Sergeant', minXp: 5000, icon: 'icon-rank-sergeant.png' },
  { id: 'lieutenant', name: 'Lieutenant', minXp: 10000, icon: 'icon-rank-lieutenant.png' },
  { id: 'captain', name: 'Captain', minXp: 20000, icon: 'icon-rank-captain.png' },
  { id: 'major', name: 'Major', minXp: 35000, icon: 'icon-rank-major.png' },
  { id: 'colonel', name: 'Colonel', minXp: 60000, icon: 'icon-rank-colonel.png' },
]

export interface RankProgress {
  rank: RankTier
  next: RankTier | null
  /** 0-1 progress toward `next`; 1 (maxed) when there is no next tier. */
  progress: number
}

export function getRankProgress(xp: number): RankProgress {
  let rank = RANK_TIERS[0]
  let rankIndex = 0
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (xp >= RANK_TIERS[i].minXp) {
      rank = RANK_TIERS[i]
      rankIndex = i
    }
  }
  const next = RANK_TIERS[rankIndex + 1] ?? null
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1
  return { rank, next, progress }
}
