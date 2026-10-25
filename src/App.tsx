import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { CanvasErrorBoundary } from './components/CanvasErrorBoundary';
import { SpaceEnvironment } from './components/environment';
import { GraphicsRecovery } from './components/GraphicsRecovery';
import { Overlay } from './components/Overlay';
import { DEFAULT_ADAPTIVE_RESOLUTION_CONFIG } from './components/performance/adaptiveResolution';
import { DynamicResScaler } from './components/performance/DynamicResScaler';
import { RenderDemandDriver } from './components/performance/RenderDemandDriver';
import { PlanetLife } from './components/PlanetLife';
import { BLOOM_MAX_DPR } from './components/postprocessing/bloomSettings';
import { SelectiveBloom } from './components/postprocessing/SelectiveBloom';
import { useHotkeys } from './hooks/useHotkeys';
import { useControlsStore } from './store/useControlsStore';

const LevaPanel = lazy(() => import('./components/LevaPanel'));

/** Load the Leva panel once the browser is idle after first paint. */
function useDeferredLeva(): [boolean, () => void] {
  const [wanted, setWanted] = useState(false);
  const want = useCallback(() => setWanted(true), []);
  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(want, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(want, 1);
    return () => window.clearTimeout(id);
  }, [want]);
  return [wanted, want];
}

const LIGHT_POSITION: [number, number, number] = [6, 6, 8];

export default function App() {
  const [levaHidden, setLevaHidden] = useState(false);
  const [levaWanted, loadLeva] = useDeferredLeva();
  const toggleLeva = useCallback(() => {
    loadLeva();
    setLevaHidden((v) => !v);
  }, [loadLeva]);
  useHotkeys({ onToggleUI: toggleLeva });

  const autoRotate = useControlsStore((s) => s.autoRotate);
  const autoRotateSpeed = useControlsStore((s) => s.autoRotateSpeed);
  const adaptiveResolution = useControlsStore((s) => s.adaptiveResolution);
  const bloomEnabled = useControlsStore((s) => s.bloomEnabled);
  const bloomIntensity = useControlsStore((s) => s.bloomIntensity);
  const bloomThreshold = useControlsStore((s) => s.bloomThreshold);
  const bloomRadius = useControlsStore((s) => s.bloomRadius);

  // Bloom lowers the pixel-ratio ceiling for both the Canvas and the adaptive
  // scaler, so the scaler never tries to climb back to a ratio bloom cannot hold.
  const maxDpr = bloomEnabled ? BLOOM_MAX_DPR : DEFAULT_ADAPTIVE_RESOLUTION_CONFIG.maxDpr;
  const scalerConfig = useMemo(() => ({ ...DEFAULT_ADAPTIVE_RESOLUTION_CONFIG, maxDpr }), [maxDpr]);

  return (
    <>
      <Overlay />
      {levaWanted && (
        <Suspense fallback={null}>
          <LevaPanel hidden={levaHidden} />
        </Suspense>
      )}
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
