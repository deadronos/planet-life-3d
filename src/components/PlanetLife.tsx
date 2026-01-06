import { button, useControls } from 'leva';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { SIM_CONSTRAINTS, SIM_DEFAULTS } from '../sim/constants';
import { parseRuleDigits } from '../sim/rules';
import { ImpactRing } from './ImpactRing';
import { Meteor } from './Meteor';
import { useCellColorResolver } from './planetLife/cellColor';
import { usePlanetLifeControls } from './planetLife/controls';
import { GpuSimulation } from './planetLife/gpu/GpuSimulation';
import { useLifeTexture } from './planetLife/lifeTexture';
import { usePlanetMaterial } from './planetLife/planetMaterial';
import { useMeteorSystem } from './planetLife/useMeteorSystem';
import { usePlanetLifeSim } from './planetLife/usePlanetLifeSim';
import { useSimulationSeeder } from './planetLife/useSimulationSeeder';
import { safeInt } from './planetLife/utils';

export function PlanetLife({
  lightPosition = [6, 6, 8],
}: {
  lightPosition?: [number, number, number];
}) {
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const params = usePlanetLifeControls();

  const {
    running,
    tickMs,
    latCells,
    lonCells,
    birthDigits,
    surviveDigits,
    gameMode,
    randomDensity,

    planetRadius,
    planetWireframe,
    planetRoughness,
    rimIntensity,
    rimPower,
    terminatorSharpness,
    terminatorBoost,
    atmosphereColor,
    atmosphereIntensity,
    atmosphereHeight,

    cellRenderMode,
    cellOverlayOpacity,

    cellRadius,
    cellLift,
    cellColor,
    cellColorMode,
    colonyColorA,
    colonyColorB,
    ageFadeHalfLife,
    heatLowColor,
    heatMidColor,
    heatHighColor,

    meteorSpeed,
    meteorRadius,
    meteorCooldownMs,
    showerEnabled,
    showerInterval,
    meteorTrailLength,
    meteorTrailWidth,
    meteorEmissive,
    impactFlashIntensity,
    impactFlashRadius,
    impactRingColor,
    impactRingDuration,
    impactRingSize,

    seedMode,
    seedPattern,
    seedScale,
    seedJitter,
    seedProbability,
    customPattern,

    debugLogs,
    workerSim,
    gpuEnabled,
  } = params;

  const rules = useMemo(() => {
    return {
      birth: parseRuleDigits(birthDigits),
      survive: parseRuleDigits(surviveDigits),
    };
  }, [birthDigits, surviveDigits]);

  const cellsRef = useRef<THREE.InstancedMesh | null>(null);

  const safeLatCells = useMemo(
    () =>
      safeInt(
        latCells,
        SIM_DEFAULTS.latCells,
        SIM_CONSTRAINTS.latCells.min,
        SIM_CONSTRAINTS.latCells.max,
      ),
    [latCells],
  );
  const safeLonCells = useMemo(
    () =>
      safeInt(
        lonCells,
        SIM_DEFAULTS.lonCells,
        SIM_CONSTRAINTS.lonCells.min,
        SIM_CONSTRAINTS.lonCells.max,
      ),
    [lonCells],
  );
  const maxInstances = useMemo(() => safeLatCells * safeLonCells, [safeLatCells, safeLonCells]);

  const lifeTex = useLifeTexture({ lonCells: safeLonCells, latCells: safeLatCells });

  const { resolveCellColor, colorScratch } = useCellColorResolver({
    cellColorMode,
    cellColor,
    ageFadeHalfLife,
    heatLowColor,
    heatMidColor,
    heatHighColor,
    gameMode,
    colonyColorA,
    colonyColorB,
  });

  const planetMaterial = usePlanetMaterial({
    atmosphereColor,
    rimIntensity,
    rimPower,
    terminatorSharpness,
    terminatorBoost,
    planetRoughness,
    planetWireframe,
    latCells: safeLatCells,
    lonCells: safeLonCells,
    lightPosition,
  });

  const {
    updateInstances,
    clear,
    randomize,
    stepOnce,
    seedAtPoint: seedAtPointImpl,
  } = usePlanetLifeSim({
    // Only run CPU sim if GPU is NOT enabled
    running: running && !gpuEnabled,
    tickMs,
    safeLatCells,
    safeLonCells,
    planetRadius,
    cellLift,
    cellRenderMode,
    gameMode,
    rules,
    randomDensity,
    workerSim,
    lifeTex,
    dummy,
    cellsRef,
    resolveCellColor,
    colorScratch,
    debugLogs,
  });

  const { seedAtPoint } = useSimulationSeeder({
    seedAtPointImpl,
    updateInstances,
    seedPattern,
    seedScale,
    seedMode,
    seedJitter,
    seedProbability,
    customPattern,
    debugLogs,
  });

  const { meteors, impacts, onPlanetPointerDown, onMeteorImpact } = useMeteorSystem({
    meteorSpeed,
    meteorRadius,
    meteorCooldownMs,
    showerEnabled,
    showerInterval,
    meteorTrailLength,
    meteorTrailWidth,
    meteorEmissive,
    impactFlashIntensity,
    impactFlashRadius,
    impactRingColor,
    impactRingDuration,
    impactRingSize,
    seedAtPoint,
    debugLogs,
  });

  // --- GPU Simulation Logic ---
  // Ref for the material so GPU sim can update the map directly without re-renders
  const lifeMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  const [gpuRandomizeTrigger, setGpuRandomizeTrigger] = useState(0);
  const [gpuClearTrigger, setGpuClearTrigger] = useState(0);
  const [gpuStepOnceTrigger, setGpuStepOnceTrigger] = useState(0);

  // Actions folder (buttons)
  useControls(
    'Actions',
    () => ({
      Randomize: button(() => {
          if (gpuEnabled) {
              setGpuRandomizeTrigger(t => t + 1);
          } else {
              randomize();
          }
      }),
      Clear: button(() => {
          if (gpuEnabled) {
              setGpuClearTrigger(t => t + 1);
          } else {
              clear();
          }
      }),
      StepOnce: button(() => {
          if (gpuEnabled) {
              setGpuStepOnceTrigger(t => t + 1);
          } else {
              stepOnce();
          }
      }),
    }),
    [randomize, clear, stepOnce, gpuEnabled],
  );

  return (
    <group>
      {/* Planet */}
      <mesh onPointerDown={onPlanetPointerDown}>
        <sphereGeometry args={[planetRadius, 64, 64]} />
        <primitive object={planetMaterial} attach="material" />
      </mesh>

      {/* Atmosphere glow */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[planetRadius * (1 + atmosphereHeight), 64, 64]} />
        <meshBasicMaterial
          color={atmosphereColor}
          transparent
          opacity={Math.max(0, atmosphereIntensity) * 0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Life overlay (equirectangular DataTexture mapped onto the sphere UVs) */}
      {(cellRenderMode === 'Texture' || cellRenderMode === 'Both' || gpuEnabled) && (
        <mesh scale={1.01} raycast={() => null}>
          <sphereGeometry args={[planetRadius, 64, 64]} />
          <meshBasicMaterial
            ref={lifeMaterialRef}
            // If GPU is enabled, we leave map undefined so GpuSimulation can manage it via ref
            map={!gpuEnabled ? lifeTex.tex : undefined}
            color={gpuEnabled ? cellColor : undefined} // Apply color tint for GPU mode (Texture is B/W)
            transparent
            opacity={cellOverlayOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Alive cells as an instanced mesh (only alive instances are rendered) */}
      {(!gpuEnabled && (cellRenderMode === 'Dots' || cellRenderMode === 'Both')) && (
        <instancedMesh
          ref={cellsRef}
          args={[undefined, undefined, maxInstances]}
          frustumCulled={false}
        >
          <sphereGeometry args={[cellRadius, 10, 10]} />
          <meshStandardMaterial
            color={cellColor}
            emissive={cellColor}
            emissiveIntensity={0.7}
            roughness={0.35}
            metalness={0.05}
            vertexColors
          />
        </instancedMesh>
      )}

      {/* GPU Simulation Component (hidden) */}
      {gpuEnabled && (
          <GpuSimulation
              width={safeLonCells}
              height={safeLatCells}
              birthRules={rules.birth}
              surviveRules={rules.survive}
              running={running}
              tickMs={tickMs}
              targetMaterial={lifeMaterialRef}
              randomizeTrigger={gpuRandomizeTrigger}
              clearTrigger={gpuClearTrigger}
              stepOnceTrigger={gpuStepOnceTrigger}
              randomDensity={randomDensity}
          />
      )}

      {/* Meteors */}
      {meteors.map((m) => (
        <Meteor key={m.id} spec={m} planetRadius={planetRadius} onImpact={onMeteorImpact} />
      ))}

      {/* Impact rings */}
      {impacts.map((i) => (
        <ImpactRing key={i.id} spec={i} planetRadius={planetRadius} />
      ))}
    </group>
  );
}
