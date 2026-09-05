import type { User } from 'firebase/auth'
import { useCallback, useEffect, useState } from 'react'
import { audioSettings } from './audio/audioSettings'
import { playMusic, setMusicVolume, stopMusic } from './audio/musicPlayer'
import { signOutUser, watchAuthState } from './firebase/auth'
import {
  DEFAULT_SETTINGS,
  equipGun,
  loadAllMissionStats,
  loadOrCreatePlayerProfile,
  migrateToGunSystem,
  purchaseGun,
  purchaseUpgrade,
  recordMissionResult,
  resetPlayerProgress,
  updatePlayerSettings,
  watchPlayerProfile,
  type PlayerProfile,
  type PlayerSettings,
} from './firebase/playerProfile'
import { DEFAULT_GUN_ID } from './game/data/guns'
import { DEFAULT_MISSION } from './game/data/missions'
import { gameEvents } from './game/events'
import { missionState } from './game/missionState'
import { playerLoadout } from './game/playerLoadout'
import { EVT_MISSION_COMPLETE, EVT_MISSION_FAILED, type MissionDef, type MissionResult, type MissionStats } from './game/types'
import { CreditsScreen } from './ui/CreditsScreen'
import { GameCanvas } from './ui/GameCanvas'
import { Hud } from './ui/Hud'
import { LoginScreen } from './ui/LoginScreen'
import { MainMenu } from './ui/MainMenu'
import { MissionBriefing } from './ui/MissionBriefing'
import { MissionSelect } from './ui/MissionSelect'
import { ResultScreen } from './ui/ResultScreen'
import { SettingsScreen } from './ui/SettingsScreen'
import { UpgradesScreen } from './ui/UpgradesScreen'
import './App.css'

type Screen = 'menu' | 'select' | 'briefing' | 'playing' | 'result' | 'settings' | 'credits' | 'upgrades'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [result, setResult] = useState<MissionResult | null>(null)
  const [selectedMission, setSelectedMission] = useState<MissionDef>(DEFAULT_MISSION)
  const [authChecked, setAuthChecked] = useState(false)
  const [authTimedOut, setAuthTimedOut] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  // Per-operation lifetime stats (times completed, highest difficulty
  // cleared), keyed by missionId — loaded once per sign-in and merged with
  // the server's response after every mission so Mission Select and the
  // result screen never show stale numbers.
  const [operationStats, setOperationStats] = useState<Record<string, MissionStats>>({})

  // Firebase Authentication gates play — no account, no mission. Firestore
  // is the source of truth for progression once signed in, so the UI just
  // mirrors whatever's there. onAuthStateChanged normally fires almost
  // immediately, but it depends on a network round-trip (and, with App
  // Check involved, a reCAPTCHA token fetch) — if that hangs, the app
  // previously just showed an empty dark div forever with zero feedback.
  // The timeout gives the player a way out instead of a silent "black
  // screen" if that ever happens.
  useEffect(() => {
    const unsubscribeAuth = watchAuthState((nextUser) => {
      setUser(nextUser)
      setAuthChecked(true)
    })
    const timeoutId = window.setTimeout(() => setAuthTimedOut(true), 10000)
    return () => {
      unsubscribeAuth()
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setOperationStats({})
      return
    }
    let unsubscribeProfile: (() => void) | undefined
    const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'Door Gunner'
    loadOrCreatePlayerProfile(user.uid, displayName)
      .then(() => {
        unsubscribeProfile = watchPlayerProfile(user.uid, setProfile)
      })
      .catch((err) => console.error('Failed to load player profile', err))
    loadAllMissionStats(user.uid)
      .then(setOperationStats)
      .catch((err) => console.error('Failed to load operation stats', err))
    return () => unsubscribeProfile?.()
  }, [user])

  // Firestore is the source of truth for audio/difficulty settings too —
  // mirror them into the audioSettings singleton so both React (menu SFX)
  // and Phaser (CombatScene, mounted separately) read the current values,
  // and so settings hydrate the same on any device the player signs into.
  useEffect(() => {
    const settings = profile?.settings ?? DEFAULT_SETTINGS
    // Fold mute into the effective volume right here, at the single spot
    // that hydrates every screen/refresh — everything downstream (uiSound,
    // musicPlayer, CombatScene's SFX and its own music gain node) already
    // just reads audioSettings.musicVolume/sfxVolume, so muted comes out
    // silent everywhere for free instead of needing a mute check duplicated
    // at every call site (the class of bug the "music after mission ends"
    // fix earlier ran into, from checking the wrong flag in one call site).
    audioSettings.musicVolume = settings.musicMuted ? 0 : settings.musicVolume
    audioSettings.sfxVolume = settings.sfxMuted ? 0 : settings.sfxVolume
    audioSettings.difficulty = settings.difficulty
    setMusicVolume(audioSettings.musicVolume)
  }, [profile?.settings])

  // Same live-mirror pattern for the weapon upgrades Phaser needs at
  // mission start — see game/playerLoadout.ts.
  useEffect(() => {
    playerLoadout.unlockedUpgrades = profile?.unlockedUpgrades ?? []
    playerLoadout.equippedGun = profile?.equippedGun ?? DEFAULT_GUN_ID
  }, [profile?.unlockedUpgrades, profile?.equippedGun])

  useEffect(() => {
    const recordAndUpdateStats = (missionResult: MissionResult) => {
      if (!user) return
      recordMissionResult(missionResult)
        .then((stats) => setOperationStats((prev) => ({ ...prev, [missionResult.missionId]: stats })))
        .catch((err) => console.error('Failed to record mission result', err))
    }
    const onComplete = (missionResult: MissionResult) => {
      setResult(missionResult)
      setScreen('result')
      recordAndUpdateStats(missionResult)
    }
    const onFailed = (missionResult: MissionResult) => {
      setResult(missionResult)
      setScreen('result')
      recordAndUpdateStats(missionResult)
    }
    gameEvents.on(EVT_MISSION_COMPLETE, onComplete)
    gameEvents.on(EVT_MISSION_FAILED, onFailed)
    return () => {
      gameEvents.off(EVT_MISSION_COMPLETE, onComplete)
      gameEvents.off(EVT_MISSION_FAILED, onFailed)
    }
  }, [user])

  // Menu music plays on every screen except combat — Phaser owns its own
  // combat music independently once GameCanvas mounts. Gated on `profile`
  // being loaded (not just `user`): audioSettings/the music element start
  // at a hardcoded default volume, and starting playback before the
  // player's real saved volume has hydrated from Firestore meant a
  // returning player who'd set music to 0 would briefly hear it anyway,
  // at the default level, during that async round-trip.
  useEffect(() => {
    if (screen === 'playing') {
      stopMusic()
    } else if (profile) {
      playMusic('audio/music/menu.ogg')
    }
  }, [screen, profile])

  const goToMissionSelect = useCallback(() => setScreen('select'), [])
  const goToMenu = useCallback(() => setScreen('menu'), [])
  const goToSettings = useCallback(() => setScreen('settings'), [])
  const goToCredits = useCallback(() => setScreen('credits'), [])
  const goToUpgrades = useCallback(() => setScreen('upgrades'), [])
  const selectMission = useCallback((mission: MissionDef) => {
    missionState.current = mission
    setSelectedMission(mission)
    setScreen('briefing')
  }, [])
  const launchMission = useCallback(() => setScreen('playing'), [])
  const signOut = useCallback(() => {
    signOutUser().catch((err) => console.error('Sign-out failed', err))
    setScreen('menu')
  }, [])
  const changeSettings = useCallback(
    (partial: Partial<PlayerSettings>) => {
      // profile, not just user: SettingsScreen renders (with a
      // DEFAULT_SETTINGS fallback) before the initial profile-creation
      // write finishes, so a change fired in that window would otherwise
      // race the account's first Firestore write and get rejected by
      // firestore.rules' update check evaluating against a doc that isn't
      // fully there yet.
      if (!user || !profile) return
      updatePlayerSettings(user.uid, partial).catch((err) => console.error('Failed to save settings', err))
    },
    [user, profile],
  )
  const resetProgress = useCallback(() => {
    if (!user) return
    resetPlayerProgress().catch((err) => console.error('Failed to reset progress', err))
  }, [user])

  if (!authChecked) {
    return (
      <div className="app-root">
        <div className="screen boot-screen">
          <div className="boot-content">
            <h1 className="title">FIRELINE</h1>
            {authTimedOut ? (
              <>
                <p className="boot-message">
                  Taking longer than expected to connect. Check your connection and reload.
                </p>
                <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                  Reload
                </button>
              </>
            ) : (
              <p className="boot-message">Loading...</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-root">
        <LoginScreen />
      </div>
    )
  }

  return (
    <div className="app-root">
      {screen === 'menu' && (
        <MainMenu
          onStart={goToMissionSelect}
          onSettings={goToSettings}
          onCredits={goToCredits}
          onUpgrades={goToUpgrades}
          profile={profile}
          onSignOut={signOut}
        />
      )}
      {screen === 'select' && (
        <MissionSelect onSelect={selectMission} onBack={goToMenu} operationStats={operationStats} />
      )}
      {screen === 'briefing' && (
        <MissionBriefing
          mission={selectedMission}
          equippedGun={profile?.equippedGun ?? DEFAULT_GUN_ID}
          unlockedUpgrades={profile?.unlockedUpgrades ?? []}
          onLaunch={launchMission}
          onBack={goToMissionSelect}
        />
      )}
      {screen === 'upgrades' && (
        <UpgradesScreen
          credits={profile?.credits ?? 0}
          ownedGuns={profile?.ownedGuns ?? [DEFAULT_GUN_ID]}
          equippedGun={profile?.equippedGun ?? DEFAULT_GUN_ID}
          unlockedUpgrades={profile?.unlockedUpgrades ?? []}
          onPurchaseGun={purchaseGun}
          onEquipGun={equipGun}
          onPurchaseUpgrade={purchaseUpgrade}
          onBack={goToMenu}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={profile?.settings ?? DEFAULT_SETTINGS}
          confirmEmail={user.email}
          onChange={changeSettings}
          onResetProgress={resetProgress}
          onMigrateGuns={migrateToGunSystem}
          onBack={goToMenu}
        />
      )}
      {screen === 'credits' && <CreditsScreen onBack={goToMenu} />}
      {screen === 'playing' && (
        <div className="play-screen">
          <GameCanvas />
          <Hud />
        </div>
      )}
      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          objective={selectedMission.secondaryObjective}
          stats={operationStats[result.missionId] ?? null}
          onReturnToBase={goToMenu}
        />
      )}
    </div>
  )
}

export default App
