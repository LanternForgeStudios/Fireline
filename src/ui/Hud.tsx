import { useEffect, useRef, useState } from 'react'
import { gameEvents } from '../game/events'
import { EVT_HIT_MARKER, EVT_HUD_UPDATE, type HudState } from '../game/types'
import { missionState } from '../game/missionState'

const INITIAL_STATE: HudState = {
  health: 100,
  maxHealth: 100,
  heat: 0,
  maxHeat: 100,
  overheated: false,
  score: 0,
  waveIndex: 0,
  waveCount: missionState.current.waves.length,
  enemiesRemaining: 0,
  zoomed: false,
}

export function Hud() {
  const [state, setState] = useState<HudState>(INITIAL_STATE)
  const [hitFlash, setHitFlash] = useState(false)
  const flashTimeout = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onHud = (next: HudState) => setState(next)
    const onHit = ({ hit }: { hit: boolean }) => {
      if (!hit) return
      setHitFlash(true)
      window.clearTimeout(flashTimeout.current)
      flashTimeout.current = window.setTimeout(() => setHitFlash(false), 80)
    }
    gameEvents.on(EVT_HUD_UPDATE, onHud)
    gameEvents.on(EVT_HIT_MARKER, onHit)
    return () => {
      gameEvents.off(EVT_HUD_UPDATE, onHud)
      gameEvents.off(EVT_HIT_MARKER, onHit)
      window.clearTimeout(flashTimeout.current)
    }
  }, [])

  const healthPct = Math.round((state.health / state.maxHealth) * 100)
  const heatPct = Math.round((state.heat / state.maxHeat) * 100)
  const wave = missionState.current.waves[state.waveIndex]

  return (
    <div className="hud">
      <div className="hud-cockpit-frame" />
      {hitFlash && <div className="hud-hit-flash" />}
      {state.zoomed && (
        <div className="hud-zoom-indicator">
          <span className="hud-label">ZOOM</span>
        </div>
      )}

      <div className="hud-top-left">
        <div className="hud-label">Aircraft</div>
        <div className="hud-bar">
          <div
            className={`hud-bar-fill health ${healthPct <= 25 ? 'critical' : ''}`}
            style={{ width: `${healthPct}%` }}
          />
        </div>
      </div>

      <div className="hud-top-right">
        <div className="hud-label">Score</div>
        <div className="hud-score">{state.score.toLocaleString()}</div>
      </div>

      <div className="hud-bottom-left">
        <div className="hud-label">Wave {Math.min(state.waveIndex + 1, state.waveCount)} / {state.waveCount}</div>
        <div className="hud-sublabel">{wave?.name ?? ''}</div>
      </div>

      <div className="hud-bottom-right">
        <div className="hud-label">Gun Heat{state.overheated ? ' — OVERHEATED' : ''}</div>
        <div className="hud-bar">
          <div
            className={`hud-bar-fill heat ${state.overheated ? 'critical' : ''}`}
            style={{ width: `${heatPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
