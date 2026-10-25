import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { SIM_CONSTRAINTS, SIM_DEFAULTS } from '../sim/constants';
import { computeEcologySample } from '../sim/ecology';
import { parseRuleDigits } from '../sim/rules';
import { spherePointToCell } from '../sim/spherePointToCell';
import { useUIStore } from '../store/useUIStore';
import { GPUSimulation, type GPUSimulationHandle } from './GPUSimulation';
import { applySeed } from './planetLife/applySeed';
import { Atmosphere } from './planetLife/Atmosphere';
import { useCellColorResolver } from './planetLife/cellColor';
import { CellsInstancedMesh } from './planetLife/CellsInstancedMesh';
import { usePlanetLifeControls } from './planetLife/controls';
import { createGpuOverlayMaterial, LifeOverlay } from './planetLife/LifeOverlay';
import { useLifeTexture } from './planetLife/lifeTexture';
import { MeteorEffects } from './planetLife/MeteorEffects';
import { usePlanetMaterial } from './planetLife/planetMaterial';
import { PlanetMesh } from './planetLife/PlanetMesh';
import { usePlanetNoiseTexture } from './planetLife/planetNoiseTexture';
import { resolveSeedRequest } from './planetLife/seedRequest';
import { useMeteorSystem } from './planetLife/useMeteorSystem';
import { usePlanetLifeSim } from './planetLife/usePlanetLifeSim';
import { safeInt } from './planetLife/utils';

export function PlanetLife({
  lightPosition = [6, 6, 8],
}: {
  lightPosition?: [number, number, number];
}) {
  const {
    sim,
    planet,
    atmosphere,
    cells,
    meteors: meteorControls,
    impacts: impactControls,
    seeding,
    debug,
  } = usePlanetLifeControls();

  const { running, tickMs, latCells, lonCells, worldPreset, birthDigits, surviveDigits } = sim;
  const { ecologyProfile, gameMode, randomDensity } = sim;
  const {
    planetRadius,
    planetWireframe,
    planetRoughness,
    ecologyIntensity,
    rimIntensity,
    rimPower,
    terminatorSharpness,
    terminatorBoost,
  } = planet;
  const { atmosphereColor, atmosphereIntensity, atmosphereHeight } = atmosphere;
  const {
    cellRenderMode,
    cellOverlayOpacity,
    cellRadius,
    cellLift,
    pulseSpeed,
    pulseIntensity,
    nightGlowIntensity,
    nightGlowColor,
    cellColor,
    cellColorMode,
    colonyColorA,
    colonyColorB,
    ageFadeHalfLife,
    heatLowColor,
    heatMidColor,
    heatHighColor,
  } = cells;
  const { seedPattern } = seeding;
  const { debugLogs, gpuSim } = debug;
  const activeTool = useUIStore((state) => state.activeTool);
  const setPlanetStatus = useUIStore((state) => state.setPlanetStatus);
  const setProbe = useUIStore((state) => state.setProbe);
  const graphicsEpoch = useUIStore((state) => state.graphicsEpoch);
  const graphicsOk = useUIStore((state) => state.graphicsStatus === 'ok');

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
  const [gpuTexture, setGpuTexture] = useState<{ tex: THREE.Texture; epoch: number } | null>(null);
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
        nightGlowIntensity,
        nightGlowColor,
        lightPosition,
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
      nightGlowIntensity,
      nightGlowColor,
      lightPosition,
    ],
  );

  useEffect(() => {
    return () => gpuOverlayMaterial.dispose();
  }, [gpuOverlayMaterial]);

  const planetNoiseTexture = usePlanetNoiseTexture(planetRadius);
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
    noiseTexture: planetNoiseTexture,
  });

  const {
    updateInstances,
    clear,
    randomize,
    stepOnce,
    seedAtPoint: seedAtPointImpl,
  } = usePlanetLifeSim({
    sim,
    planet,
    cells,
    debug,
    safeLatCells,
    safeLonCells,
    rules,
    lifeTex,
    cellsRef,
    resolveCellColor,
    colorScratch,
  });

  const publishStats = useCallback(
    (stats: {
      generation: number;
      population: number;
      birthsLastTick: number;
      deathsLastTick: number;
    }) => {
      useUIStore.getState().setStats(stats);
    },
    [],
  );

  useEffect(() => {
    setPlanetStatus({
      preset: worldPreset,
      ecologyProfile,
      gameMode,
      seedPattern,
      gpuSim,
    });
  }, [ecologyProfile, gameMode, gpuSim, seedPattern, setPlanetStatus, worldPreset]);

  const seedAtPoint = useCallback(
    (point: THREE.Vector3, { updateProbe }: { updateProbe: boolean }) => {
      const { lat, lon } = spherePointToCell(point, safeLatCells, safeLonCells);
      if (updateProbe) {
        const sample = computeEcologySample({
          lat,
          lon,
          latCells: safeLatCells,
          lonCells: safeLonCells,
          profile: ecologyProfile,
        });
        setProbe({ lat, lon, sample });
      }

      const request = resolveSeedRequest({ tool: activeTool, seeding });
      if (!request) return;

      applySeed(request, {
        point,
        lat,
        lon,
        latCells: safeLatCells,
        lonCells: safeLonCells,
        gpu: gpuSim ? gpuSimRef.current : null,
        cpu: (params) => {
          seedAtPointImpl({ ...params, debug: debugLogs });
          // Life refreshes the instanced mesh after a CPU seed; meteor tools do not.
          if (activeTool === 'Life') updateInstances();
        },
      });
    },
    [
      activeTool,
      debugLogs,
      ecologyProfile,
      gpuSim,
      safeLatCells,
      safeLonCells,
      seeding,
      seedAtPointImpl,
      setProbe,
      updateInstances,
    ],
  );

  const { meteors, impacts, onPlanetPointerDown, onMeteorImpact } = useMeteorSystem({
    meteors: meteorControls,
    impacts: impactControls,
    seedAtPoint,
    debugLogs,
  });

  const activeEffectCount = meteors.length + impacts.length;
  useEffect(() => {
    useUIStore.getState().setActiveEffectCount(activeEffectCount);
  }, [activeEffectCount]);

  const runRandomize = useCallback(() => {
    if (gpuSim && gpuSimRef.current) {
      gpuSimRef.current.randomize();
    } else {
      randomize();
    }
  }, [gpuSim, randomize]);

  const runClear = useCallback(() => {
    if (gpuSim && gpuSimRef.current) {
      gpuSimRef.current.clear();
    } else {
      clear();
    }
  }, [gpuSim, clear]);

  const runStepOnce = useCallback(() => {
    if (gpuSim && gpuSimRef.current) {
      gpuSimRef.current.stepOnce();
    } else {
      stepOnce();
    }
  }, [gpuSim, stepOnce]);

  // Hotkey and Leva Actions commands (see useHotkeys, LevaPanel). togglePlay is
  // handled in controls.ts, which owns the `running` value.
  useEffect(
    () =>
      useUIStore.subscribe((state, prev) => {
        const request = state.simCommand;
        if (!request || request === prev.simCommand) return;
        switch (request.command) {
          case 'randomize':
            runRandomize();
            break;
          case 'clear':
            runClear();
            break;
          case 'step':
            runStepOnce();
            break;
          case 'togglePlay':
            break;
        }
      }),
    [runRandomize, runClear, runStepOnce],
  );

  // GPU sim is the default. If it ever fails to produce a texture (WebGL2
  // unsupported, shader compile error, context lost mid-session, etc.) we
  // fall through to the CPU/Worker sim's texture instead of rendering a
  // blank planet. This is purely a safety net — the normal path is
  // gpuTexture, which is updated every tick by <GPUSimulation>.
  // The stale texture belongs to the lost context; ignore it until the remounted
  // GPUSimulation publishes a fresh one.
  const onGpuTexture = useCallback(
    (tex: THREE.Texture) => setGpuTexture({ tex, epoch: graphicsEpoch }),
    [graphicsEpoch],
  );
  const freshGpuTexture = gpuTexture?.epoch === graphicsEpoch ? gpuTexture.tex : null;
  const texture = gpuSim ? (freshGpuTexture ?? lifeTex.tex) : lifeTex.tex;

  return (
    <group>
      {gpuSim && (
        <GPUSimulation
          key={graphicsEpoch}
          resolution={gpuResolution}
          running={running && graphicsOk}
          tickMs={tickMs}
          rules={rules}
          randomDensity={randomDensity}
          gameMode={gameMode}
          ecologyProfile={ecologyProfile}
          onTextureUpdate={onGpuTexture}
          onStats={publishStats}
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
