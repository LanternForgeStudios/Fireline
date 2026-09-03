import { playUiSound } from '../audio/uiSound'
import { UPGRADE_TRACKS } from '../game/data/upgrades'
import type { MissionDef } from '../game/types'

interface MissionBriefingProps {
  mission: MissionDef
  unlockedUpgrades: string[]
  onLaunch: () => void
  onBack: () => void
}

function loadoutSummary(unlockedUpgrades: string[]): string {
  const owned = new Set(unlockedUpgrades)
  const parts = UPGRADE_TRACKS.map((track) => {
    const level = track.levels.filter((l) => owned.has(l.id)).length
    return level > 0 ? `${track.label} ${level}` : null
  }).filter((p): p is string => p !== null)

  return parts.length > 0 ? `Door Gun (M134) · ${parts.join(' · ')}` : 'Door Gun (M134) — Stock'
}

export function MissionBriefing({ mission, unlockedUpgrades, onLaunch, onBack }: MissionBriefingProps) {
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
            <span className="briefing-value">{loadoutSummary(unlockedUpgrades)}</span>
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
