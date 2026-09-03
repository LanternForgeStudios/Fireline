import { playUiSound } from '../audio/uiSound'

interface CreditsScreenProps {
  onBack: () => void
}

export function CreditsScreen({ onBack }: CreditsScreenProps) {
  return (
    <div className="screen briefing-screen">
      <div className="briefing-content">
        <div className="briefing-type">Credits</div>
        <h2 className="briefing-name">Fireline</h2>

        <p className="briefing-text">
          Built by LanternForge Studios with React, Phaser, and Firebase. Pixel art generated with{' '}
          <a href="https://pixellab.ai" target="_blank" rel="noreferrer">
            PixelLab
          </a>
          .
        </p>

        <div className="briefing-details" style={{ flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <span className="hud-label">Music</span>
            <p className="briefing-text" style={{ marginBottom: 0 }}>
              "Title Theme" and "Battle 1" — original music by Marllon Silva (
              <a href="https://xdeviruchi.itch.io/" target="_blank" rel="noreferrer">
                xDeviruchi
              </a>
              ), used under license.
            </p>
          </div>
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
