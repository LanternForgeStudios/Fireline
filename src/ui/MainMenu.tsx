import { playUiSound } from '../audio/uiSound'
import type { PlayerProfile } from '../firebase/playerProfile'

interface MainMenuProps {
  onStart: () => void
  onSettings: () => void
  onCredits: () => void
  onSignOut: () => void
  profile: PlayerProfile | null
}

export function MainMenu({ onStart, onSettings, onCredits, onSignOut, profile }: MainMenuProps) {
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
              onSettings()
            }}
          >
            Settings
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              playUiSound('ui_select')
              onCredits()
            }}
          >
            Credits
          </button>
          <button className="login-toggle" onClick={onSignOut}>
            Sign out
          </button>
        </div>
        <p className="menu-footnote">Combat Prototype — MVP Phase 1</p>
      </div>
    </div>
  )
}
