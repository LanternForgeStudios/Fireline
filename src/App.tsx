import { useCallback, useEffect, useState } from 'react'
import { gameEvents } from './game/events'
import { EVT_MISSION_COMPLETE, EVT_MISSION_FAILED, type MissionResult } from './game/types'
import { GameCanvas } from './ui/GameCanvas'
import { Hud } from './ui/Hud'
import { MainMenu } from './ui/MainMenu'
import { MissionBriefing } from './ui/MissionBriefing'
import { ResultScreen } from './ui/ResultScreen'
import './App.css'

type Screen = 'menu' | 'briefing' | 'playing' | 'result'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [result, setResult] = useState<MissionResult | null>(null)

  useEffect(() => {
    const onComplete = (missionResult: MissionResult) => {
      setResult(missionResult)
      setScreen('result')
    }
    const onFailed = (missionResult: MissionResult) => {
      setResult(missionResult)
      setScreen('result')
    }
    gameEvents.on(EVT_MISSION_COMPLETE, onComplete)
    gameEvents.on(EVT_MISSION_FAILED, onFailed)
    return () => {
      gameEvents.off(EVT_MISSION_COMPLETE, onComplete)
      gameEvents.off(EVT_MISSION_FAILED, onFailed)
    }
  }, [])

  const goToBriefing = useCallback(() => setScreen('briefing'), [])
  const goToMenu = useCallback(() => setScreen('menu'), [])
  const launchMission = useCallback(() => setScreen('playing'), [])

  return (
    <div className="app-root">
      {screen === 'menu' && <MainMenu onStart={goToBriefing} />}
      {screen === 'briefing' && <MissionBriefing onLaunch={launchMission} onBack={goToMenu} />}
      {screen === 'playing' && (
        <div className="play-screen">
          <GameCanvas />
          <Hud />
        </div>
      )}
      {screen === 'result' && result && <ResultScreen result={result} onReturnToBase={goToMenu} />}
    </div>
  )
}

export default App
