import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { DISPLAY_REFERRED_OUTPUT } from '../../shaders/displayReferredOutput';
import { SNOISE_3D_GLSL } from '../../shaders/planetNoiseBake';
import { useUIStore } from '../../store/useUIStore';
import { clampFrameDelta } from '../performance/renderDemand';

const NEBULA_BAKE_WIDTH = 1024;
const NEBULA_BAKE_HEIGHT = 512;

const NEBULA_BAKE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const NEBULA_BAKE_FRAG = /* glsl */ `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  uniform vec3 uColor5;
  varying vec2 vUv;

  ${SNOISE_3D_GLSL}

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    float theta = (vUv.x - 0.5) * 6.28318530718;
    float phi = (vUv.y - 0.5) * 3.14159265359;
    vec3 pos = vec3(cos(phi) * cos(theta), sin(phi), cos(phi) * sin(theta));

    float n1 = fbm(pos * 2.0);
    float n2 = fbm(pos * 4.0);
    float n3 = fbm(pos * 1.5);

    float nebula1 = smoothstep(-0.2, 0.6, n1);
    float nebula2 = smoothstep(-0.1, 0.5, n2) * 0.6;
    float nebula3 = smoothstep(-0.3, 0.4, n3) * 0.4;

    vec3 baseColor = mix(uColor1, uColor2, pos.y * 0.5 + 0.5);
    vec3 color = baseColor;
    color = mix(color, uColor3, nebula1 * 0.5);
    color = mix(color, uColor4, nebula2 * 0.3);
    color = mix(color, uColor5, nebula3 * 0.4);

    float brightness = 0.3 + nebula1 * 0.2 + nebula2 * 0.15;
    color *= brightness;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Procedural nebula skybox baked into an equirectangular texture once per
 * GL context, then sampled per frame with a slow UV drift.
 */
export function NebulaSkybox() {
  const meshRef = useRef<THREE.Mesh>(null);
  const gl = useThree((state) => state.gl);
  const graphicsEpoch = useUIStore((state) => state.graphicsEpoch);

  const nebulaTarget = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(NEBULA_BAKE_WIDTH, NEBULA_BAKE_HEIGHT, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false,
    });
    target.texture.wrapS = THREE.RepeatWrapping;
    target.texture.wrapT = THREE.ClampToEdgeWrapping;
    target.texture.name = 'NebulaSkyboxBaked';
    return target;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-create target on WebGL context restore
  }, [graphicsEpoch]);

  useEffect(() => () => nebulaTarget.dispose(), [nebulaTarget]);

  useLayoutEffect(() => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const bakeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor1: { value: new THREE.Color('#1a0a2e') },
        uColor2: { value: new THREE.Color('#16213e') },
        uColor3: { value: new THREE.Color('#0f3460') },
        uColor4: { value: new THREE.Color('#e94560') },
        uColor5: { value: new THREE.Color('#533483') },
      },
      vertexShader: NEBULA_BAKE_VERT,
      fragmentShader: NEBULA_BAKE_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const scene = new THREE.Scene();
    const quad = new THREE.Mesh(geometry, bakeMaterial);
    quad.frustumCulled = false;
    scene.add(quad);
    const camera = new THREE.Camera();

    const previous = gl.getRenderTarget();
    try {
      gl.setRenderTarget(nebulaTarget);
      gl.render(scene, camera);
    } finally {
      gl.setRenderTarget(previous);
      geometry.dispose();
      bakeMaterial.dispose();
    }
  }, [gl, nebulaTarget]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNebulaMap: { value: nebulaTarget.texture },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPosition;

        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uNebulaMap;

        varying vec3 vPosition;

        void main() {
          vec3 pos = normalize(vPosition);
          float u = atan(pos.z, pos.x) * 0.15915494309 + 0.5 + uTime * 0.0005;
          float v = asin(clamp(pos.y, -1.0, 1.0)) * 0.31830988618 + 0.5;
          vec3 color = texture2D(uNebulaMap, vec2(u, v)).rgb;

          gl_FragColor = vec4(color, 1.0);
          ${DISPLAY_REFERRED_OUTPUT}
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [nebulaTarget]);

  useEffect(() => () => shaderMaterial.dispose(), [shaderMaterial]);

  useFrame((_, delta) => {
    // eslint-disable-next-line react-hooks/immutability
    shaderMaterial.uniforms.uTime.value += clampFrameDelta(delta);
  });

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[150, 64, 64]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}
