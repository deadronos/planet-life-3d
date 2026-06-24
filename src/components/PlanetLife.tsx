import { button, useControls } from 'leva';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { SIM_CONSTRAINTS, SIM_DEFAULTS } from '../sim/constants';
import { computeEcologySample } from '../sim/ecology';
import {
  getBuiltinPatternOffsets,
  offsetsToMatrix,
  parseAsciiPattern,
  transformOffsets,
} from '../sim/patterns';
import { parseRuleDigits } from '../sim/rules';
import { spherePointToCell } from '../sim/spherePointToCell';
import type { SeedMode } from '../sim/types';
import { buildRandomDiskOffsets } from '../sim/utils';
import { type MeteorTool, useUIStore } from '../store/useUIStore';
import { GPUSimulation, type GPUSimulationHandle } from './GPUSimulation';
import { Atmosphere } from './planetLife/Atmosphere';
import { useCellColorResolver } from './planetLife/cellColor';
import { CellsInstancedMesh } from './planetLife/CellsInstancedMesh';
import { usePlanetLifeControls } from './planetLife/controls';
import { createGpuOverlayMaterial, LifeOverlay } from './planetLife/LifeOverlay';
import { useLifeTexture } from './planetLife/lifeTexture';
import { MeteorEffects } from './planetLife/MeteorEffects';
import { usePlanetMaterial } from './planetLife/planetMaterial';
import { PlanetMesh } from './planetLife/PlanetMesh';
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
    worldPreset,
    birthDigits,
    surviveDigits,
    ecologyProfile,
    gameMode,
    randomDensity,

    planetRadius,
    planetWireframe,
    planetRoughness,
    ecologyIntensity,
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
  const activeTool = useUIStore((state) => state.activeTool);
  const setPlanetStatus = useUIStore((state) => state.setPlanetStatus);
  const setProbe = useUIStore((state) => state.setProbe);

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
    ecologyIntensity,
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
    ecologyProfile,
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

  useEffect(() => {
    setPlanetStatus({
      preset: worldPreset,
      ecologyProfile,
      gameMode,
      seedPattern,
      gpuSim,
    });
  }, [ecologyProfile, gameMode, gpuSim, seedPattern, setPlanetStatus, worldPreset]);

  const buildToolSeed = useMemo(() => {
    return (tool: MeteorTool) => {
      if (tool === 'Probe') return undefined;

      const toolScale =
        tool === 'Sterilizer' ? Math.max(3, seedScale + 2) : tool === 'Mutation' ? 3 : seedScale;
      const toolPattern =
        tool === 'Sterilizer' || tool === 'Mutation' || tool === 'Comet'
          ? 'Random Disk'
          : seedPattern;
      const toolMode: SeedMode =
        tool === 'Sterilizer'
          ? 'clear'
          : tool === 'Mutation'
            ? 'random'
            : tool === 'Comet'
              ? 'set'
              : seedMode;
      const toolProbability =
        tool === 'Sterilizer'
          ? 1
          : tool === 'Mutation'
            ? 0.55
            : tool === 'Comet'
              ? 0.95
              : seedProbability;

      let offsets =
        toolPattern === 'Random Disk'
          ? buildRandomDiskOffsets(toolScale)
          : toolPattern === 'Custom ASCII'
            ? parseAsciiPattern(customPattern)
            : getBuiltinPatternOffsets(toolPattern);

      if (offsets.length === 0) return undefined;
      offsets = transformOffsets(
        offsets,
        toolScale,
        tool === 'Mutation' ? Math.max(1, seedJitter) : seedJitter,
      );

      return {
        offsets,
        mode: toolMode,
        scale: toolScale,
        jitter: tool === 'Mutation' ? Math.max(1, seedJitter) : seedJitter,
        probability: toolProbability,
      };
    };
  }, [customPattern, seedJitter, seedMode, seedPattern, seedProbability, seedScale]);

  const seedAtPoint = useMemo(() => {
    return (point: THREE.Vector3) => {
      const { lat, lon } = spherePointToCell(point, safeLatCells, safeLonCells);
      const sample = computeEcologySample({
        lat,
        lon,
        latCells: safeLatCells,
        lonCells: safeLonCells,
        profile: ecologyProfile,
      });
      setProbe({ lat, lon, sample });

      if (activeTool === 'Probe') return;

      if (activeTool !== 'Life') {
        const toolSeed = buildToolSeed(activeTool);
        if (!toolSeed) return;

        if (gpuSim && gpuSimRef.current) {
          const v = (lat + 0.5) / safeLatCells;
          const u = (lon + 0.5) / safeLonCells;
          const { matrix, originRow, originCol } = offsetsToMatrix(toolSeed.offsets);
          gpuSimRef.current.seedAtUV({
            u,
            v,
            pattern: matrix,
            mode: toolSeed.mode,
            probability: toolSeed.probability,
            originRow,
            originCol,
          });
        } else {
          seedAtPointImpl({
            point,
            offsets: toolSeed.offsets,
            mode: toolSeed.mode,
            scale: toolSeed.scale,
            jitter: toolSeed.jitter,
            probability: toolSeed.probability,
            debug: debugLogs,
          });
        }
        return;
      }

      if (gpuSim && gpuSimRef.current) {
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
    activeTool,
    buildToolSeed,
    debugLogs,
    ecologyProfile,
    safeLatCells,
    safeLonCells,
    seedPattern,
    seedScale,
    seedJitter,
    seedMode,
    customPattern,
    seedProbability,
    seedAtPointCPU,
    seedAtPointImpl,
    setProbe,
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

  // GPU sim is the default. If it ever fails to produce a texture (WebGL2
  // unsupported, shader compile error, context lost mid-session, etc.) we
  // fall through to the CPU/Worker sim's texture instead of rendering a
  // blank planet. This is purely a safety net — the normal path is
  // gpuTexture, which is updated every tick by <GPUSimulation>.
  const texture = gpuSim ? (gpuTexture ?? lifeTex.tex) : lifeTex.tex;

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

      {/* Dots rendering requires a CPU/Worker sim to read cell state from.
          When GPU sim is on we already force cellRenderMode to 'Texture' in
          the Leva controls, so the Dots branch should only run in
          non-GPU mode. The explicit `!gpuSim` guard is kept as a safety
          net so a future control-surface change can't silently hide the
          cells. */}
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
