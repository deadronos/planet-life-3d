import * as THREE from 'three';

export type Resolution = { width: number; height: number };

// Helper to create FBO (Frame Buffer Object / Render Target)
export function createRenderTarget(width: number, height: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    // Use UnsignedByte texture target so the produced texture can be sampled
    // and displayed reliably across more WebGL contexts; 8-bit precision is
    // sufficient for visualization (age/heat/colors are quantized in shaders).
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    stencilBuffer: false,
    depthBuffer: false,
  });
}

// Convert boolean rules array to float array for shader
export function rulesToFloatArray(rules: boolean[]): number[] {
  return rules.map((r) => (r ? 1.0 : 0.0));
}

export interface FullscreenPass {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
}

/** Offscreen scene holding one full-screen quad that renders `material`. */
export function createFullscreenPass(material: THREE.ShaderMaterial): FullscreenPass {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);
  return { scene, camera, quad };
}
