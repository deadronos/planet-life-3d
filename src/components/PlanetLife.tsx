import { button, useControls } from 'leva';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { SIM_CONSTRAINTS, SIM_DEFAULTS } from '../sim/constants';
import {
  getBuiltinPatternOffsets,
  offsetsToMatrix,
  parseAsciiPattern,
  transformOffsets,
} from '../sim/patterns';
import { parseRuleDigits } from '../sim/rules';
import { spherePointToCell } from '../sim/spherePointToCell';
import { buildRandomDiskOffsets } from '../sim/utils';
import { GPUSimulation, type GPUSimulationHandle } from './GPUSimulation';
import { Atmosphere } from './planetLife/Atmosphere';
import { useCellColorResolver } from './planetLife/cellColor';
import { CellsInstancedMesh } from './planetLife/CellsInstancedMesh';
import { usePlanetLifeControls } from './planetLife/controls';
import { createGpuOverlayMaterial, LifeOverlay } from './planetLife/LifeOverlay';
import { useLifeTexture } from './planetLife/lifeTexture';
import { MeteorEffects } from './planetLife/MeteorEffects';
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
    pulseSpeed,
    pulseIntensity,
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

  const gpuSimRef = useRef<GPUSimulationHandle>(null);
  const [gpuTexture, setGpuTexture] = useState<THREE.Texture | null>(null);
  const gpuResolution = useMemo(
    () => ({
      width: safeLonCells,
      height: safeLatCells,
    }),
    [safeLatCells, safeLonCells],
  );

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

  const gpuOverlayMaterial = useMemo(
    () =>
      createGpuOverlayMaterial({
        cellColor,
        cellColorMode,
        colonyColorA,
        colonyColorB,
        heatLowColor,
        heatMidColor,
        heatHighColor,
        ageFadeHalfLife,
        cellOverlayOpacity,
        gameMode,
      }),
    [
      cellColorMode,
      cellColor,
      colonyColorA,
      colonyColorB,
      heatLowColor,
      heatMidColor,
      heatHighColor,
      ageFadeHalfLife,
      cellOverlayOpacity,
      gameMode,
    ],
  );

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

  const { seedAtPoint: seedAtPointCPU } = useSimulationSeeder({
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

  const seedAtPoint = useMemo(() => {
    return (point: THREE.Vector3) => {
      if (gpuSim && gpuSimRef.current) {
        const { lat, lon } = spherePointToCell(point, safeLatCells, safeLonCells);
        const v = (lat + 0.5) / safeLatCells;
        const u = (lon + 0.5) / safeLonCells;

        let offsets =
          seedPattern === 'Random Disk'
            ? buildRandomDiskOffsets(seedScale)
            : seedPattern === 'Custom ASCII'
              ? parseAsciiPattern(customPattern)
              : getBuiltinPatternOffsets(seedPattern);

        if (offsets.length === 0) return;

        offsets = transformOffsets(offsets, seedScale, seedJitter);

        const { matrix, originRow, originCol } = offsetsToMatrix(offsets);

        gpuSimRef.current.seedAtUV({
          u,
          v,
          pattern: matrix,
          mode: seedMode,
          probability: seedProbability,
          originRow,
          originCol,
        });
      } else {
        seedAtPointCPU(point);
      }
    };
  }, [
    gpuSim,
    safeLatCells,
    safeLonCells,
    seedPattern,
    seedScale,
    seedJitter,
    seedMode,
    customPattern,
    seedProbability,
    seedAtPointCPU,
  ]);

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

  useControls(
    'Actions',
    () => ({
      Randomize: button(() => {
        if (gpuSim && gpuSimRef.current) {
          gpuSimRef.current.randomize();
        } else {
          randomize();
        }
      }),
      Clear: button(() => {
        if (gpuSim && gpuSimRef.current) {
          gpuSimRef.current.clear();
        } else {
          clear();
        }
      }),
      StepOnce: button(() => {
        if (gpuSim && gpuSimRef.current) {
          gpuSimRef.current.stepOnce();
        } else {
          stepOnce();
        }
      }),
    }),
    [gpuSim, randomize, clear, stepOnce],
  );

  const texture = gpuSim ? gpuTexture : lifeTex.tex;

  return (
    <group>
      {gpuSim && (
        <GPUSimulation
          resolution={gpuResolution}
          running={running}
          tickMs={tickMs}
          rules={rules}
          randomDensity={randomDensity}
          gameMode={gameMode}
          onTextureUpdate={setGpuTexture}
          simRef={gpuSimRef}
        />
      )}

      <PlanetMesh
        planetRadius={planetRadius}
        material={planetMaterial}
        onPointerDown={onPlanetPointerDown}
      />

      <Atmosphere
        planetRadius={planetRadius}
        atmosphereColor={atmosphereColor}
        atmosphereIntensity={atmosphereIntensity}
        atmosphereHeight={atmosphereHeight}
      />

      {(cellRenderMode === 'Texture' || cellRenderMode === 'Both') && (
        <LifeOverlay
          planetRadius={planetRadius}
          cellLift={cellLift}
          pulseSpeed={pulseSpeed}
          pulseIntensity={pulseIntensity}
          cellOverlayOpacity={cellOverlayOpacity}
          lifeTexture={texture}
          gpuOverlayMaterial={gpuOverlayMaterial}
          debugLogs={debugLogs}
        />
      )}

      {(cellRenderMode === 'Dots' || cellRenderMode === 'Both') && !gpuSim && (
        <CellsInstancedMesh
          cellsRef={cellsRef}
          maxInstances={maxInstances}
          cellRadius={cellRadius}
          cellColor={cellColor}
        />
      )}

      <MeteorEffects
        meteors={meteors}
        impacts={impacts}
        planetRadius={planetRadius}
        onMeteorImpact={onMeteorImpact}
      />
    </group>
  );
}

import { PlanetMesh } from './planetLife/PlanetMesh';
