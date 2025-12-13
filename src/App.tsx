import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Leva } from 'leva';
import { PlanetLife } from './components/PlanetLife';

export default function App() {
  return (
    <>
      <Leva collapsed={false} />
      <Canvas camera={{ position: [0, 0, 8], fov: 50, near: 0.1, far: 200 }} dpr={[1, 2]}>
        <color attach="background" args={['#05060a']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[6, 6, 8]} intensity={1.2} />
        <Stars radius={80} depth={30} count={2500} factor={4} fade speed={0.4} />

        <PlanetLife />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      </Canvas>
    </>
  );
}
