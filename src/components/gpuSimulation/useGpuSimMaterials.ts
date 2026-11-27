import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { gpuSeedFragmentShader } from '../../shaders/gpuSeed.frag';
import { gpuStatsFragmentShader } from '../../shaders/gpuStats.frag';
import { simulationFragmentShader } from '../../shaders/simulation.frag';
import { simulationVertexShader } from '../../shaders/simulation.vert';
import { ECOLOGY_PROFILES, type EcologyProfileName } from '../../sim/ecology';
import { normalizeDecayStates, type Rules } from '../../sim/rules';
import {
  createFullscreenPass,
  type FullscreenPass,
  type Resolution,
  rulesToFloatArray,
} from './common';
import { createEcologyBiasTexture } from './ecologyBiasTexture';

const copyFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  varying vec2 vUv;

  void main() {
    gl_FragColor = texture2D(uTexture, vUv);
  }
`;

export interface GpuSimMaterials {
  simMaterial: THREE.ShaderMaterial;
  simScene: FullscreenPass;
  seedMaterial: THREE.ShaderMaterial;
  seedScene: FullscreenPass;
  copyMaterial: THREE.ShaderMaterial;
  copyScene: FullscreenPass;
  statsMaterial: THREE.ShaderMaterial;
  statsScene: FullscreenPass;
}

/**
 * Shader materials + offscreen scenes for the simulation, seeding and stats
 * passes. Uniforms for rules / game mode / ecology are synced in place from
 * props so editing them never recreates a material (which would wipe the
 * world). Materials and quad geometries are disposed on replacement/unmount.
 */
export function useGpuSimMaterials({
  resolution,
  rules,
  gameMode,
  ecologyProfile,
  polarWrap = false,
  colonyBiomeAffinity = false,
  dynamicFertility = false,
}: {
  resolution: Resolution;
  rules: Rules;
  gameMode: 'Classic' | 'Colony';
  ecologyProfile: EcologyProfileName;
  polarWrap?: boolean;
  colonyBiomeAffinity?: boolean;
  dynamicFertility?: boolean;
}): GpuSimMaterials {
  const { width, height } = resolution;
  const ecologyBiasTexture = useMemo(
    () => createEcologyBiasTexture({ width, height }, ecologyProfile),
    [height, width, ecologyProfile],
  );

  // Create the simulation material exactly once per resolution. We mutate its
  // uniforms in place from a separate effect when rules/gameMode change, so the
  // material's identity stays stable. (Previously this useMemo depended on
  // `rules` and `gameMode`, so editing birth/survive digits recreated the
  // material and wiped the simulation.)
  const simMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
        uResolution: { value: new THREE.Vector2(resolution.width, resolution.height) },
        uBirthRules: { value: rulesToFloatArray(rules.birth) },
        uSurviveRules: { value: rulesToFloatArray(rules.survive) },
        uDecayStates: { value: normalizeDecayStates(rules.decayStates) },
        uColonyMode: { value: gameMode === 'Colony' },
        uPolarWrap: { value: polarWrap },
        uColonyBiomeAffinity: { value: colonyBiomeAffinity },
        uGeneration: { value: 0 },
        uEcologyEnabled: { value: ecologyProfile !== 'None' },
        uEcologyBiasTexture: { value: null },
        uEcologyProfileBiases: {
          value: (() => {
            const p = ECOLOGY_PROFILES[ecologyProfile] ?? ECOLOGY_PROFILES.None;
            return new THREE.Vector4(
              p.fertilityBias,
              p.droughtBias,
              p.mountainBias,
              p.sunlightBias,
            );
          })(),
        },
        uSolarPhase: { value: 0 },
        uDynamicFertility: { value: dynamicFertility },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: simulationFragmentShader,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreating this material would wipe a running simulation; see the invariant guard below.
  }, [resolution.height, resolution.width]);

  // Fails loudly if the invariant above is ever broken.
  //
  // `simMaterial` is deliberately not a dependency of anything that could
  // rebuild it from `rules`, `gameMode` or `ecologyProfile`, because doing so
  // changes `initializeState`, which re-fires the init effect and resets the
  // world - on every keystroke in the birth/survive digit fields. The
  // `exhaustive-deps` suppressions above are therefore load-bearing, not
  // laziness.
  //
  // A suppression alone fails silently: adding one of those values back to the
  // dependency list looks like a tidy-up and breaks the app invisibly. This
  // guard turns that mistake into a console error in development.
  const invariantMaterialRef = useRef(simMaterial);
  const invariantResolutionRef = useRef(`${resolution.width}x${resolution.height}`);
  useEffect(() => {
    const key = `${resolution.width}x${resolution.height}`;
    const resolutionChanged = invariantResolutionRef.current !== key;
    if (
      !resolutionChanged &&
      invariantMaterialRef.current !== simMaterial &&
      typeof console !== 'undefined'
    ) {
      // eslint-disable-next-line no-console
      console.error(
        '[GPUSimulation] simMaterial was recreated without a resolution change. ' +
          'This re-initialises the simulation and wipes the world - a suppressed ' +
          'dependency has probably been added to its useMemo.',
      );
    }
    invariantMaterialRef.current = simMaterial;
    invariantResolutionRef.current = key;
  }, [simMaterial, resolution.width, resolution.height]);

  // Separate scene for simulation rendering (doesn't show in main view)
  const simScene = useMemo(() => createFullscreenPass(simMaterial), [simMaterial]);

  // Seeding material for writing patterns to texture. Created once and
  // updated in place when gameMode changes (same reason as simMaterial).
  const seedMaterial = useMemo(() => {
    const modeMap = { set: 0, toggle: 1, clear: 2, random: 3 };
    return new THREE.ShaderMaterial({
      uniforms: {
        uCurrentState: { value: null },
        uPatternData: { value: null },
        uResolution: { value: new THREE.Vector2(resolution.width, resolution.height) },
        uSeedCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uPatternSize: { value: new THREE.Vector2(1, 1) },
        uPatternOrigin: { value: new THREE.Vector2(0, 0) },
        uSeedMode: { value: modeMap.set },
        uSeedProbability: { value: 0.5 },
        uColonyMode: { value: gameMode === 'Colony' },
        uRandomSeed: { value: 0 },
        uDynamicFertility: { value: dynamicFertility },
        uFertilityDelta: { value: 0 },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: gpuSeedFragmentShader,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load-bearing: recreating the seed material would reset the world.
  }, [resolution.height, resolution.width]);

  const seedScene = useMemo(() => createFullscreenPass(seedMaterial), [seedMaterial]);

  // Passthrough copy pass: uploads initial CPU DataTexture into ping-pong
  // targets without stepping the CA rules at Gen 0.
  const copyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: copyFragmentShader,
    });
  }, []);

  const copyScene = useMemo(() => createFullscreenPass(copyMaterial), [copyMaterial]);

  // Stats pass: renders birth/death/alive buckets for the HUD.
  const statsMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPrevState: { value: null },
        uCurrentState: { value: null },
      },
      vertexShader: simulationVertexShader,
      fragmentShader: gpuStatsFragmentShader,
    });
  }, []);

  const statsScene = useMemo(() => createFullscreenPass(statsMaterial), [statsMaterial]);

  // Update rules and game mode when they change
  useEffect(() => {
    const birthRules = rulesToFloatArray(rules.birth);
    const surviveRules = rulesToFloatArray(rules.survive);
    // eslint-disable-next-line react-hooks/immutability -- Uniforms are updated in place so editing rule digits does not recreate the material and wipe the simulation.
    simMaterial.uniforms.uBirthRules.value = birthRules;
    simMaterial.uniforms.uSurviveRules.value = surviveRules;
    simMaterial.uniforms.uDecayStates.value = normalizeDecayStates(rules.decayStates);
    simMaterial.uniforms.uColonyMode.value = gameMode === 'Colony';
    // eslint-disable-next-line react-hooks/immutability -- Uniforms are updated in place so toggling gameMode does not recreate seedMaterial.
    seedMaterial.uniforms.uColonyMode.value = gameMode === 'Colony';
  }, [rules, gameMode, simMaterial, seedMaterial]);

  // Update ecology bias texture and flag in place when the profile or
  // resolution changes (same rationale as the rules effect: recreate
  // simMaterial and the sim is wiped).
  useEffect(() => {
    const p = ECOLOGY_PROFILES[ecologyProfile] ?? ECOLOGY_PROFILES.None;
    // eslint-disable-next-line react-hooks/immutability -- Uniforms are updated in place so changing the ecology profile does not recreate the material and wipe the simulation.
    simMaterial.uniforms.uEcologyEnabled.value = ecologyProfile !== 'None';
    simMaterial.uniforms.uEcologyBiasTexture.value = ecologyBiasTexture;
    (simMaterial.uniforms.uEcologyProfileBiases.value as THREE.Vector4).set(
      p.fertilityBias,
      p.droughtBias,
      p.mountainBias,
      p.sunlightBias,
    );
    simMaterial.uniforms.uColonyBiomeAffinity.value = colonyBiomeAffinity;
  }, [ecologyProfile, ecologyBiasTexture, colonyBiomeAffinity, simMaterial]);

  useEffect(() => {
    return () => {
      ecologyBiasTexture.dispose();
    };
  }, [ecologyBiasTexture]);

  // Update polarWrap uniform in place without recreating simMaterial.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Uniforms are updated in place so toggling polarWrap does not recreate the material and wipe the simulation.
    simMaterial.uniforms.uPolarWrap.value = polarWrap;
  }, [polarWrap, simMaterial]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Uniforms are updated in place so toggling dynamicFertility does not recreate materials.
    simMaterial.uniforms.uDynamicFertility.value = dynamicFertility;
    // eslint-disable-next-line react-hooks/immutability -- Uniforms are updated in place so toggling dynamicFertility does not recreate seedMaterial.
    seedMaterial.uniforms.uDynamicFertility.value = dynamicFertility;
  }, [dynamicFertility, simMaterial, seedMaterial]);

  // Dispose each material / quad geometry when it is replaced and on unmount.
  // Per-pass effects so the long-lived stats pass is not torn down by a
  // resolution change that only rebuilds the sim and seed passes.
  useEffect(() => {
    return () => {
      simMaterial.dispose();
      simScene.quad.geometry.dispose();
    };
  }, [simMaterial, simScene]);
  useEffect(() => {
    return () => {
      seedMaterial.dispose();
      seedScene.quad.geometry.dispose();
    };
  }, [seedMaterial, seedScene]);
  useEffect(() => {
    return () => {
      copyMaterial.dispose();
      copyScene.quad.geometry.dispose();
    };
  }, [copyMaterial, copyScene]);
  useEffect(() => {
    return () => {
      statsMaterial.dispose();
      statsScene.quad.geometry.dispose();
    };
  }, [statsMaterial, statsScene]);

  return {
    simMaterial,
    simScene,
    seedMaterial,
    seedScene,
    copyMaterial,
    copyScene,
    statsMaterial,
    statsScene,
  };
}
