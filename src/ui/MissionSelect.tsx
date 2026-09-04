import { useState } from 'react'
import { playUiSound } from '../audio/uiSound'
import { MISSIONS } from '../game/data/missions'
import { generateMission } from '../game/generation/generateMission'
import type { Difficulty, MissionDef, MissionStats } from '../game/types'

interface MissionSelectProps {
  onSelect: (mission: MissionDef) => void
  onBack: () => void
  operationStats: Record<string, MissionStats>
}

function toCssColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }

const MISSION_ICON: Record<string, string> = {
  'operation-firebreak': 'icon-mission-firebreak.png',
  'operation-steel-convoy': 'icon-mission-steelconvoy.png',
  'operation-green-hell': 'icon-mission-greenhell.png',
  'operation-nightfall': 'icon-mission-nightfall.png',
}
const RANDOM_MISSION_ICON = 'icon-mission-random.png'

/** Random missions get a fresh id every reroll, so there's no persistent
 * "operation" identity to show completion history against — only the
 * hand-authored missions get a stats line. */
function OperationStatsLine({ stats }: { stats: MissionStats | undefined }) {
  if (!stats || stats.completions === 0) return null
  return (
    <p className="mission-list-stats">
      Completed {stats.completions}× · Highest: {DIFFICULTY_LABEL[stats.highestDifficulty]}
    </p>
  )
}

export function MissionSelect({ onSelect, onBack, operationStats }: MissionSelectProps) {
  const [randomMission, setRandomMission] = useState<MissionDef>(() => generateMission())

  const reroll = () => {
    playUiSound('toggle_on')
    setRandomMission(generateMission())
  }

  // Procedural missions unlock only once every hand-authored operation has
  // been cleared at least once, at any difficulty — a floor under how a
  // new player first meets each of the game's hand-tuned encounters before
  // the randomizer starts mixing them, rather than skippable content.
  const uncompletedMissions = MISSIONS.filter((m) => (operationStats[m.id]?.completions ?? 0) === 0)
  const randomUnlocked = uncompletedMissions.length === 0

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
              <img className="mission-list-icon" src={`${import.meta.env.BASE_URL}ui/${MISSION_ICON[mission.id]}`} alt="" />
              <div className="mission-list-body">
                <div className="mission-list-header">
                  <span className="briefing-type">{mission.type}</span>
                  <span className="hud-label">{mission.waves.length} waves</span>
                </div>
                <div className="briefing-name mission-list-name">{mission.name}</div>
                <p className="briefing-text mission-list-blurb">{mission.briefing}</p>
                <OperationStatsLine stats={operationStats[mission.id]} />
              </div>
            </button>
          ))}

          {randomUnlocked ? (
            <div className="mission-list-item mission-list-item-random" style={{ borderLeftColor: toCssColor(randomMission.theme.skyBottom) }}>
              <img className="mission-list-icon" src={`${import.meta.env.BASE_URL}ui/${RANDOM_MISSION_ICON}`} alt="" />
              <div className="mission-list-random-body">
                <button
                  key={randomMission.id}
                  className="mission-list-random-select"
                  onClick={() => {
                    playUiSound('ui_confirm')
                    onSelect(randomMission)
                  }}
                >
                  <div className="mission-list-header">
                    <span className="briefing-type">Randomly Generated&nbsp;· {randomMission.type}</span>
                    <span className="hud-label">{randomMission.waves.length} waves</span>
                  </div>
                  <div className="briefing-name mission-list-name">{randomMission.name}</div>
                  <p className="briefing-text mission-list-blurb">{randomMission.briefing}</p>
                </button>
                <button className="mission-reroll" onClick={reroll}>
                  🎲 Reroll
                </button>
              </div>
            </div>
          ) : (
            <div className="mission-list-item mission-list-item-locked">
              <img className="mission-list-icon mission-list-icon-locked" src={`${import.meta.env.BASE_URL}ui/${RANDOM_MISSION_ICON}`} alt="" />
              <div className="mission-list-body">
                <div className="mission-list-header">
                  <span className="briefing-type">Randomly Generated&nbsp;· Locked</span>
                </div>
                <div className="briefing-name mission-list-name">🔒 Clear every operation to unlock</div>
                <p className="briefing-text mission-list-blurb">
                  Complete {uncompletedMissions.map((m) => m.name).join(', ')} at least once (any difficulty) to
                  unlock procedurally generated operations.
                </p>
              </div>
            </div>
          )}
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
