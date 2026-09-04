import { useState } from 'react'
import { playUiSound } from '../audio/uiSound'
import { getRankProgress, RANK_TIERS } from '../game/data/ranks'
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
          <>
            <RankBadge xp={profile.xp} />
            <p className="menu-stats">
              {profile.displayName} · XP: {profile.xp} · Credits: {profile.credits} · Best score: {profile.bestScore}
            </p>
          </>
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

function RankBadge({ xp }: { xp: number }) {
  const [showList, setShowList] = useState(false)
  const { rank, next, progress } = getRankProgress(xp)
  return (
    <>
      <button
        className="menu-rank"
        onClick={() => {
          playUiSound('ui_select')
          setShowList(true)
        }}
      >
        <img className="menu-rank-icon" src={`${import.meta.env.BASE_URL}ui/${rank.icon}`} alt="" />
        <div className="menu-rank-info">
          <span className="menu-rank-name">{rank.name}</span>
          {next && (
            <>
              <div className="menu-rank-bar">
                <div className="menu-rank-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <span className="menu-rank-next">{next.minXp - xp} XP to {next.name}</span>
            </>
          )}
        </div>
      </button>
      {showList && <RankListModal xp={xp} currentRankId={rank.id} onClose={() => setShowList(false)} />}
    </>
  )
}

function RankListModal({ xp, currentRankId, onClose }: { xp: number; currentRankId: string; onClose: () => void }) {
  return (
    <div
      className="rank-modal-backdrop"
      onClick={() => {
        playUiSound('ui_select')
        onClose()
      }}
    >
      <div className="rank-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rank-modal-header">
          <span className="briefing-value">Ranks</span>
          <button
            className="rank-modal-close"
            onClick={() => {
              playUiSound('ui_select')
              onClose()
            }}
          >
            ✕
          </button>
        </div>
        <ul className="rank-modal-list">
          {RANK_TIERS.map((tier) => {
            const isCurrent = tier.id === currentRankId
            const reached = xp >= tier.minXp
            return (
              <li key={tier.id} className={`rank-modal-row ${isCurrent ? 'rank-modal-row-current' : ''}`}>
                <img
                  className={`rank-modal-row-icon ${reached ? '' : 'rank-modal-row-icon-locked'}`}
                  src={`${import.meta.env.BASE_URL}ui/${tier.icon}`}
                  alt=""
                />
                <span className="rank-modal-row-name">{tier.name}</span>
                <span className="rank-modal-row-xp">{tier.minXp.toLocaleString()} XP</span>
                {isCurrent && <span className="rank-modal-row-you">YOU</span>}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
