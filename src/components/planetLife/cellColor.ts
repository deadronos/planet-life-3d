import { useCallback, useMemo } from 'react';
import * as THREE from 'three';

import {
  AGE_FADE_BASE,
  AGE_FADE_MAX,
  AGE_FADE_MIN,
  AGE_FADE_SCALE,
  clamp01,
} from '../../sim/utils';

export type CellColorMode = 'Solid' | 'Age Fade' | 'Neighbor Heat';

export type ResolveCellColor = (
  idx: number,
  gridView: Uint8Array,
  ageView: Uint8Array,
  neighborHeatView: Uint8Array,
  target: THREE.Color,
) => number;

export function useCellColorResolver(params: {
  cellColorMode: CellColorMode;
  cellColor: string;
  ageFadeHalfLife: number;
  heatLowColor: string;
  heatMidColor: string;
  heatHighColor: string;
  gameMode: 'Classic' | 'Colony';
  colonyColorA: string;
  colonyColorB: string;
}): { resolveCellColor: ResolveCellColor; colorScratch: THREE.Color } {
  const solidColor = useMemo(() => new THREE.Color(params.cellColor), [params.cellColor]);
  const colColorA = useMemo(() => new THREE.Color(params.colonyColorA), [params.colonyColorA]);
  const colColorB = useMemo(() => new THREE.Color(params.colonyColorB), [params.colonyColorB]);

  const heatLowColorObj = useMemo(
    () => new THREE.Color(params.heatLowColor),
    [params.heatLowColor],
  );
  const heatMidColorObj = useMemo(
    () => new THREE.Color(params.heatMidColor),
    [params.heatMidColor],
  );
  const heatHighColorObj = useMemo(
    () => new THREE.Color(params.heatHighColor),
    [params.heatHighColor],
  );

  const colorScratch = useMemo(() => new THREE.Color(), []);
  const ageHalfLife = useMemo(() => Math.max(1, params.ageFadeHalfLife), [params.ageFadeHalfLife]);

  const resolveCellColor = useCallback<ResolveCellColor>(
    (idx, gridView, ageView, neighborHeatView, target) => {
      if (params.gameMode === 'Colony') {
        const val = gridView[idx];
        if (val === 2) target.copy(colColorB);
        else target.copy(colColorA);
      } else {
        switch (params.cellColorMode) {
          case 'Age Fade': {
            const age = ageView[idx];
            const decay = Math.exp(-age / ageHalfLife);
            const brightness = THREE.MathUtils.clamp(
              AGE_FADE_BASE + decay * AGE_FADE_SCALE,
              AGE_FADE_MIN,
              AGE_FADE_MAX,
            );
            target.copy(solidColor).multiplyScalar(brightness);
            break;
          }
          case 'Neighbor Heat': {
            const n = neighborHeatView[idx];
            const t = clamp01(n / 8);
            if (t <= 0.5) {
              target.copy(heatLowColorObj).lerp(heatMidColorObj, t * 2);
            } else {
              target.copy(heatMidColorObj).lerp(heatHighColorObj, (t - 0.5) * 2);
            }
            break;
          }
          case 'Solid':
          default:
            target.copy(solidColor);
            break;
        }
      }

      target.r = Math.min(1, target.r);
      target.g = Math.min(1, target.g);
      target.b = Math.min(1, target.b);
      return Math.max(target.r, target.g, target.b);
    },
    [
      params.cellColorMode,
      params.gameMode,
      ageHalfLife,
      heatHighColorObj,
      heatLowColorObj,
      heatMidColorObj,
      solidColor,
      colColorA,
      colColorB,
    ],
  );

  return { resolveCellColor, colorScratch };
}
