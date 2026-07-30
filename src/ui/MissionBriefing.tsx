import { PROTOTYPE_MISSION } from '../game/data/waves'

interface MissionBriefingProps {
  onLaunch: () => void
  onBack: () => void
}

export function MissionBriefing({ onLaunch, onBack }: MissionBriefingProps) {
  return (
    <div className="screen briefing-screen">
      <div className="briefing-content">
        <div className="briefing-type">{PROTOTYPE_MISSION.type}</div>
        <h2 className="briefing-name">{PROTOTYPE_MISSION.name}</h2>
        <p className="briefing-text">{PROTOTYPE_MISSION.briefing}</p>

        <div className="briefing-details">
          <div>
            <span className="hud-label">Waves</span>
            <span className="briefing-value">{PROTOTYPE_MISSION.waves.length}</span>
          </div>
          <div>
            <span className="hud-label">Loadout</span>
            <span className="briefing-value">Door Gun (M134)</span>
          </div>
        </div>

        <div className="briefing-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
          <button className="btn btn-primary" onClick={onLaunch}>
            Launch
          </button>
        </div>
      </div>
    </div>
  )
}
