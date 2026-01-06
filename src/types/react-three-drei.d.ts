declare module '@react-three/drei' {
  import type { ReactThreeFiber } from '@react-three/fiber';
  import type React from 'react';
  import type * as THREE from 'three';
  import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

  type OrbitControlsElementProps = ReactThreeFiber.ThreeElement<typeof OrbitControlsImpl>;

  export type OrbitControlsProps = Omit<OrbitControlsElementProps, 'args'> & {
    args?: OrbitControlsElementProps['args'];
    makeDefault?: boolean;
    camera?: THREE.Camera;
    domElement?: HTMLElement;
  };

  export const OrbitControls: React.ForwardRefExoticComponent<
    OrbitControlsProps & React.RefAttributes<OrbitControlsImpl>
  >;

  type StarsElementProps = ReactThreeFiber.ThreeElement<typeof THREE.Points>;

  export type StarsProps = Omit<StarsElementProps, 'args'> & {
    args?: StarsElementProps['args'];
    radius?: number;
    depth?: number;
    count?: number;
    factor?: number;
    saturation?: number;
    fade?: boolean;
    speed?: number;
  };

  export const Stars: React.ForwardRefExoticComponent<
    StarsProps & React.RefAttributes<THREE.Points>
  >;
}
