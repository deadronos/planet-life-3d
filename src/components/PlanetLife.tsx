import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { useDocumentHidden } from '../hooks/useDocumentHidden';
import { SIM_CONSTRAINTS, SIM_DEFAULTS } from '../sim/constants';
import { computeEcologySample } from '../sim/ecology';
import { normalizeDecayStates, parseRuleDigits } from '../sim/rules';
import { spherePointToCell } from '../sim/spherePointToCell';
import { useUIStore } from '../store/useUIStore';
import { detectSimStatus } from '../utils/simStatus';
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
import { useAutoReseed } from './planetLife/useAutoReseed';
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

  const { running, tickMs, latCells, lonCells, birthDigits, surviveDigits, decayStates } = sim;
  const { ecologyProfile, gameMode, randomDensity, polarWrap, autoReseedOnStagnation } = sim;
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
  const { debugLogs, gpuSim } = debug;
  const activeTool = useUIStore((state) => state.activeTool);
  const setProbe = useUIStore((state) => state.setProbe);
  const graphicsEpoch = useUIStore((state) => state.graphicsEpoch);
  const graphicsOk = useUIStore((state) => state.graphicsStatus === 'ok');
  const simStatus = useUIStore((state) => detectSimStatus(state.statsHistory));
  const documentHidden = useDocumentHidden();

  const safeDecayStates = useMemo(() => normalizeDecayStates(decayStates), [decayStates]);

  const rules = useMemo(() => {
    return {
      birth: parseRuleDigits(birthDigits),
      survive: parseRuleDigits(surviveDigits),
      decayStates: safeDecayStates,
    };
  }, [birthDigits, surviveDigits, safeDecayStates]);

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
    decayStates: safeDecayStates,
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
        decayStates: safeDecayStates,
        nightGlowIntensity,
        nightGlowColor,
        lightPosition,
      }),
    // Created once and updated in place below so slider/color changes never recompile the shader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const u = gpuOverlayMaterial.uniforms;
    (u.uCellColor.value as THREE.Color).set(cellColor);
    (u.uColonyColorA.value as THREE.Color).set(colonyColorA);
    (u.uColonyColorB.value as THREE.Color).set(colonyColorB);
    (u.uHeatLowColor.value as THREE.Color).set(heatLowColor);
    (u.uHeatMidColor.value as THREE.Color).set(heatMidColor);
    (u.uHeatHighColor.value as THREE.Color).set(heatHighColor);
    // eslint-disable-next-line react-hooks/immutability -- Uniforms are GPU handles updated in place to avoid shader recompilation.
    u.uAgeFadeHalfLife.value = Math.max(1, ageFadeHalfLife);
    u.uColorMode.value = cellColorMode === 'Solid' ? 0 : cellColorMode === 'Age Fade' ? 1 : 2;
    u.uCellOverlayOpacity.value = cellOverlayOpacity;
    u.uColonyMode.value = gameMode === 'Colony';
    u.uDecayStates.value = safeDecayStates;
    (u.uLightDir.value as THREE.Vector3)
      .set(lightPosition[0], lightPosition[1], lightPosition[2])
      .normalize();
    (u.uNightGlowColor.value as THREE.Color).set(nightGlowColor);
    u.uNightGlowIntensity.value = nightGlowIntensity;
  }, [
    gpuOverlayMaterial,
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
    safeDecayStates,
    nightGlowIntensity,
    nightGlowColor,
    lightPosition,
  ]);

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
      colonyAPopulation?: number;
      colonyBPopulation?: number;
      birthsLastTick: number;
      deathsLastTick: number;
    }) => {
      useUIStore.getState().setStats(stats);
    },
    [],
  );

  const seedAtPoint = useCallback(
    (
      point: THREE.Vector3,
      { updateProbe, forceLifeSeed }: { updateProbe: boolean; forceLifeSeed?: boolean },
    ) => {
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

      const request = forceLifeSeed
        ? resolveSeedRequest({
            tool: 'Comet',
            seeding: { ...seeding, seedScale: Math.max(2, seeding.seedScale) },
          })
        : resolveSeedRequest({ tool: activeTool, seeding });
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
          // Life (or forced life reseed) refreshes the instanced mesh after a CPU seed.
          if (forceLifeSeed || activeTool === 'Life') updateInstances();
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

  const { meteors, impacts, onPlanetPointerDown, onMeteorImpact, spawnMeteorBurst } =
    useMeteorSystem({
      meteors: meteorControls,
      impacts: impactControls,
      seedAtPoint,
      activeTool,
      isProbeActive: activeTool === 'Probe',
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

  const triggerAutoReseed = useCallback(() => {
    if (spawnMeteorBurst) {
      spawnMeteorBurst(4, 'reseed');
    } else {
      runRandomize();
    }
  }, [spawnMeteorBurst, runRandomize]);

  useAutoReseed({
    enabled: autoReseedOnStagnation,
    running: running && graphicsOk && !documentHidden,
    status: simStatus,
    onReseed: triggerAutoReseed,
  });

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
          polarWrap={polarWrap}
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
