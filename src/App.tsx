import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { folder, Leva, useControls } from 'leva';
import { useCallback, useMemo, useState } from 'react';

import { CanvasErrorBoundary } from './components/CanvasErrorBoundary';
import { SpaceEnvironment } from './components/environment';
import { GraphicsRecovery } from './components/GraphicsRecovery';
import { Overlay } from './components/Overlay';
import { DEFAULT_ADAPTIVE_RESOLUTION_CONFIG } from './components/performance/adaptiveResolution';
import { DynamicResScaler } from './components/performance/DynamicResScaler';
import { RenderDemandDriver } from './components/performance/RenderDemandDriver';
import { PlanetLife } from './components/PlanetLife';
import {
  BLOOM_MAX_DPR,
  DEFAULT_BLOOM_SETTINGS,
  defaultBloomEnabled,
} from './components/postprocessing/bloomSettings';
import { SelectiveBloom } from './components/postprocessing/SelectiveBloom';
import { useHotkeys } from './hooks/useHotkeys';
import { prefersReducedMotion } from './utils/reducedMotion';

const levaTheme = {
  colors: {
    elevation1: 'rgba(13, 17, 28, 0.8)',
    elevation2: '#1a1f2e',
    elevation3: '#2d3345',
    accent1: '#6366f1',
    accent2: '#818cf8',
    accent3: '#a5b4fc',
    highlight1: '#94a3b8',
    highlight2: '#cbd5e1',
    highlight3: '#f8fafc',
  },
  fonts: {
    mono: "'Rajdhani', monospace",
    sans: "'Rajdhani', sans-serif",
  },
  sizes: {
    rootWidth: '340px',
  },
};

const LIGHT_POSITION: [number, number, number] = [6, 6, 8];

export default function App() {
  const [levaHidden, setLevaHidden] = useState(false);
  const toggleLeva = useCallback(() => setLevaHidden((v) => !v), []);
  useHotkeys({ onToggleUI: toggleLeva });

  const { autoRotate, autoRotateSpeed } = useControls({
    Camera: folder(
      {
        autoRotate: { value: !prefersReducedMotion(), label: 'Auto Rotate' },
        autoRotateSpeed: { value: 0.5, min: 0.1, max: 10, step: 0.1, label: 'Rotation Speed' },
      },
      { collapsed: true },
    ),
  });

  const { adaptiveResolution } = useControls({
    Performance: folder(
      {
        adaptiveResolution: {
          value: true,
          label: 'Adaptive Resolution',
          // Disabling pins the renderer to the Canvas `dpr` range, which makes
          // it straightforward to A/B the two settings.
          hint: 'Drops pixel ratio when frame rate drops; restore when it recovers.',
        },
      },
      { collapsed: true },
    ),
  });

  const { bloomEnabled, bloomIntensity, bloomThreshold, bloomRadius } = useControls({
    Rendering: folder(
      {
        bloomEnabled: {
          value: defaultBloomEnabled(),
          label: 'Bloom',
          hint: 'Glow on the sun, meteors, impacts and atmosphere. Off by default on touch devices; pauses while adaptive resolution has lowered the pixel ratio.',
        },
        bloomIntensity: {
          value: DEFAULT_BLOOM_SETTINGS.intensity,
          min: 0,
          max: 3,
          step: 0.05,
          label: 'Bloom Intensity',
        },
        bloomThreshold: {
          value: DEFAULT_BLOOM_SETTINGS.threshold,
          min: 0.5,
          max: 3,
          step: 0.05,
          label: 'Bloom Threshold',
        },
        bloomRadius: {
          value: DEFAULT_BLOOM_SETTINGS.radius,
          min: 0,
          max: 1,
          step: 0.05,
          label: 'Bloom Radius',
        },
      },
      { collapsed: true },
    ),
  });

  // Bloom lowers the pixel-ratio ceiling for both the Canvas and the adaptive
  // scaler, so the scaler never tries to climb back to a ratio bloom cannot hold.
  const maxDpr = bloomEnabled ? BLOOM_MAX_DPR : DEFAULT_ADAPTIVE_RESOLUTION_CONFIG.maxDpr;
  const scalerConfig = useMemo(() => ({ ...DEFAULT_ADAPTIVE_RESOLUTION_CONFIG, maxDpr }), [maxDpr]);

  return (
    <>
      <Overlay />
      <Leva collapsed={true} theme={levaTheme} hidden={levaHidden} />
      <CanvasErrorBoundary>
        <Canvas
          frameloop="demand"
          camera={{ position: [-1, -4, -12], fov: 50, near: 0.1, far: 200 }}
          dpr={[1, maxDpr]}
        >
          <color attach="background" args={['#05060a']} />
          <ambientLight intensity={0.75} />
          <directionalLight position={LIGHT_POSITION} intensity={1.2} />
          <SpaceEnvironment lightPosition={LIGHT_POSITION} />

          <GraphicsRecovery />
          <RenderDemandDriver autoRotate={autoRotate} />
          <DynamicResScaler enabled={adaptiveResolution} config={scalerConfig} />
          <SelectiveBloom
            enabled={bloomEnabled}
            intensity={bloomIntensity}
            threshold={bloomThreshold}
            radius={bloomRadius}
          />

          <PlanetLife lightPosition={LIGHT_POSITION} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
          />
        </Canvas>
      </CanvasErrorBoundary>
    </>
  );
}
