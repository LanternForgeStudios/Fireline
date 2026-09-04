import { useEffect } from 'react'
import { playUiSound } from '../audio/uiSound'
import type { Difficulty, MissionResult, MissionStats, SecondaryObjective } from '../game/types'

interface ResultScreenProps {
  result: MissionResult
  objective: SecondaryObjective
  /** This operation's lifetime stats, updated by the same server call that recorded this
   * run — null until that call resolves (briefly, since App.tsx awaits it before setting
   * this), or if the operation has never actually been completed. */
  stats: MissionStats | null
  onReturnToBase: () => void
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }

export function ResultScreen({ result, objective, stats, onReturnToBase }: ResultScreenProps) {
  const success = result.outcome === 'complete'

  useEffect(() => {
    playUiSound(success ? 'mission_complete' : 'mission_failed')
  }, [success])

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

        <div className={`result-objective ${result.secondaryObjectiveComplete ? 'result-objective-met' : ''}`}>
          <span className="hud-label">Bonus Objective {result.secondaryObjectiveComplete ? '— Complete' : success ? '— Missed' : ''}</span>
          <p className="briefing-text mission-list-blurb">
            {objective.label}
            {result.secondaryObjectiveComplete && ` — +${objective.bonusCredits} credits`}
          </p>
        </div>

        {stats && (
          <p className="result-operation-stats">
            This operation: completed {stats.completions}× · highest difficulty {DIFFICULTY_LABEL[stats.highestDifficulty]}
          </p>
        )}

        <button className="btn btn-primary" onClick={onReturnToBase}>
          Return to Base
        </button>
      </div>
    </div>
  )
}
