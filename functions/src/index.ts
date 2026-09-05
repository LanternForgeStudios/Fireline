import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, type CollectionReference, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https'
import { getGun } from './gunCatalog'
import { getMissionBounds } from './missionCatalog'
import { getUpgrade, priorLevelsOf } from './upgradeCatalog'

initializeApp()
const db = getFirestore()

/** Every callable in this file requires a signed-in caller and only ever acts on that
 * caller's own uid — shared here so the check/error stays identical everywhere. */
function requireAuthUid(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }
  return request.auth.uid
}

/** The player-doc-must-already-exist check every transactional callable below needs before
 * reading/writing progression fields. */
async function requirePlayerSnap(tx: Transaction, playerRef: DocumentReference) {
  const snap = await tx.get(playerRef)
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'Player profile does not exist yet.')
  }
  return snap
}

// Firebase sets this automatically when running under `firebase
// emulators:start` — never set in a deployed function. There's no local
// App Check emulator (token generation/verification always goes through
// the real Google backend), so enforcing it locally would just require
// every dev machine's App Check debug token to be reachable/registered for
// no security benefit — the emulator isn't the production backend anyway.
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true'

type Difficulty = 'easy' | 'normal' | 'hard'
const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2 }
function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'normal' || value === 'hard'
}

interface MissionResultInput {
  missionId: string
  outcome: 'complete' | 'failed'
  score: number
  wavesCleared: number
  enemiesDestroyed: number
  secondaryObjectiveComplete: boolean
  difficulty: string
}

// Same formula as the client used to compute directly — now the only place
// it runs is here, against server-validated numbers.
function computeRewards(score: number) {
  return { xpEarned: score, creditsEarned: Math.round(score / 10) }
}

/** Batched-delete every doc in a collection, 500 (Firestore's batch cap) at a time. */
async function deleteAllDocs(ref: CollectionReference) {
  for (;;) {
    const snap = await ref.limit(500).get()
    if (snap.empty) break
    const batch = db.batch()
    for (const doc of snap.docs) batch.delete(doc.ref)
    await batch.commit()
  }
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
  const uid = requireAuthUid(request)
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
  const difficulty: Difficulty = isDifficulty(data.difficulty) ? data.difficulty : 'normal'

  // Only ever awarded alongside a 'complete' outcome — same rule the client
  // enforces in CombatScene.endMission, re-checked here rather than trusted.
  const secondaryObjectiveAwarded = data.outcome === 'complete' && Boolean(data.secondaryObjectiveComplete)
  const secondaryObjectiveBonus = secondaryObjectiveAwarded ? bounds.secondaryObjectiveBonus : 0
  const creditsEarned = baseCreditsEarned + secondaryObjectiveBonus

  const playerRef = db.collection('players').doc(uid)
  const missionResultRef = playerRef.collection('missionResults').doc()
  // Per-operation lifetime stats ("times completed", "highest difficulty
  // cleared") — only successful runs move either field, an attempt that
  // failed doesn't count as a completion at any difficulty.
  const missionStatsRef = playerRef.collection('missionStats').doc(data.missionId)

  const { completions, highestDifficulty } = await db.runTransaction(async (tx) => {
    const [playerSnap, statsSnap] = await Promise.all([tx.get(playerRef), tx.get(missionStatsRef)])
    if (!playerSnap.exists) {
      throw new HttpsError('failed-precondition', 'Player profile does not exist yet.')
    }
    const currentBest = (playerSnap.data()?.bestScore as number | undefined) ?? 0
    const priorCompletions = (statsSnap.data()?.completions as number | undefined) ?? 0
    const priorHighest = statsSnap.data()?.highestDifficulty as Difficulty | undefined
    const justCompleted = data.outcome === 'complete'
    const nextCompletions = priorCompletions + (justCompleted ? 1 : 0)
    // null (not `difficulty`) when this operation has never actually been
    // completed — a failed first attempt must not report a false "highest
    // difficulty cleared" of whatever it was just attempted at.
    const nextHighest: Difficulty | null = justCompleted
      ? !priorHighest || DIFFICULTY_RANK[difficulty] > DIFFICULTY_RANK[priorHighest]
        ? difficulty
        : priorHighest
      : (priorHighest ?? null)

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
      difficulty,
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

    if (data.outcome === 'complete') {
      tx.set(missionStatsRef, { completions: nextCompletions, highestDifficulty: nextHighest })
    }

    return { completions: nextCompletions, highestDifficulty: nextHighest }
  })

  return { xpEarned, creditsEarned, score, secondaryObjectiveAwarded, completions, highestDifficulty }
})

/**
 * Resets a player's progression back to defaults — moved server-side
 * alongside submitMissionResult so every write to the progression fields
 * goes through one place, rather than splitting the security model between
 * "Functions own rewards, but the client can still directly zero things
 * out." Keeps displayName and settings untouched.
 */
export const resetProgress = onCall({ enforceAppCheck: !isEmulator }, async (request) => {
  const uid = requireAuthUid(request)
  const playerRef = db.collection('players').doc(uid)

  await playerRef.update({
    xp: 0,
    credits: 0,
    missionsCompleted: 0,
    missionsFailed: 0,
    bestScore: 0,
    unlockedUpgrades: [],
    ownedGuns: ['m134'],
    equippedGun: 'm134',
  })

  await deleteAllDocs(playerRef.collection('missionResults'))
  await deleteAllDocs(playerRef.collection('missionStats'))

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
  const uid = requireAuthUid(request)
  const upgrade = getUpgrade(request.data.upgradeId)
  if (!upgrade) {
    throw new HttpsError('invalid-argument', `Unknown upgrade: ${request.data.upgradeId}`)
  }

  const playerRef = db.collection('players').doc(uid)

  await db.runTransaction(async (tx) => {
    const snap = await requirePlayerSnap(tx, playerRef)
    const data = snap.data()!
    const owned: string[] = data.unlockedUpgrades ?? []
    const ownedGuns: string[] = data.ownedGuns ?? []

    if (!ownedGuns.includes(upgrade.gunId)) {
      throw new HttpsError('failed-precondition', 'Purchase that gun first.')
    }
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

/**
 * TEMPORARY, one-time-use only. Backfills ownedGuns/equippedGun on the
 * caller's own player doc if missing, and refunds+clears any pre-multi-
 * weapon-system (un-prefixed, e.g. "damage-3") entries in unlockedUpgrades
 * — those ids have no meaning under the new ${gunId}-${track}-${level}
 * scheme. Self-service and auth-gated (only ever touches the caller's own
 * doc, never enumerates other players) rather than a broad admin script, so
 * it's safe to leave reachable only to the one signed-in owner who needs it.
 * Idempotent: old-format ids (exactly one hyphen) are the only ones ever
 * touched, so calling this again after it's already run is a no-op. Not a
 * permanent migration path — remove this function and redeploy once the one
 * production account that needs it has run it. See docs/PROGRESS.md.
 *
 * Refund uses OLD_LEVEL_COST (k=50) deliberately, not the current k=62
 * formula in upgradeCatalog.ts — every old-format id was actually purchased
 * back when k=50 was in effect, so refunding at k=62 would overpay by ~24%
 * per level. (Fixed 2026-09-05 — an earlier version of this function used
 * k=62 and already ran once against production; see docs/PROGRESS.md.)
 */
const OLD_LEVEL_COST = (n: number): number => 50 * (n * n + n + 1)
export const migrateToGunSystem = onCall({ enforceAppCheck: !isEmulator }, async (request) => {
  const uid = requireAuthUid(request)
  const playerRef = db.collection('players').doc(uid)

  return db.runTransaction(async (tx) => {
    const snap = await requirePlayerSnap(tx, playerRef)
    const data = snap.data()!
    const update: Record<string, unknown> = {}

    const needsGunBackfill = data.ownedGuns === undefined || data.equippedGun === undefined
    if (needsGunBackfill) {
      update.ownedGuns = ['m134']
      update.equippedGun = 'm134'
    }

    const allUpgrades: string[] = Array.isArray(data.unlockedUpgrades) ? data.unlockedUpgrades : []
    const oldFormatIds = allUpgrades.filter((id) => id.split('-').length === 2)
    let refunded = 0
    if (oldFormatIds.length > 0) {
      for (const id of oldFormatIds) {
        const level = Number(id.slice(id.lastIndexOf('-') + 1))
        if (Number.isFinite(level) && level >= 1 && level <= 10) refunded += OLD_LEVEL_COST(level)
      }
      const keptUpgrades = allUpgrades.filter((id) => !oldFormatIds.includes(id))
      update.unlockedUpgrades = keptUpgrades
      update.credits = FieldValue.increment(refunded)
    }

    if (Object.keys(update).length > 0) {
      tx.update(playerRef, update)
    }

    return { ok: true, backfilledGuns: needsGunBackfill, refunded, clearedUpgrades: oldFormatIds.length }
  })
})

/**
 * Purchases a new gun. Server-side for the same reason purchaseUpgrade is:
 * ownedGuns and credits are both client-write-blocked by firestore.rules.
 * Runs in a transaction so a double-click can't spend the same credits
 * twice.
 */
export const purchaseGun = onCall<{ gunId: string }>({ enforceAppCheck: !isEmulator }, async (request) => {
  const uid = requireAuthUid(request)
  const gun = getGun(request.data.gunId)
  if (!gun) {
    throw new HttpsError('invalid-argument', `Unknown gun: ${request.data.gunId}`)
  }

  const playerRef = db.collection('players').doc(uid)

  await db.runTransaction(async (tx) => {
    const snap = await requirePlayerSnap(tx, playerRef)
    const data = snap.data()!
    const owned: string[] = data.ownedGuns ?? []
    if (owned.includes(gun.id)) {
      throw new HttpsError('already-exists', 'Already purchased.')
    }
    const credits = (data.credits as number | undefined) ?? 0
    if (credits < gun.cost) {
      throw new HttpsError('failed-precondition', 'Not enough credits.')
    }

    tx.update(playerRef, {
      credits: FieldValue.increment(-gun.cost),
      ownedGuns: FieldValue.arrayUnion(gun.id),
    })
  })

  return { ok: true, gunId: gun.id }
})

/**
 * Equips an already-owned gun. Free and instant per design — just validates
 * ownership and flips the pointer, still server-side so a client can't
 * equip a gun it never purchased.
 */
export const equipGun = onCall<{ gunId: string }>({ enforceAppCheck: !isEmulator }, async (request) => {
  const uid = requireAuthUid(request)
  const gun = getGun(request.data.gunId)
  if (!gun) {
    throw new HttpsError('invalid-argument', `Unknown gun: ${request.data.gunId}`)
  }

  const playerRef = db.collection('players').doc(uid)

  await db.runTransaction(async (tx) => {
    const snap = await requirePlayerSnap(tx, playerRef)
    const owned: string[] = snap.data()!.ownedGuns ?? []
    if (!owned.includes(gun.id)) {
      throw new HttpsError('failed-precondition', 'Purchase this gun first.')
    }
    tx.update(playerRef, { equippedGun: gun.id })
  })

  return { ok: true, gunId: gun.id }
})
