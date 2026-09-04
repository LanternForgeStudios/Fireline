import { useState } from 'react'
import { playUiSound } from '../audio/uiSound'
import type { Difficulty, PlayerSettings } from '../firebase/playerProfile'

interface SettingsScreenProps {
  settings: PlayerSettings
  confirmEmail: string | null
  onChange: (settings: Partial<PlayerSettings>) => void
  onResetProgress: () => void
  onBack: () => void
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

export function SettingsScreen({ settings, confirmEmail, onChange, onResetProgress, onBack }: SettingsScreenProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  const emailMatches = confirmEmail !== null && emailInput.trim().toLowerCase() === confirmEmail.trim().toLowerCase()

  const cancelReset = () => {
    setConfirmingReset(false)
    setEmailInput('')
  }

  return (
    <div className="screen briefing-screen">
      <div className="briefing-content">
        <div className="briefing-type">Settings</div>
        <h2 className="briefing-name">Options</h2>
        <p className="briefing-text settings-autosave-note">Changes save automatically to your account.</p>

        <div className="settings-row">
          <span>Music volume</span>
          <div className="settings-row-controls">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              disabled={settings.musicMuted}
              onChange={(e) => onChange({ musicVolume: Number(e.target.value) })}
            />
            <label className="settings-mute-toggle">
              <input
                type="checkbox"
                checked={settings.musicMuted ?? false}
                onChange={(e) => {
                  onChange({ musicMuted: e.target.checked })
                  playUiSound(e.target.checked ? 'toggle_off' : 'toggle_on')
                }}
              />
              Mute
            </label>
          </div>
        </div>

        <div className="settings-row">
          <span>SFX volume</span>
          <div className="settings-row-controls">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              disabled={settings.sfxMuted}
              onChange={(e) => {
                onChange({ sfxVolume: Number(e.target.value) })
                playUiSound('ui_select')
              }}
            />
            <label className="settings-mute-toggle">
              <input
                type="checkbox"
                checked={settings.sfxMuted ?? false}
                onChange={(e) => {
                  onChange({ sfxMuted: e.target.checked })
                  playUiSound(e.target.checked ? 'toggle_off' : 'toggle_on')
                }}
              />
              Mute
            </label>
          </div>
        </div>

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

        {confirmingReset && (
          <div className="reset-confirm">
            <p className="briefing-text reset-confirm-text">
              This permanently deletes your XP, credits, best score, and mission history. Type{' '}
              <strong>{confirmEmail}</strong> to confirm.
            </p>
            <input
              className="login-input"
              type="text"
              placeholder="Type your account email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <div className="briefing-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (confirmingReset) {
                cancelReset()
              } else {
                onBack()
              }
              playUiSound('ui_select')
            }}
          >
            {confirmingReset ? 'Cancel' : 'Back'}
          </button>
          {confirmingReset ? (
            <button
              className="btn btn-danger"
              disabled={!emailMatches}
              onClick={() => {
                onResetProgress()
                cancelReset()
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
