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

        <VolumeRow
          label="Music volume"
          volume={settings.musicVolume}
          muted={settings.musicMuted ?? false}
          onVolumeChange={(v) => onChange({ musicVolume: v })}
          onMutedChange={(m) => onChange({ musicMuted: m })}
        />

        <VolumeRow
          label="SFX volume"
          volume={settings.sfxVolume}
          muted={settings.sfxMuted ?? false}
          onVolumeChange={(v) => onChange({ sfxVolume: v })}
          onMutedChange={(m) => onChange({ sfxMuted: m })}
          previewOnChange
        />

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

interface VolumeRowProps {
  label: string
  volume: number
  muted: boolean
  onVolumeChange: (value: number) => void
  onMutedChange: (muted: boolean) => void
  /** SFX volume plays a sample on change so the new level is audible;
   * music volume doesn't (playing an SFX blip to preview a music-volume
   * change would be confusing, not helpful). */
  previewOnChange?: boolean
}

function VolumeRow({ label, volume, muted, onVolumeChange, onMutedChange, previewOnChange }: VolumeRowProps) {
  const inputId = `volume-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="settings-row">
      <label className="settings-row-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="settings-row-controls">
        <input
          id={inputId}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={muted}
          onChange={(e) => {
            onVolumeChange(Number(e.target.value))
            if (previewOnChange) playUiSound('ui_select')
          }}
        />
        <label className="settings-mute-toggle">
          <input
            type="checkbox"
            checked={muted}
            onChange={(e) => {
              onMutedChange(e.target.checked)
              playUiSound(e.target.checked ? 'toggle_off' : 'toggle_on')
            }}
          />
          Mute
        </label>
      </div>
    </div>
  )
}
