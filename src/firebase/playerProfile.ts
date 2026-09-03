import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import type { MissionResult } from '../game/types'
import { db, functions } from './config'

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

/** Subscribes to live profile updates (so the UI reflects Firestore as the source of truth). */
export function watchPlayerProfile(uid: string, onChange: (profile: PlayerProfile) => void): Unsubscribe {
  return onSnapshot(playerDocRef(uid), (snap) => {
    if (snap.exists()) onChange(snap.data() as PlayerProfile)
  })
}

// Progression writes (rewards, resets) go through Cloud Functions rather
// than direct Firestore writes — firestore.rules no longer lets the client
// touch xp/credits/missionsCompleted/missionsFailed/bestScore/unlockedUpgrades
// or the missionResults subcollection at all. This closes the gap where a
// signed-in player could previously call the client SDK directly with an
// inflated MissionResult: the Function re-derives/clamps the reward against
// the mission's real bounds server-side instead of trusting the client's
// numbers. See functions/src/index.ts.
const submitMissionResultFn = httpsCallable(functions, 'submitMissionResult')
const resetProgressFn = httpsCallable(functions, 'resetProgress')

/** Records a finished mission; the Cloud Function derives uid from the caller's auth token. */
export async function recordMissionResult(result: MissionResult): Promise<void> {
  await submitMissionResultFn(result)
}

/** Resets progression (XP, credits, mission history, unlocks) back to defaults. Keeps
 * displayName and settings — this is "reset my save," not "delete my account." */
export async function resetPlayerProgress(): Promise<void> {
  await resetProgressFn()
}
