import { button, useControls } from 'leva';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { gpuOverlayFragmentShader } from '../shaders/gpuOverlay.frag';
import { gpuOverlayVertexShader } from '../shaders/gpuOverlay.vert';
import { SIM_CONSTRAINTS, SIM_DEFAULTS } from '../sim/constants';
import { parseRuleDigits } from '../sim/rules';
import { GPUSimulation } from './GPUSimulation';
import { ImpactRing } from './ImpactRing';
import { Meteor } from './Meteor';
import { useCellColorResolver } from './planetLife/cellColor';
import { usePlanetLifeControls } from './planetLife/controls';
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
    gpuSim,
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

  // GPU simulation state
  const [gpuTexture, setGpuTexture] = useState<THREE.Texture | null>(null);
  const gpuResolution = useMemo(() => {
    // Use higher resolution for GPU mode
    return gpuSim ? Math.max(safeLonCells, 512) : safeLonCells;
  }, [gpuSim, safeLonCells]);

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

  // GPU overlay material with color support
  const gpuOverlayMaterial = useMemo(() => {
    const colorModeValue = cellColorMode === 'Solid' ? 0 : cellColorMode === 'Age Fade' ? 1 : 2;
    
    return new THREE.ShaderMaterial({
      uniforms: {
        uLifeTexture: { value: null },
        uCellColor: { value: new THREE.Color(cellColor) },
        uColonyColorA: { value: new THREE.Color(colonyColorA) },
        uColonyColorB: { value: new THREE.Color(colonyColorB) },
        uHeatLowColor: { value: new THREE.Color(heatLowColor) },
        uHeatMidColor: { value: new THREE.Color(heatMidColor) },
        uHeatHighColor: { value: new THREE.Color(heatHighColor) },
        uAgeFadeHalfLife: { value: Math.max(1, ageFadeHalfLife) },
        uColorMode: { value: colorModeValue },
        uColonyMode: { value: gameMode === 'Colony' },
      },
      vertexShader: gpuOverlayVertexShader,
      fragmentShader: gpuOverlayFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  }, [
    cellColorMode,
    cellColor,
    colonyColorA,
    colonyColorB,
    heatLowColor,
    heatMidColor,
    heatHighColor,
    ageFadeHalfLife,
    gameMode,
  ]);

  // Update GPU overlay material when texture changes
  useMemo(() => {
    if (gpuTexture && gpuOverlayMaterial) {
      // eslint-disable-next-line react-hooks/immutability
      gpuOverlayMaterial.uniforms.uLifeTexture.value = gpuTexture;
    }
  }, [gpuTexture, gpuOverlayMaterial]);

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
    running,
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

  // Actions folder (buttons)
  useControls(
    'Actions',
    () => ({
      Randomize: button(() => randomize()),
      Clear: button(() => clear()),
      StepOnce: button(() => stepOnce()),
    }),
    [randomize, clear, stepOnce],
  );

  return (
    <group>
      {/* GPU Simulation (invisible component that manages compute shaders) */}
      {gpuSim && (
        <GPUSimulation
          resolution={gpuResolution}
          running={running}
          tickMs={tickMs}
          rules={rules}
          randomDensity={randomDensity}
          gameMode={gameMode}
          onTextureUpdate={setGpuTexture}
        />
      )}

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
      {(cellRenderMode === 'Texture' || cellRenderMode === 'Both') && !gpuSim && (
        <mesh scale={1.01} raycast={() => null}>
          <sphereGeometry args={[planetRadius, 64, 64]} />
          <meshBasicMaterial
            map={lifeTex.tex}
            transparent
            opacity={cellOverlayOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* GPU Life overlay */}
      {(cellRenderMode === 'Texture' || cellRenderMode === 'Both') && gpuSim && gpuTexture && (
        <mesh scale={1.01} raycast={() => null}>
          <sphereGeometry args={[planetRadius, 64, 64]} />
          <primitive object={gpuOverlayMaterial} attach="material" />
        </mesh>
      )}

      {/* Alive cells as an instanced mesh (only alive instances are rendered) */}
      {/* Note: Dots mode disabled in GPU mode as it requires reading GPU texture back to CPU */}
      {(cellRenderMode === 'Dots' || cellRenderMode === 'Both') && !gpuSim && (
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
