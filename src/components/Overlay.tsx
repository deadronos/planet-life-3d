import { useState } from 'react';

import { type MeteorTool, useUIStore } from '../store/useUIStore';

const METEOR_TOOLS: MeteorTool[] = ['Life', 'Sterilizer', 'Mutation', 'Comet', 'Probe'];

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function Overlay() {
  const stats = useUIStore((state) => state.stats);
  const planetStatus = useUIStore((state) => state.planetStatus);
  const activeTool = useUIStore((state) => state.activeTool);
  const setActiveTool = useUIStore((state) => state.setActiveTool);
  const probe = useUIStore((state) => state.probe);

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

      <section className="hud-stats" aria-label="Planet status">
        <div className="hud-kicker">{planetStatus.preset}</div>
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
        <div className="hud-divider" />
        <div className="hud-row">
          <span className="hud-label">Mode</span>
          <span className="hud-value">{planetStatus.gameMode}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Biome</span>
          <span className="hud-value">{planetStatus.ecologyProfile}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">Seed</span>
          <span className="hud-value">{planetStatus.seedPattern}</span>
        </div>
      </section>

      {probe && (
        <section className="probe-card" aria-label="Impact probe">
          <div className="hud-kicker">{probe.sample.biome}</div>
          <div className="probe-grid">
            <span>Lat</span>
            <strong>{probe.lat}</strong>
            <span>Lon</span>
            <strong>{probe.lon}</strong>
            <span>Moist</span>
            <strong>{formatPercent(probe.sample.moisture)}</strong>
            <span>Fertile</span>
            <strong>{formatPercent(probe.sample.fertility)}</strong>
          </div>
        </section>
      )}

      <div className="meteor-toolbelt" role="toolbar" aria-label="Meteor tools">
        {METEOR_TOOLS.map((tool) => (
          <button
            key={tool}
            type="button"
            className={tool === activeTool ? 'tool-button active' : 'tool-button'}
            onClick={() => setActiveTool(tool)}
            aria-pressed={tool === activeTool}
          >
            {tool}
          </button>
        ))}
      </div>
    </div>
  );
}
