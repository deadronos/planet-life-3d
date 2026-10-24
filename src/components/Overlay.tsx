import { useState } from 'react';

import { METEOR_TOOLS, useUIStore } from '../store/useUIStore';
import { TransportBar } from './TransportBar';

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const HUD_COLLAPSED_KEY = 'hudCollapsed';

function readHudCollapsed(): boolean {
  try {
    return localStorage.getItem(HUD_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
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

  const [hudCollapsed, setHudCollapsed] = useState<boolean>(readHudCollapsed);

  const toggleHud = () => {
    const next = !hudCollapsed;
    setHudCollapsed(next);
    try {
      localStorage.setItem(HUD_COLLAPSED_KEY, String(next));
    } catch {
      /* storage unavailable; the choice just won't persist */
    }
  };

  const dismissHint = () => {
    setShowHint(false);
    localStorage.setItem('onboardingHintShown', 'true');
  };

  return (
    <div className="overlay-panel">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Active meteor tool: {activeTool}
      </div>
      <div className="overlay-column">
        <div className="title-card">
          <h1>Planet Life 3D</h1>
          <p>Cellular Automata Simulation</p>
        </div>

        {showHint && (
          <div className="onboarding-hint" role="region" aria-label="Onboarding instructions">
            <p>
              Drag to orbit • Scroll to zoom • Click planet to fire meteor
              {/* Keyboard shortcuts are hidden on narrow (touch) screens to keep the hint short. */}
              <span className="hint-keys">
                {' '}
                • Press &apos;h&apos; to toggle UI • Space play/pause • N step • R randomize • C
                clear • 1–5 meteor tools.
              </span>
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

        <section
          className={hudCollapsed ? 'hud-stats hud-collapsed' : 'hud-stats'}
          aria-label="Planet status"
        >
          <div className="hud-header">
            <div className="hud-kicker">{planetStatus.preset}</div>
            <button
              type="button"
              className="hud-toggle-btn"
              onClick={toggleHud}
              aria-expanded={!hudCollapsed}
              aria-label="Planet status details"
            >
              {hudCollapsed ? '▸' : '▾'}
            </button>
          </div>
          <div className="hud-row">
            <span className="hud-label">Gen</span>
            <span className="hud-value">{stats.generation}</span>
          </div>
          <div className="hud-row">
            <span className="hud-label">Pop</span>
            <span className="hud-value">{stats.population}</span>
          </div>
          <div className="hud-row hud-detail">
            <span className="hud-label">Births</span>
            <span className="hud-value">{stats.birthsLastTick}</span>
          </div>
          <div className="hud-row hud-detail">
            <span className="hud-label">Deaths</span>
            <span className="hud-value">{stats.deathsLastTick}</span>
          </div>
          <div className="hud-divider hud-detail" />
          <div className="hud-row hud-detail">
            <span className="hud-label">Mode</span>
            <span className="hud-value">{planetStatus.gameMode}</span>
          </div>
          <div className="hud-row hud-detail">
            <span className="hud-label">Biome</span>
            <span className="hud-value">{planetStatus.ecologyProfile}</span>
          </div>
          <div className="hud-row hud-detail">
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
      </div>

      <div className="bottom-dock">
        <TransportBar />
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
    </div>
  );
}
