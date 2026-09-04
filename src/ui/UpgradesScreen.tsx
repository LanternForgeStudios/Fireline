import { useState } from 'react'
import { playUiSound } from '../audio/uiSound'
import { nextPurchasableLevel, UPGRADE_TRACKS, type UpgradeTrackId } from '../game/data/upgrades'

interface UpgradesScreenProps {
  credits: number
  unlockedUpgrades: string[]
  onPurchase: (upgradeId: string) => Promise<void>
  onBack: () => void
}

const TRACK_ICON: Record<UpgradeTrackId, string> = {
  damage: 'icon-upgrade-damage.png',
  cooling: 'icon-upgrade-cooling.png',
  heatCapacity: 'icon-upgrade-heatcapacity.png',
  fireRate: 'icon-upgrade-firerate.png',
}

const TRACK_ACCENT: Record<UpgradeTrackId, string> = {
  damage: '#e2543d',
  cooling: '#5aa9e6',
  heatCapacity: '#d9b45f',
  fireRate: '#f2c14e',
}

export function UpgradesScreen({ credits, unlockedUpgrades, onPurchase, onBack }: UpgradesScreenProps) {
  const [pendingTrack, setPendingTrack] = useState<string | null>(null)
  const [errorByTrack, setErrorByTrack] = useState<Record<string, string>>({})

  const handlePurchase = async (trackId: string, upgradeId: string) => {
    setPendingTrack(trackId)
    setErrorByTrack((prev) => ({ ...prev, [trackId]: '' }))
    try {
      await onPurchase(upgradeId)
      playUiSound('ui_confirm')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Purchase failed.'
      setErrorByTrack((prev) => ({ ...prev, [trackId]: message }))
      playUiSound('toggle_off')
    } finally {
      setPendingTrack(null)
    }
  }

  return (
    <div className="screen briefing-screen">
      <div className="briefing-content">
        <div className="briefing-type">Loadout</div>
        <h2 className="briefing-name">Weapon Upgrades</h2>
        <p className="briefing-text settings-autosave-note">Credits: {credits.toLocaleString()}</p>

        <div className="upgrade-track-list">
          {UPGRADE_TRACKS.map((track) => {
            const next = nextPurchasableLevel(track, unlockedUpgrades)
            const maxed = next === null
            const canAfford = next !== null && credits >= next.cost

            return (
              <div
                key={track.id}
                className={`upgrade-track ${maxed ? 'upgrade-track-maxed' : ''}`}
                style={{ borderLeftColor: maxed ? '#d9b45f' : TRACK_ACCENT[track.id] }}
              >
                <img className="upgrade-track-icon" src={`${import.meta.env.BASE_URL}ui/${TRACK_ICON[track.id]}`} alt="" />
                <div className="upgrade-track-body">
                  <div className="upgrade-track-header">
                    <span className="briefing-value">{track.label}</span>
                    <div className="upgrade-track-dots">
                      {track.levels.map((l) => (
                        <span
                          key={l.id}
                          className={`upgrade-dot ${unlockedUpgrades.includes(l.id) ? 'upgrade-dot-owned' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="briefing-text mission-list-blurb">{track.description}</p>
                  {errorByTrack[track.id] && <p className="login-error">{errorByTrack[track.id]}</p>}
                  {maxed ? (
                    <span className="hud-label upgrade-track-maxed-label">Maxed out</span>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      disabled={!canAfford || pendingTrack === track.id}
                      onClick={() => handlePurchase(track.id, next.id)}
                    >
                      {pendingTrack === track.id ? 'Purchasing...' : `Buy ${next.label} — ${next.cost} cr`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="briefing-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              playUiSound('ui_select')
              onBack()
            }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
