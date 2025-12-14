import { useCallback, useMemo } from 'react';
import * as THREE from 'three';

export type CellColorMode = 'Solid' | 'Age Fade' | 'Neighbor Heat';

export type ResolveCellColor = (
  idx: number,
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
}): { resolveCellColor: ResolveCellColor; colorScratch: THREE.Color } {
  const solidColor = useMemo(() => new THREE.Color(params.cellColor), [params.cellColor]);

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
    (idx, ageView, neighborHeatView, target) => {
      switch (params.cellColorMode) {
        case 'Age Fade': {
          const age = ageView[idx];
          const decay = Math.exp(-age / ageHalfLife);
          const brightness = THREE.MathUtils.clamp(0.35 + decay * 0.75, 0.25, 1.2);
          target.copy(solidColor).multiplyScalar(brightness);
          break;
        }
        case 'Neighbor Heat': {
          const n = neighborHeatView[idx];
          const t = Math.min(1, Math.max(0, n / 8));
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

      target.r = Math.min(1, target.r);
      target.g = Math.min(1, target.g);
      target.b = Math.min(1, target.b);
      return Math.max(target.r, target.g, target.b);
    },
    [
      params.cellColorMode,
      ageHalfLife,
      heatHighColorObj,
      heatLowColorObj,
      heatMidColorObj,
      solidColor,
    ],
  );

  return { resolveCellColor, colorScratch };
}
