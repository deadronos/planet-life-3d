import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { useCellColorResolver } from '../../src/components/planetLife/cellColor';

describe('cellColor', () => {
  describe('useCellColorResolver', () => {
    const mockGrid = new Uint8Array([1]);

    it('should return Solid color when mode is Solid', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Solid',
          cellColor: '#ff0000',
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([10]);
      const heatView = new Uint8Array([4]);
      const color = new THREE.Color();

      result.current.resolveCellColor(0, mockGrid, ageView, heatView, color);

      // Should be red (ff0000)
      expect(color.r).toBeCloseTo(1, 2);
      expect(color.g).toBeCloseTo(0, 2);
      expect(color.b).toBeCloseTo(0, 2);
    });

    it('should apply Age Fade with high brightness for young cells', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Age Fade',
          cellColor: '#00ff00',
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([0]); // Very young cell
      const heatView = new Uint8Array([4]);
      const color = new THREE.Color();

      result.current.resolveCellColor(0, mockGrid, ageView, heatView, color);

      // Young cells should be bright
      const brightness = Math.max(color.r, color.g, color.b);
      expect(brightness).toBeGreaterThan(0.8);
    });

    it('should apply Age Fade with lower brightness for old cells', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Age Fade',
          cellColor: '#00ff00',
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([100]); // Very old cell
      const heatView = new Uint8Array([4]);
      const color = new THREE.Color();

      result.current.resolveCellColor(0, mockGrid, ageView, heatView, color);

      // Old cells should be dimmer
      const brightness = Math.max(color.r, color.g, color.b);
      expect(brightness).toBeLessThan(0.6);
    });

    it('should apply Neighbor Heat with low heat color', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Neighbor Heat',
          cellColor: '#ffffff',
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00', // Green
          heatMidColor: '#ffff00', // Yellow
          heatHighColor: '#ff0000', // Red
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([10]);
      const heatView = new Uint8Array([0]); // Very low heat
      const color = new THREE.Color();

      result.current.resolveCellColor(0, mockGrid, ageView, heatView, color);

      // Should be close to green (low heat color)
      expect(color.g).toBeGreaterThan(0.8);
      expect(color.r).toBeLessThan(0.5);
    });

    it('should apply Neighbor Heat with mid heat color', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Neighbor Heat',
          cellColor: '#ffffff',
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00', // Green
          heatMidColor: '#ffff00', // Yellow
          heatHighColor: '#ff0000', // Red
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([10]);
      const heatView = new Uint8Array([4]); // Mid heat (4/8 = 0.5)
      const color = new THREE.Color();

      result.current.resolveCellColor(0, mockGrid, ageView, heatView, color);

      // Should be yellowish (mix of green and red)
      expect(color.r).toBeGreaterThan(0.3);
      expect(color.g).toBeGreaterThan(0.3);
    });

    it('should apply Neighbor Heat with high heat color', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Neighbor Heat',
          cellColor: '#ffffff',
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00', // Green
          heatMidColor: '#ffff00', // Yellow
          heatHighColor: '#ff0000', // Red
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([10]);
      const heatView = new Uint8Array([8]); // Very high heat
      const color = new THREE.Color();

      result.current.resolveCellColor(0, mockGrid, ageView, heatView, color);

      // Should be close to red (high heat color)
      expect(color.r).toBeGreaterThan(0.8);
      expect(color.g).toBeLessThan(0.7);
    });

    it('should clamp color values to maximum of 1', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Solid',
          cellColor: '#ffffff', // Maximum brightness
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([0]);
      const heatView = new Uint8Array([0]);
      const color = new THREE.Color();

      result.current.resolveCellColor(0, mockGrid, ageView, heatView, color);

      // All components should be clamped to 1
      expect(color.r).toBeLessThanOrEqual(1);
      expect(color.g).toBeLessThanOrEqual(1);
      expect(color.b).toBeLessThanOrEqual(1);
    });

    it('should return max brightness value', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Solid',
          cellColor: '#ff8800', // Orange
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([0]);
      const heatView = new Uint8Array([0]);
      const color = new THREE.Color();

      const brightness = result.current.resolveCellColor(0, mockGrid, ageView, heatView, color);

      // Brightness should be the max of r,g,b
      expect(brightness).toBeCloseTo(Math.max(color.r, color.g, color.b), 5);
    });

    it('should handle edge case with very small ageFadeHalfLife', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Age Fade',
          cellColor: '#00ff00',
          ageFadeHalfLife: 0, // Should be clamped to 1
          heatLowColor: '#00ff00',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
          gameMode: 'Classic',
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([50]);
      const heatView = new Uint8Array([4]);
      const color = new THREE.Color();

      // Should not throw
      expect(() =>
        result.current.resolveCellColor(0, mockGrid, ageView, heatView, color),
      ).not.toThrow();
    });

    it('should use colony colors in Colony mode', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Solid', // Should be ignored
          cellColor: '#ff0000',
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
          gameMode: 'Colony',
          colonyColorA: '#ff0000', // Red
          colonyColorB: '#0000ff', // Blue
        }),
      );

      const ageView = new Uint8Array([0]);
      const heatView = new Uint8Array([0]);
      const color = new THREE.Color();
      const gridA = new Uint8Array([1]);
      const gridB = new Uint8Array([2]);

      // Check Species A
      result.current.resolveCellColor(0, gridA, ageView, heatView, color);
      expect(color.r).toBeCloseTo(1, 2);
      expect(color.b).toBeCloseTo(0, 2);

      // Check Species B
      result.current.resolveCellColor(0, gridB, ageView, heatView, color);
      expect(color.r).toBeCloseTo(0, 2);
      expect(color.b).toBeCloseTo(1, 2);
    });

    it('should apply a smooth cooling/fade gradient for Generations refractory cells', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Solid',
          cellColor: '#ff0000',
          ageFadeHalfLife: 24,
          heatLowColor: '#0000ff',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
          gameMode: 'Classic',
          decayStates: 4,
          colonyColorA: '#ff3333',
          colonyColorB: '#3388ff',
        }),
      );

      const ageView = new Uint8Array([1]);
      const heatView = new Uint8Array([0]);
      const cFiring = new THREE.Color();
      const cState2 = new THREE.Color();
      const cState3 = new THREE.Color();

      const b1 = result.current.resolveCellColor(
        0,
        new Uint8Array([1]),
        ageView,
        heatView,
        cFiring,
      );
      const b2 = result.current.resolveCellColor(
        0,
        new Uint8Array([2]),
        ageView,
        heatView,
        cState2,
      );
      const b3 = result.current.resolveCellColor(
        0,
        new Uint8Array([3]),
        ageView,
        heatView,
        cState3,
      );

      expect(b1).toBeCloseTo(1, 2);
      expect(b1).toBeGreaterThan(b2);
      expect(b2).toBeGreaterThan(b3);
      expect(b3).toBeGreaterThan(0);
      // Cooling shifts color toward heatLowColor (blue)
      expect(cState2.b).toBeGreaterThan(cFiring.b);
      expect(cState3.b).toBeGreaterThan(0);
    });
  });
});
