import { useState } from 'react'
import { playUiSound } from '../audio/uiSound'
import { GUN_DEFS, gunUpgradeTracks, type GunDef } from '../game/data/guns'
import { nextPurchasableLevel, type UpgradeTrackId } from '../game/data/upgrades'

interface UpgradesScreenProps {
  credits: number
  ownedGuns: string[]
  equippedGun: string
  unlockedUpgrades: string[]
  onPurchaseGun: (gunId: string) => Promise<void>
  onEquipGun: (gunId: string) => Promise<void>
  onPurchaseUpgrade: (upgradeId: string) => Promise<void>
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

const ALL_GUNS: GunDef[] = Object.values(GUN_DEFS)

export function UpgradesScreen({
  credits,
  ownedGuns,
  equippedGun,
  unlockedUpgrades,
  onPurchaseGun,
  onEquipGun,
  onPurchaseUpgrade,
  onBack,
}: UpgradesScreenProps) {
  const [selectedGunId, setSelectedGunId] = useState(equippedGun)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [errorByAction, setErrorByAction] = useState<Record<string, string>>({})

  const selectedGun = GUN_DEFS[selectedGunId] ?? GUN_DEFS[equippedGun]
  const owned = ownedGuns.includes(selectedGun.id)
  const equipped = selectedGun.id === equippedGun

  const runAction = async (actionKey: string, action: () => Promise<void>) => {
    setPendingAction(actionKey)
    setErrorByAction((prev) => ({ ...prev, [actionKey]: '' }))
    try {
      await action()
      playUiSound('ui_confirm')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed.'
      setErrorByAction((prev) => ({ ...prev, [actionKey]: message }))
      playUiSound('toggle_off')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="screen briefing-screen">
      <div className="briefing-content">
        <div className="briefing-type">Loadout</div>
        <h2 className="briefing-name">Armory</h2>
        <p className="briefing-text settings-autosave-note">Credits: {credits.toLocaleString()}</p>

        <div className="gun-tab-strip">
          {ALL_GUNS.map((gun) => {
            const gunOwned = ownedGuns.includes(gun.id)
            const gunEquipped = gun.id === equippedGun
            return (
              <button
                key={gun.id}
                className={`gun-tab ${selectedGun.id === gun.id ? 'gun-tab-active' : ''} ${gunOwned ? '' : 'gun-tab-locked'}`}
                onClick={() => {
                  playUiSound('ui_select')
                  setSelectedGunId(gun.id)
                }}
              >
                <img className="gun-tab-icon" src={`${import.meta.env.BASE_URL}ui/${gun.icon}`} alt="" />
                <span className="gun-tab-name">{gun.name}</span>
                {gunEquipped && <span className="gun-tab-tag">Equipped</span>}
                {!gunOwned && <span className="gun-tab-tag gun-tab-tag-locked">Locked</span>}
              </button>
            )
          })}
        </div>

        <p className="briefing-text mission-list-blurb">{selectedGun.description}</p>

        {!owned ? (
          <div className="upgrade-track" style={{ borderLeftColor: '#4b5563' }}>
            <img className="upgrade-track-icon" src={`${import.meta.env.BASE_URL}ui/${selectedGun.icon}`} alt="" />
            <div className="upgrade-track-body">
              <div className="briefing-details">
                <div>
                  <span className="hud-label">Damage</span>
                  <span className="briefing-value">{selectedGun.baseStats.damagePerShot}</span>
                </div>
                <div>
                  <span className="hud-label">Fire Interval</span>
                  <span className="briefing-value">{selectedGun.baseStats.fireIntervalMs}ms</span>
                </div>
                <div>
                  <span className="hud-label">Heat Capacity</span>
                  <span className="briefing-value">{selectedGun.baseStats.maxHeat}</span>
                </div>
              </div>
              {errorByAction[`purchase-${selectedGun.id}`] && (
                <p className="login-error">{errorByAction[`purchase-${selectedGun.id}`]}</p>
              )}
              <button
                className="btn btn-secondary"
                disabled={credits < selectedGun.unlockCost || pendingAction === `purchase-${selectedGun.id}`}
                onClick={() => runAction(`purchase-${selectedGun.id}`, () => onPurchaseGun(selectedGun.id))}
              >
                {pendingAction === `purchase-${selectedGun.id}` ? 'Purchasing...' : `Purchase — ${selectedGun.unlockCost} cr`}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="upgrade-track-list">
              {gunUpgradeTracks(selectedGun).map((track) => {
                const next = nextPurchasableLevel(track, unlockedUpgrades)
                const maxed = next === null
                const canAfford = next !== null && credits >= next.cost
                // Gun-scoped, not just the bare track name — multiple owned guns share track
                // names (e.g. m134/m60/gau19 all have 'damage'), so a bare `upgrade-${track.id}`
                // key let an in-flight purchase on one gun show as pending/erroring on another
                // gun's identically-named track after switching tabs mid-request.
                const actionKey = `upgrade-${selectedGun.id}-${track.id}`

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
                      {errorByAction[actionKey] && <p className="login-error">{errorByAction[actionKey]}</p>}
                      {maxed ? (
                        <span className="hud-label upgrade-track-maxed-label">Maxed out</span>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          disabled={!canAfford || pendingAction === actionKey}
                          onClick={() => runAction(actionKey, () => onPurchaseUpgrade(next.id))}
                        >
                          {pendingAction === actionKey ? 'Purchasing...' : `Buy ${next.label} — ${next.cost} cr`}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {errorByAction[`equip-${selectedGun.id}`] && <p className="login-error">{errorByAction[`equip-${selectedGun.id}`]}</p>}
            {!equipped && (
              <button
                className="btn btn-secondary"
                disabled={pendingAction === `equip-${selectedGun.id}`}
                onClick={() => runAction(`equip-${selectedGun.id}`, () => onEquipGun(selectedGun.id))}
              >
                {pendingAction === `equip-${selectedGun.id}` ? 'Equipping...' : 'Equip'}
              </button>
            )}
          </>
        )}

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
