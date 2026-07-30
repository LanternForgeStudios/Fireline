import type { MissionResult } from '../game/types'

interface ResultScreenProps {
  result: MissionResult
  onReturnToBase: () => void
}

export function ResultScreen({ result, onReturnToBase }: ResultScreenProps) {
  const success = result.outcome === 'complete'

  return (
    <div className="screen result-screen">
      <div className="result-content">
        <h2 className={`result-title ${success ? 'success' : 'failure'}`}>
          {success ? 'Extraction Complete' : 'Aircraft Down'}
        </h2>
        <p className="result-subtitle">
          {success
            ? 'All contacts cleared. The bird made it back.'
            : 'Damage exceeded structural limits before extraction.'}
        </p>

        <div className="result-stats">
          <div className="result-stat">
            <span className="hud-label">Score</span>
            <span className="briefing-value">{result.score.toLocaleString()}</span>
          </div>
          <div className="result-stat">
            <span className="hud-label">Waves Cleared</span>
            <span className="briefing-value">
              {result.wavesCleared} / {result.totalWaves}
            </span>
          </div>
          <div className="result-stat">
            <span className="hud-label">Contacts Destroyed</span>
            <span className="briefing-value">{result.enemiesDestroyed}</span>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onReturnToBase}>
          Return to Base
        </button>
      </div>
    </div>
  )
}
