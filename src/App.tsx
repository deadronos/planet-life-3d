import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Leva, useControls, folder } from 'leva';
import { PlanetLife } from './components/PlanetLife';
import { Overlay } from './components/Overlay';
import { SpaceEnvironment } from './components/environment';

const levaTheme = {
  colors: {
    elevation1: 'rgba(13, 17, 28, 0.8)',
    elevation2: '#1a1f2e',
    elevation3: '#2d3345',
    accent1: '#6366f1',
    accent2: '#818cf8',
    accent3: '#a5b4fc',
    highlight1: '#94a3b8',
    highlight2: '#cbd5e1',
    highlight3: '#f8fafc',
  },
  fonts: {
    mono: "'Rajdhani', monospace",
    sans: "'Rajdhani', sans-serif",
  },
  sizes: {
    rootWidth: '340px',
  },
};

const LIGHT_POSITION: [number, number, number] = [6, 6, 8];

export default function App() {
  const [levaHidden, setLevaHidden] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Leva visibility on 'h' or 'H'
      if (e.key === 'h' || e.key === 'H') {
        setLevaHidden((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { autoRotate, autoRotateSpeed } = useControls({
    Camera: folder(
      {
        autoRotate: { value: false, label: 'Auto Rotate' },
        autoRotateSpeed: { value: 0.5, min: 0.1, max: 10, step: 0.1, label: 'Rotation Speed' },
      },
      { collapsed: true },
    ),
  });

  return (
    <>
      <Overlay />
      <Leva collapsed={false} theme={levaTheme} hidden={levaHidden} />
      <Canvas camera={{ position: [-1, -4, -12], fov: 50, near: 0.1, far: 200 }} dpr={[1, 2]}>
        <color attach="background" args={['#05060a']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={LIGHT_POSITION} intensity={1.2} />
        <SpaceEnvironment lightPosition={LIGHT_POSITION} />

        <PlanetLife lightPosition={LIGHT_POSITION} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
        />
      </Canvas>
    </>
  );
}
