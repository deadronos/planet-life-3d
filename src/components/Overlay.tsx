import { useEffect, useState } from 'react';

export function Overlay() {
  const [showHint] = useState<boolean>(() => {
    const hintShown = localStorage.getItem('onboardingHintShown');
    return !hintShown;
  });

  useEffect(() => {
    if (showHint) {
      localStorage.setItem('onboardingHintShown', 'true');
    }
  }, [showHint]);

  return (
    <div className="overlay-panel">
      <div className="title-card">
        <h1>Planet Life 3D</h1>
        <p>Cellular Automata Simulation</p>
      </div>

      {showHint && (
        <div className="onboarding-hint">
          <p>Drag to orbit • Scroll to zoom • Click planet to fire meteor.</p>
        </div>
      )}

      {/* We can add more UI elements here later if needed, like stats or instructions */}
    </div>
  );
}
