import { useState } from 'react'
import { playUiSound } from '../audio/uiSound'
import type { PlayerProfile } from '../firebase/playerProfile'

interface MainMenuProps {
  onStart: () => void
  onSettings: () => void
  onCredits: () => void
  onUpgrades: () => void
  onSignOut: () => void
  profile: PlayerProfile | null
}

export function MainMenu({ onStart, onSettings, onCredits, onUpgrades, onSignOut, profile }: MainMenuProps) {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)

  return (
    <div className="screen menu-screen">
      <div className="menu-content">
        <img className="menu-hero" src={`${import.meta.env.BASE_URL}ui/helicopter-hero.png`} alt="" />
        <h1 className="title">FIRELINE</h1>
        <p className="subtitle">Helicopter Gunner</p>
        <p className="menu-blurb">
          Ride the door gun. Hold the line until extraction.
        </p>
        {profile && (
          <p className="menu-stats">
            {profile.displayName} · XP: {profile.xp} · Credits: {profile.credits} · Best score: {profile.bestScore}
          </p>
        )}
        <button
          className="btn btn-primary"
          onClick={() => {
            playUiSound('ui_confirm')
            onStart()
          }}
        >
          Start Mission
        </button>
        <div className="menu-icon-row">
          <button
            className="btn btn-secondary"
            onClick={() => {
              playUiSound('ui_select')
              onUpgrades()
            }}
          >
            <img className="menu-icon" src={`${import.meta.env.BASE_URL}ui/icon-upgrades.png`} alt="" />
            Upgrades
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              playUiSound('ui_select')
              onSettings()
            }}
          >
            <img className="menu-icon" src={`${import.meta.env.BASE_URL}ui/icon-settings.png`} alt="" />
            Settings
          </button>
        </div>

        {confirmingSignOut ? (
          <div className="menu-signout-confirm">
            <p className="briefing-text reset-confirm-text">Sign out of your account?</p>
            <div className="briefing-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setConfirmingSignOut(false)
                  playUiSound('ui_select')
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  playUiSound('ui_confirm')
                  onSignOut()
                }}
              >
                Confirm sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-danger menu-signout-btn"
            onClick={() => {
              setConfirmingSignOut(true)
              playUiSound('toggle_off')
            }}
          >
            Sign out
          </button>
        )}

        <button
          className="login-toggle"
          onClick={() => {
            playUiSound('ui_select')
            onCredits()
          }}
        >
          Credits
        </button>

        <p className="menu-footnote">MVP — Core Combat, Mission Variety, Procedural Ops</p>
      </div>
    </div>
  )
}
