import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getMissionBounds } from './missionCatalog'
import { getUpgrade, priorLevelsOf } from './upgradeCatalog'

initializeApp()
const db = getFirestore()

// Firebase sets this automatically when running under `firebase
// emulators:start` — never set in a deployed function. There's no local
// App Check emulator (token generation/verification always goes through
// the real Google backend), so enforcing it locally would just require
// every dev machine's App Check debug token to be reachable/registered for
// no security benefit — the emulator isn't the production backend anyway.
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true'

interface MissionResultInput {
  missionId: string
  outcome: 'complete' | 'failed'
  score: number
  wavesCleared: number
  enemiesDestroyed: number
  secondaryObjectiveComplete: boolean
}

// Same formula as the client used to compute directly — now the only place
// it runs is here, against server-validated numbers.
function computeRewards(score: number) {
  return { xpEarned: score, creditsEarned: Math.round(score / 10) }
}

/**
 * Records a finished mission and updates the player's aggregate progression.
 * Runs entirely server-side (Admin SDK, bypasses Firestore rules) so this is
 * the only path that can grant XP/credits — closes the gap where a signed-in
 * player could previously call the client SDK directly with an inflated
 * MissionResult. Submitted numbers are clamped to the mission's real bounds
 * rather than hard-rejected, so a legitimate run at the edge of what the
 * server-side catalog expects still gets recorded (just capped), rather than
 * silently dropping a real player's result over an off-by-one in the catalog.
 */
export const submitMissionResult = onCall<MissionResultInput>({ enforceAppCheck: !isEmulator }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }
  const uid = request.auth.uid
  const data = request.data

  if (data.outcome !== 'complete' && data.outcome !== 'failed') {
    throw new HttpsError('invalid-argument', 'Invalid outcome.')
  }

  const bounds = getMissionBounds(data.missionId)
  if (!bounds) {
    throw new HttpsError('invalid-argument', `Unknown mission: ${data.missionId}`)
  }

  const wavesCleared = Math.max(0, Math.min(Math.floor(data.wavesCleared) || 0, bounds.totalWaves))
  const enemiesDestroyed = Math.max(0, Math.min(Math.floor(data.enemiesDestroyed) || 0, bounds.maxEnemies))
  const score = Math.max(0, Math.min(Math.floor(data.score) || 0, bounds.maxScore))
  const { xpEarned, creditsEarned: baseCreditsEarned } = computeRewards(score)

  // Only ever awarded alongside a 'complete' outcome — same rule the client
  // enforces in CombatScene.endMission, re-checked here rather than trusted.
  const secondaryObjectiveAwarded = data.outcome === 'complete' && Boolean(data.secondaryObjectiveComplete)
  const secondaryObjectiveBonus = secondaryObjectiveAwarded ? bounds.secondaryObjectiveBonus : 0
  const creditsEarned = baseCreditsEarned + secondaryObjectiveBonus

  const playerRef = db.collection('players').doc(uid)
  const missionResultRef = playerRef.collection('missionResults').doc()

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(playerRef)
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Player profile does not exist yet.')
    }
    const currentBest = (snap.data()?.bestScore as number | undefined) ?? 0

    tx.set(missionResultRef, {
      missionId: data.missionId,
      outcome: data.outcome,
      score,
      wavesCleared,
      totalWaves: bounds.totalWaves,
      enemiesDestroyed,
      xpEarned,
      creditsEarned,
      secondaryObjectiveAwarded,
      secondaryObjectiveBonus,
      playedAt: FieldValue.serverTimestamp(),
    })

    tx.update(playerRef, {
      xp: FieldValue.increment(xpEarned),
      credits: FieldValue.increment(creditsEarned),
      missionsCompleted: FieldValue.increment(data.outcome === 'complete' ? 1 : 0),
      missionsFailed: FieldValue.increment(data.outcome === 'failed' ? 1 : 0),
      bestScore: Math.max(currentBest, score),
      lastPlayedAt: FieldValue.serverTimestamp(),
    })
  })

  return { xpEarned, creditsEarned, score, secondaryObjectiveAwarded }
})

/**
 * Resets a player's progression back to defaults — moved server-side
 * alongside submitMissionResult so every write to the progression fields
 * goes through one place, rather than splitting the security model between
 * "Functions own rewards, but the client can still directly zero things
 * out." Keeps displayName and settings untouched.
 */
export const resetProgress = onCall({ enforceAppCheck: !isEmulator }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }
  const playerRef = db.collection('players').doc(request.auth.uid)

  await playerRef.update({
    xp: 0,
    credits: 0,
    missionsCompleted: 0,
    missionsFailed: 0,
    bestScore: 0,
    unlockedUpgrades: [],
  })

  const missionResultsRef = playerRef.collection('missionResults')
  for (;;) {
    const snap = await missionResultsRef.limit(500).get()
    if (snap.empty) break
    const batch = db.batch()
    for (const doc of snap.docs) batch.delete(doc.ref)
    await batch.commit()
  }

  return { ok: true }
})

/**
 * Spends credits on a weapon upgrade. Server-side for the same reason
 * submitMissionResult is: unlockedUpgrades and credits are both
 * client-write-blocked by firestore.rules, so this is the only path that
 * can grant an upgrade. Runs in a transaction so a double-click can't
 * spend the same credits twice, and re-validates everything from the
 * player's actual current Firestore state rather than trusting the client.
 */
export const purchaseUpgrade = onCall<{ upgradeId: string }>({ enforceAppCheck: !isEmulator }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }
  const upgrade = getUpgrade(request.data.upgradeId)
  if (!upgrade) {
    throw new HttpsError('invalid-argument', `Unknown upgrade: ${request.data.upgradeId}`)
  }

  const playerRef = db.collection('players').doc(request.auth.uid)

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(playerRef)
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Player profile does not exist yet.')
    }
    const data = snap.data()!
    const owned: string[] = data.unlockedUpgrades ?? []

    if (owned.includes(upgrade.id)) {
      throw new HttpsError('already-exists', 'Already purchased.')
    }
    const missingPrior = priorLevelsOf(upgrade).some((prior) => !owned.includes(prior.id))
    if (missingPrior) {
      throw new HttpsError('failed-precondition', 'Purchase earlier levels in this track first.')
    }
    const credits = (data.credits as number | undefined) ?? 0
    if (credits < upgrade.cost) {
      throw new HttpsError('failed-precondition', 'Not enough credits.')
    }

    tx.update(playerRef, {
      credits: FieldValue.increment(-upgrade.cost),
      unlockedUpgrades: FieldValue.arrayUnion(upgrade.id),
    })
  })

  return { ok: true, upgradeId: upgrade.id }
})
