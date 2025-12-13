import { useFrame } from '@react-three/fiber'
import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'

export type ImpactSpec = {
  id: string
  point: THREE.Vector3
  normal: THREE.Vector3
  start: number
  duration: number
}

export function ImpactRing(props: { spec: ImpactSpec; planetRadius: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)

  const basis = useMemo(() => {
    // ringGeometry faces +Z; rotate it so +Z aligns with the surface normal
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), props.spec.normal)
    const pos = props.spec.normal.clone().multiplyScalar(props.planetRadius + 0.01)
    return { q, pos }
  }, [props.spec.normal, props.planetRadius])

  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() - props.spec.start) / props.spec.duration
    const u = Math.min(1, Math.max(0, t))
    const scale = THREE.MathUtils.lerp(0.2, 2.2, u)

    meshRef.current.position.copy(basis.pos)
    meshRef.current.quaternion.copy(basis.q)
    meshRef.current.scale.setScalar(scale)
    matRef.current.opacity = 1 - u
  })

  return (
    <mesh ref={meshRef}>
      <ringGeometry args={[0.06, 0.12, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color={'#ffeeaa'}
        transparent
        opacity={1}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
