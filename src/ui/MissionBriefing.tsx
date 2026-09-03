import { playUiSound } from '../audio/uiSound'
import type { MissionDef } from '../game/types'

interface MissionBriefingProps {
  mission: MissionDef
  onLaunch: () => void
  onBack: () => void
}

export function MissionBriefing({ mission, onLaunch, onBack }: MissionBriefingProps) {
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
            <span className="briefing-value">Door Gun (M134)</span>
          </div>
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
