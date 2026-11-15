import { useState } from 'react';

import { useControlsStore } from '../store/useControlsStore';
import { METEOR_TOOLS, useUIStore } from '../store/useUIStore';
import { describePopulationTrend, sparklinePoints } from '../utils/populationHistory';
import { GraphicsNotice } from './GraphicsNotice';
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
  const activeTool = useUIStore((state) => state.activeTool);
  const setActiveTool = useUIStore((state) => state.setActiveTool);
  const probe = useUIStore((state) => state.probe);
  const setProbe = useUIStore((state) => state.setProbe);
  const populationHistory = useUIStore((state) => state.populationHistory);

  const worldPreset = useControlsStore((state) => state.worldPreset);
  const gpuSim = useControlsStore((state) => state.gpuSim);
  const gameMode = useControlsStore((state) => state.gameMode);
  const colonyColorA = useControlsStore((state) => state.colonyColorA);
  const colonyColorB = useControlsStore((state) => state.colonyColorB);
  const ecologyProfile = useControlsStore((state) => state.ecologyProfile);
  const seedPattern = useControlsStore((state) => state.seedPattern);

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

        <GraphicsNotice />

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
              type="button"
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
            <div className="hud-kicker">{worldPreset}</div>
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
          {gameMode === 'Colony' && (
            <div className="hud-colony" aria-label="Colony population breakdown">
              <div className="hud-colony-counts">
                <span className="hud-colony-tag">
                  <span className="hud-colony-swatch" style={{ backgroundColor: colonyColorA }} />A{' '}
                  <strong>{stats.colonyAPopulation ?? 0}</strong>
                </span>
                <span className="hud-colony-tag">
                  <span className="hud-colony-swatch" style={{ backgroundColor: colonyColorB }} />B{' '}
                  <strong>{stats.colonyBPopulation ?? 0}</strong>
                </span>
              </div>
              {stats.population > 0 && (
                <div className="hud-colony-bar" aria-hidden="true">
                  <div
                    className="hud-colony-bar-a"
                    style={{
                      width: `${Math.round(((stats.colonyAPopulation ?? 0) / stats.population) * 100)}%`,
                      backgroundColor: colonyColorA,
                    }}
                  />
                  <div
                    className="hud-colony-bar-b"
                    style={{
                      width: `${Math.round(((stats.colonyBPopulation ?? 0) / stats.population) * 100)}%`,
                      backgroundColor: colonyColorB,
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {populationHistory.length >= 2 && (
            <svg
              className="hud-sparkline"
              viewBox="0 0 200 32"
              preserveAspectRatio="none"
              role="img"
              aria-label={describePopulationTrend(populationHistory)}
            >
              <line x1="0" y1="31" x2="200" y2="31" className="hud-sparkline-base" />
              <polyline points={sparklinePoints(populationHistory, 200, 32)} />
            </svg>
          )}
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
            <span className="hud-label">Engine</span>
            <span className="hud-value">{gpuSim ? 'GPU' : 'CPU'}</span>
          </div>
          <div className="hud-row hud-detail">
            <span className="hud-label">Mode</span>
            <span className="hud-value">{gameMode}</span>
          </div>
          <div className="hud-row hud-detail">
            <span className="hud-label">Biome</span>
            <span className="hud-value">{ecologyProfile}</span>
          </div>
          <div className="hud-row hud-detail">
            <span className="hud-label">Seed</span>
            <span className="hud-value">{seedPattern}</span>
          </div>
        </section>

        {probe && (
          <section className="probe-card" aria-label="Impact probe">
            <div className="probe-header">
              <div className="hud-kicker">{probe.sample.biome}</div>
              <button
                type="button"
                className="probe-dismiss-btn"
                onClick={() => setProbe(undefined)}
                aria-label="Dismiss probe"
              >
                ✕
              </button>
            </div>
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
