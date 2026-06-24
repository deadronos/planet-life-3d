// @vitest-environment jsdom
/**
 * Real-render smoke test for the Meteor component using
 * @react-three/test-renderer. This is the kind of test the existing
 * component tests (which fully mock @react-three/fiber) cannot run: it
 * actually mounts the component, drives useFrame, and asserts that the
 * impact callback fires for both normal and tunneling scenarios.
 *
 * The setup.ts global mock of @react-three/fiber is bypassed via
 * `vi.doUnmock` + a dynamic import so we get the real R3F context the
 * test renderer needs.
 */
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.doUnmock('@react-three/fiber');

let create: typeof import('@react-three/test-renderer').create;
let act: typeof import('@react-three/test-renderer').act;

beforeAll(async () => {
  const rtr = await import('@react-three/test-renderer');
  create = rtr.create;
  act = rtr.act;
});

describe('Meteor (real R3F render)', () => {
  it('mounts and renders the meteor mesh group', async () => {
    const { default: React } = await import('react');
    const { Meteor } = await import('../../src/components/Meteor');

    const renderer = await create(
      React.createElement(Meteor, {
        spec: {
          id: 'm1',
          origin: new THREE.Vector3(10, 0, 0),
          direction: new THREE.Vector3(-1, 0, 0),
          speed: 1,
          radius: 0.5,
          trailLength: 0.6,
          trailWidth: 0.1,
          emissiveIntensity: 1.2,
        },
        planetRadius: 5,
        onImpact: () => {},
      }),
    );

    // The component should produce a group with a sphere (head) and a
    // cone (trail) inside.
    const tree = renderer.toTree();
    expect(tree).toBeDefined();
    const json = JSON.stringify(tree);
    expect(json).toContain('sphereGeometry');
    expect(json).toContain('coneGeometry');

    await renderer.unmount();
  });

  it('fires onImpact when a frame has a huge dt (regression for tunneling bug)', async () => {
    const { default: React } = await import('react');
    const { Meteor } = await import('../../src/components/Meteor');

    const impacts: THREE.Vector3[] = [];
    const renderer = await create(
      React.createElement(Meteor, {
        spec: {
          id: 'm-tunnel',
          // Start just outside the impact shell (radius 2.6 + 0.08 = 2.68).
          origin: new THREE.Vector3(0, 0, 3.0),
          direction: new THREE.Vector3(0, 0, -1),
          // Fast meteor + huge dt: without dt-clamping + swept intersection,
          // one frame would move the meteor straight past the planet.
          speed: 30,
          radius: 0.08,
          trailLength: 0.6,
          trailWidth: 0.1,
          emissiveIntensity: 1.2,
        },
        planetRadius: 2.6,
        onImpact: (_id, point) => {
          impacts.push(point.clone());
        },
      }),
    );

    // Old behavior: a single 0.5s frame at speed 30 moves 15 units in one
    // step. With the swept intersection + dt clamp, the meteor still
    // impacts; it just takes a few clamped frames to traverse.
    await act(async () => {
      await renderer.advanceFrames(5, 0.5);
    });

    expect(impacts).toHaveLength(1);
    // Impact should be on the planet surface (|point| == planetRadius).
    expect(impacts[0].length()).toBeCloseTo(2.6, 1);

    await renderer.unmount();
  });

  it('does NOT fire onImpact when the segment is entirely outside the planet', async () => {
    const { default: React } = await import('react');
    const { Meteor } = await import('../../src/components/Meteor');

    const impacts: string[] = [];
    const renderer = await create(
      React.createElement(Meteor, {
        spec: {
          id: 'm-miss',
          origin: new THREE.Vector3(10, 0, 0),
          direction: new THREE.Vector3(1, 0, 0),
          speed: 1,
          radius: 0.1,
          trailLength: 0.6,
          trailWidth: 0.1,
          emissiveIntensity: 1.2,
        },
        planetRadius: 2.6,
        onImpact: (id) => {
          impacts.push(id);
        },
      }),
    );

    await act(async () => {
      await renderer.advanceFrames(3, 0.05);
    });

    expect(impacts).toHaveLength(0);

    await renderer.unmount();
  });
});
