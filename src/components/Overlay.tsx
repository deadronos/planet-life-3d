import { useState } from 'react';

import { useUIStore } from '../store/useUIStore';

export function Overlay() {
  const stats = useUIStore((state) => state.stats);

  const [showHint, setShowHint] = useState<boolean>(() => {
    const hintShown = localStorage.getItem('onboardingHintShown');
    return !hintShown;
  });

  const dismissHint = () => {
    setShowHint(false);
    localStorage.setItem('onboardingHintShown', 'true');
  };

  return (
    <div className="overlay-panel">
      <div className="title-card">
        <h1>Planet Life 3D</h1>
        <p>Cellular Automata Simulation</p>
      </div>

      {showHint && (
        <div className="onboarding-hint" role="region" aria-label="Onboarding instructions">
          <p>
            Drag to orbit • Scroll to zoom • Click planet to fire meteor • Press &apos;h&apos; to
            toggle UI.
          </p>
          <button
            onClick={dismissHint}
            aria-label="Dismiss instructions"
            className="hint-dismiss-btn"
          >
            ✕
          </button>
        </div>
      )}

      <div className="hud-stats">
        <div className="hud-row">
          <span className="hud-label">Gen</span>
          <span className="hud-value">{stats.generation}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Pop</span>
          <span className="hud-value">{stats.population}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Births</span>
          <span className="hud-value">{stats.birthsLastTick}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Deaths</span>
          <span className="hud-value">{stats.deathsLastTick}</span>
        </div>
      </div>

      {/* We can add more UI elements here later if needed, like stats or instructions */}
    </div>
  );
}
