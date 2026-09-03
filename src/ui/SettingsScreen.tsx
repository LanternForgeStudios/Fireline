import { useState } from 'react'
import { playUiSound } from '../audio/uiSound'
import type { Difficulty, PlayerSettings } from '../firebase/playerProfile'

interface SettingsScreenProps {
  settings: PlayerSettings
  onChange: (settings: Partial<PlayerSettings>) => void
  onResetProgress: () => void
  onBack: () => void
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

export function SettingsScreen({ settings, onChange, onResetProgress, onBack }: SettingsScreenProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)

  return (
    <div className="screen briefing-screen">
      <div className="briefing-content">
        <div className="briefing-type">Settings</div>
        <h2 className="briefing-name">Options</h2>
        <p className="briefing-text settings-autosave-note">Changes save automatically to your account.</p>

        <label className="settings-row">
          <span>Music volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={(e) => onChange({ musicVolume: Number(e.target.value) })}
          />
        </label>

        <label className="settings-row">
          <span>SFX volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            onChange={(e) => {
              onChange({ sfxVolume: Number(e.target.value) })
              playUiSound('ui_select')
            }}
          />
        </label>

        <div className="settings-row">
          <span>Difficulty</span>
          <div className="difficulty-picker">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={`btn btn-secondary ${settings.difficulty === d ? 'btn-active' : ''}`}
                onClick={() => {
                  onChange({ difficulty: d })
                  playUiSound('toggle_on')
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="briefing-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              onBack()
              playUiSound('ui_select')
            }}
          >
            Back
          </button>
          {confirmingReset ? (
            <button
              className="btn btn-danger"
              onClick={() => {
                onResetProgress()
                setConfirmingReset(false)
                playUiSound('ui_confirm')
              }}
            >
              Confirm reset
            </button>
          ) : (
            <button
              className="btn btn-danger"
              onClick={() => {
                setConfirmingReset(true)
                playUiSound('toggle_off')
              }}
            >
              Reset progress
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
