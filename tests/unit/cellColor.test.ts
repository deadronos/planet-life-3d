import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCellColorResolver } from '../../src/components/planetLife/cellColor';
import * as THREE from 'three';

describe('cellColor', () => {
  describe('useCellColorResolver', () => {
    it('should return Solid color when mode is Solid', () => {
      const { result } = renderHook(() =>
        useCellColorResolver({
          cellColorMode: 'Solid',
          cellColor: '#ff0000',
          ageFadeHalfLife: 24,
          heatLowColor: '#00ff00',
          heatMidColor: '#ffff00',
          heatHighColor: '#ff0000',
        }),
      );

      const ageView = new Uint8Array([10]);
      const heatView = new Uint8Array([4]);
      const color = new THREE.Color();

      result.current.resolveCellColor(0, ageView, heatView, color);

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
        }),
      );

      const ageView = new Uint8Array([0]); // Very young cell
      const heatView = new Uint8Array([4]);
      const color = new THREE.Color();

      result.current.resolveCellColor(0, ageView, heatView, color);

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
        }),
      );

      const ageView = new Uint8Array([100]); // Very old cell
      const heatView = new Uint8Array([4]);
      const color = new THREE.Color();

      result.current.resolveCellColor(0, ageView, heatView, color);

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
        }),
      );

      const ageView = new Uint8Array([10]);
      const heatView = new Uint8Array([0]); // Very low heat
      const color = new THREE.Color();

      result.current.resolveCellColor(0, ageView, heatView, color);

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
        }),
      );

      const ageView = new Uint8Array([10]);
      const heatView = new Uint8Array([4]); // Mid heat (4/8 = 0.5)
      const color = new THREE.Color();

      result.current.resolveCellColor(0, ageView, heatView, color);

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
        }),
      );

      const ageView = new Uint8Array([10]);
      const heatView = new Uint8Array([8]); // Very high heat
      const color = new THREE.Color();

      result.current.resolveCellColor(0, ageView, heatView, color);

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
        }),
      );

      const ageView = new Uint8Array([0]);
      const heatView = new Uint8Array([0]);
      const color = new THREE.Color();

      result.current.resolveCellColor(0, ageView, heatView, color);

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
        }),
      );

      const ageView = new Uint8Array([0]);
      const heatView = new Uint8Array([0]);
      const color = new THREE.Color();

      const brightness = result.current.resolveCellColor(0, ageView, heatView, color);

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
        }),
      );

      const ageView = new Uint8Array([50]);
      const heatView = new Uint8Array([4]);
      const color = new THREE.Color();

      // Should not throw
      expect(() => result.current.resolveCellColor(0, ageView, heatView, color)).not.toThrow();
    });
  });
});
