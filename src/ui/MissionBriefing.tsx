import { playUiSound } from '../audio/uiSound'
import { getGunDef, gunUpgradeTracks } from '../game/data/guns'
import type { MissionDef } from '../game/types'

interface MissionBriefingProps {
  mission: MissionDef
  equippedGun: string
  unlockedUpgrades: string[]
  onLaunch: () => void
  onBack: () => void
}

function loadoutSummary(gunId: string, unlockedUpgrades: string[]): string {
  const gun = getGunDef(gunId)
  const owned = new Set(unlockedUpgrades)
  const parts = gunUpgradeTracks(gun)
    .map((track) => {
      const level = track.levels.filter((l) => owned.has(l.id)).length
      return level > 0 ? `${track.label} ${level}` : null
    })
    .filter((p): p is string => p !== null)

  return parts.length > 0 ? `${gun.name} · ${parts.join(' · ')}` : `${gun.name} — Stock`
}

export function MissionBriefing({ mission, equippedGun, unlockedUpgrades, onLaunch, onBack }: MissionBriefingProps) {
  return (
    <div className="screen briefing-screen">
      <div className="briefing-content">
        <div className="briefing-type">{mission.type}</div>
        <h2 className="briefing-name">{mission.name}</h2>
        <p className="briefing-text">{mission.briefing}</p>

        <div className="briefing-details">
          <div>
            <span className="hud-label">Waves</span>
            <span className="briefing-value">{mission.waves.length}</span>
          </div>
          <div>
            <span className="hud-label">Loadout</span>
            <span className="briefing-value">{loadoutSummary(equippedGun, unlockedUpgrades)}</span>
          </div>
        </div>

        <div className="briefing-objective">
          <span className="hud-label">Bonus Objective</span>
          <p className="briefing-text mission-list-blurb">
            {mission.secondaryObjective.label} — +{mission.secondaryObjective.bonusCredits} credits
          </p>
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
          <button
            className="btn btn-primary"
            onClick={() => {
              playUiSound('ui_confirm')
              onLaunch()
            }}
          >
            Launch
          </button>
        </div>
      </div>
    </div>
  )
}
