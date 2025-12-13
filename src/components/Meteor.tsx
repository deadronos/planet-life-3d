import { useFrame } from '@react-three/fiber'
import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'

export type MeteorSpec = {
  id: string
  origin: THREE.Vector3
  direction: THREE.Vector3 // normalized
  speed: number
  radius: number
}

export function Meteor(props: {
  spec: MeteorSpec
  planetRadius: number
  onImpact: (id: string, impactPoint: THREE.Vector3) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const impactedRef = useRef(false)

  const state = useMemo(() => {
    return {
      pos: props.spec.origin.clone(),
      dir: props.spec.direction.clone().normalize()
    }
  }, [props.spec.origin, props.spec.direction])

  useFrame((_, dt) => {
    if (impactedRef.current) return
    state.pos.addScaledVector(state.dir, props.spec.speed * dt)
    meshRef.current.position.copy(state.pos)

    // impact when meteor reaches the planet surface (simple sphere collision)
    const dist = state.pos.length()
    if (dist <= props.planetRadius + props.spec.radius) {
      impactedRef.current = true
      const impact = state.pos.clone().normalize().multiplyScalar(props.planetRadius)
      props.onImpact(props.spec.id, impact)
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[props.spec.radius, 16, 16]} />
      <meshStandardMaterial emissive={'#ffcc66'} emissiveIntensity={2} roughness={0.2} metalness={0.1} />
    </mesh>
  )
}
