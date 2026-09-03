import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import type { MissionResult } from '../game/types'
import { db } from './config'

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface PlayerSettings {
  musicVolume: number
  sfxVolume: number
  difficulty: Difficulty
}

export interface PlayerProfile {
  displayName: string
  createdAt: unknown
  lastPlayedAt: unknown
  xp: number
  credits: number
  missionsCompleted: number
  missionsFailed: number
  bestScore: number
  unlockedUpgrades: string[]
  settings: PlayerSettings
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  difficulty: 'normal',
}

const DEFAULT_PROGRESS: Omit<PlayerProfile, 'displayName' | 'createdAt' | 'lastPlayedAt' | 'settings'> = {
  xp: 0,
  credits: 0,
  missionsCompleted: 0,
  missionsFailed: 0,
  bestScore: 0,
  unlockedUpgrades: [],
}

function playerDocRef(uid: string) {
  return doc(db, 'players', uid)
}

/** Fetches the player's profile, creating it with defaults on first login. */
export async function loadOrCreatePlayerProfile(uid: string, displayName: string): Promise<PlayerProfile> {
  const ref = playerDocRef(uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    return snap.data() as PlayerProfile
  }
  const fresh: PlayerProfile = {
    ...DEFAULT_PROGRESS,
    displayName,
    settings: DEFAULT_SETTINGS,
    createdAt: serverTimestamp(),
    lastPlayedAt: serverTimestamp(),
  }
  await setDoc(ref, fresh)
  return fresh
}

/** Partial update of just the settings sub-object (dot-path so sibling fields are untouched). */
export async function updatePlayerSettings(uid: string, settings: Partial<PlayerSettings>): Promise<void> {
  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settings)) {
    updates[`settings.${key}`] = value
  }
  await updateDoc(playerDocRef(uid), updates)
}

/** Resets progression (XP, credits, mission history, unlocks) back to defaults. Keeps
 * displayName and settings — this is "reset my save," not "delete my account." */
export async function resetPlayerProgress(uid: string): Promise<void> {
  await updateDoc(playerDocRef(uid), { ...DEFAULT_PROGRESS })
}

/** Subscribes to live profile updates (so the UI reflects Firestore as the source of truth). */
export function watchPlayerProfile(uid: string, onChange: (profile: PlayerProfile) => void): Unsubscribe {
  return onSnapshot(playerDocRef(uid), (snap) => {
    if (snap.exists()) onChange(snap.data() as PlayerProfile)
  })
}

// Reward formula is intentionally simple and centralized here for easy
// tuning; real anti-cheat validation (Cloud Functions re-deriving the
// reward from the mission definition) is future work per the GDD.
function computeRewards(result: MissionResult) {
  const xpEarned = result.score
  const creditsEarned = Math.round(result.score / 10)
  return { xpEarned, creditsEarned }
}

/**
 * Records a finished mission and updates the player's aggregate progression.
 * This is the single write path that makes Firestore the source of truth
 * for XP/credits/unlocks — combat itself stays entirely client-side.
 */
export async function recordMissionResult(uid: string, result: MissionResult): Promise<void> {
  const { xpEarned, creditsEarned } = computeRewards(result)

  await addDoc(collection(db, 'players', uid, 'missionResults'), {
    ...result,
    xpEarned,
    creditsEarned,
    playedAt: serverTimestamp(),
  })

  await updateDoc(playerDocRef(uid), {
    xp: increment(xpEarned),
    credits: increment(creditsEarned),
    missionsCompleted: increment(result.outcome === 'complete' ? 1 : 0),
    missionsFailed: increment(result.outcome === 'failed' ? 1 : 0),
    lastPlayedAt: serverTimestamp(),
  })

  // bestScore needs a max(), which Firestore's increment() can't express —
  // read-modify-write it separately instead.
  const snap = await getDoc(playerDocRef(uid))
  const current = (snap.data() as PlayerProfile | undefined)?.bestScore ?? 0
  if (result.score > current) {
    await updateDoc(playerDocRef(uid), { bestScore: result.score })
  }
}
