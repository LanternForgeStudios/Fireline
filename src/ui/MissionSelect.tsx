import { playUiSound } from '../audio/uiSound'
import { MISSIONS } from '../game/data/missions'
import type { MissionDef } from '../game/types'

interface MissionSelectProps {
  onSelect: (mission: MissionDef) => void
  onBack: () => void
}

function toCssColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`
}

export function MissionSelect({ onSelect, onBack }: MissionSelectProps) {
  return (
    <div className="screen briefing-screen">
      <div className="briefing-content">
        <div className="briefing-type">Mission Select</div>
        <h2 className="briefing-name">Choose an Operation</h2>

        <div className="mission-list">
          {MISSIONS.map((mission) => (
            <button
              key={mission.id}
              className="mission-list-item"
              style={{ borderLeftColor: toCssColor(mission.theme.skyBottom) }}
              onClick={() => {
                playUiSound('ui_confirm')
                onSelect(mission)
              }}
            >
              <div className="mission-list-header">
                <span className="briefing-type">{mission.type}</span>
                <span className="hud-label">{mission.waves.length} waves</span>
              </div>
              <div className="briefing-name mission-list-name">{mission.name}</div>
              <p className="briefing-text mission-list-blurb">{mission.briefing}</p>
            </button>
          ))}
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
