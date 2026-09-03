import type { User } from 'firebase/auth'
import { useCallback, useEffect, useState } from 'react'
import { audioSettings } from './audio/audioSettings'
import { playMusic, setMusicVolume, stopMusic } from './audio/musicPlayer'
import { signOutUser, watchAuthState } from './firebase/auth'
import {
  DEFAULT_SETTINGS,
  loadOrCreatePlayerProfile,
  recordMissionResult,
  resetPlayerProgress,
  updatePlayerSettings,
  watchPlayerProfile,
  type PlayerProfile,
  type PlayerSettings,
} from './firebase/playerProfile'
import { DEFAULT_MISSION } from './game/data/missions'
import { gameEvents } from './game/events'
import { missionState } from './game/missionState'
import { EVT_MISSION_COMPLETE, EVT_MISSION_FAILED, type MissionDef, type MissionResult } from './game/types'
import { CreditsScreen } from './ui/CreditsScreen'
import { GameCanvas } from './ui/GameCanvas'
import { Hud } from './ui/Hud'
import { LoginScreen } from './ui/LoginScreen'
import { MainMenu } from './ui/MainMenu'
import { MissionBriefing } from './ui/MissionBriefing'
import { MissionSelect } from './ui/MissionSelect'
import { ResultScreen } from './ui/ResultScreen'
import { SettingsScreen } from './ui/SettingsScreen'
import './App.css'

type Screen = 'menu' | 'select' | 'briefing' | 'playing' | 'result' | 'settings' | 'credits'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [result, setResult] = useState<MissionResult | null>(null)
  const [selectedMission, setSelectedMission] = useState<MissionDef>(DEFAULT_MISSION)
  const [authChecked, setAuthChecked] = useState(false)
  const [authTimedOut, setAuthTimedOut] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)

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
      return
    }
    let unsubscribeProfile: (() => void) | undefined
    const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'Door Gunner'
    loadOrCreatePlayerProfile(user.uid, displayName)
      .then(() => {
        unsubscribeProfile = watchPlayerProfile(user.uid, setProfile)
      })
      .catch((err) => console.error('Failed to load player profile', err))
    return () => unsubscribeProfile?.()
  }, [user])

  // Firestore is the source of truth for audio/difficulty settings too —
  // mirror them into the audioSettings singleton so both React (menu SFX)
  // and Phaser (CombatScene, mounted separately) read the current values,
  // and so settings hydrate the same on any device the player signs into.
  useEffect(() => {
    const settings = profile?.settings ?? DEFAULT_SETTINGS
    audioSettings.musicVolume = settings.musicVolume
    audioSettings.sfxVolume = settings.sfxVolume
    audioSettings.difficulty = settings.difficulty
    audioSettings.controlSide = settings.controlSide
    setMusicVolume(settings.musicVolume)
  }, [profile?.settings])

  useEffect(() => {
    const onComplete = (missionResult: MissionResult) => {
      setResult(missionResult)
      setScreen('result')
      if (user) recordMissionResult(missionResult).catch((err) => console.error('Failed to record mission result', err))
    }
    const onFailed = (missionResult: MissionResult) => {
      setResult(missionResult)
      setScreen('result')
      if (user) recordMissionResult(missionResult).catch((err) => console.error('Failed to record mission result', err))
    }
    gameEvents.on(EVT_MISSION_COMPLETE, onComplete)
    gameEvents.on(EVT_MISSION_FAILED, onFailed)
    return () => {
      gameEvents.off(EVT_MISSION_COMPLETE, onComplete)
      gameEvents.off(EVT_MISSION_FAILED, onFailed)
    }
  }, [user])

  // Menu music plays on every screen except combat — Phaser owns its own
  // combat music independently once GameCanvas mounts.
  useEffect(() => {
    if (screen === 'playing') {
      stopMusic()
    } else {
      playMusic('audio/music/menu.ogg')
    }
  }, [screen])

  const goToMissionSelect = useCallback(() => setScreen('select'), [])
  const goToMenu = useCallback(() => setScreen('menu'), [])
  const goToSettings = useCallback(() => setScreen('settings'), [])
  const goToCredits = useCallback(() => setScreen('credits'), [])
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
      if (!user) return
      updatePlayerSettings(user.uid, partial).catch((err) => console.error('Failed to save settings', err))
    },
    [user],
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
          profile={profile}
          onSignOut={signOut}
        />
      )}
      {screen === 'select' && <MissionSelect onSelect={selectMission} onBack={goToMenu} />}
      {screen === 'briefing' && (
        <MissionBriefing mission={selectedMission} onLaunch={launchMission} onBack={goToMissionSelect} />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={profile?.settings ?? DEFAULT_SETTINGS}
          confirmEmail={user.email}
          onChange={changeSettings}
          onResetProgress={resetProgress}
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
      {screen === 'result' && result && <ResultScreen result={result} onReturnToBase={goToMenu} />}
    </div>
  )
}

export default App
