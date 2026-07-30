interface MainMenuProps {
  onStart: () => void
}

export function MainMenu({ onStart }: MainMenuProps) {
  return (
    <div className="screen menu-screen">
      <div className="menu-content">
        <h1 className="title">FIRELINE</h1>
        <p className="subtitle">Helicopter Gunner</p>
        <p className="menu-blurb">
          Ride the door gun. Hold the line until extraction.
        </p>
        <button className="btn btn-primary" onClick={onStart}>
          Start Mission
        </button>
        <p className="menu-footnote">Combat Prototype — MVP Phase 1</p>
      </div>
    </div>
  )
}
