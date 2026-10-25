import { useCallback, useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';

import { isStatsReadbackDue, sumStatsPixels } from '../planetLife/gpuStats';
import { createRenderTarget, type FullscreenPass, type Resolution } from './common';

/** A stats readback request that has not been issued yet. */
type PendingStatsRead = {
  current: THREE.Texture;
  prev: THREE.Texture;
  generation: number;
  /** Render generation this request's textures belong to. */
  epoch: number;
};

export interface GpuStats {
  generation: number;
  population: number;
  birthsLastTick: number;
  deathsLastTick: number;
}

export interface GpuStatsReadback {
  statsTarget: THREE.WebGLRenderTarget;
  /**
   * Request a stats readback, subject to the throttle.
   *
   * `force` bypasses the throttle for discrete user actions (randomize,
   * clear, single-step) where showing stale figures would be confusing.
   */
  readStats: (current: THREE.Texture, prev: THREE.Texture, force?: boolean) => void;
}

/**
 * HUD stats readback: renders the birth/death/alive classification for
 * (prev -> current) into a stats target, reads it back, and publishes totals.
 * Owns the throttle counter, the in-flight lock, the deferred-request slot and
 * the epoch that invalidates reads issued against disposed targets.
 */
export function useGpuStatsReadback({
  gl,
  resolution,
  onStats,
  statsMaterial,
  statsScene,
  generationRef,
}: {
  gl: THREE.WebGLRenderer;
  resolution: Resolution;
  onStats?: (stats: GpuStats) => void;
  statsMaterial: THREE.ShaderMaterial;
  statsScene: FullscreenPass;
  /** Generation counter owned by the simulation; read when a request is made. */
  generationRef: React.MutableRefObject<number>;
}): GpuStatsReadback {
  // Stats target: the offscreen buffer the classification is rendered into.
  const statsTarget = useMemo(
    () => createRenderTarget(resolution.width, resolution.height),
    [resolution.height, resolution.width],
  );

  // Reusable readback buffer for HUD stats (avoids a per-tick allocation).
  const statsBufferRef = useRef<Uint8Array | null>(null);

  // Count of stats readback requests, used to throttle to every Nth call.
  const statsTickRef = useRef(0);

  // Guards against overlapping async readbacks. The stats target is
  // re-rendered on every read, so a second read issued while the first is
  // still in flight would sample a half-written frame and report garbage.
  const statsReadInFlightRef = useRef(false);

  // Identifies which generation of the render targets a readback belongs to.
  // A resolution change disposes the old targets, so a read issued against
  // them must neither publish its result nor be re-issued - doing so would
  // make three.js lazily re-allocate a framebuffer/texture pair that no
  // cleanup will ever free.
  const statsEpochRef = useRef(0);

  // Holds the newest read implementation so a deferred request is re-issued
  // with current targets rather than those captured by an older render.
  const performStatsReadRef = useRef<typeof performStatsRead>(() => {
    /* replaced below */
  });

  // A read that arrives while one is in flight is deferred here and re-issued
  // when the in-flight read settles. Dropping it instead would strand the HUD:
  // a paused simulation never enters useFrame, so a discarded readback would
  // never be retried and the stats would stay wrong until the next user action.
  const statsPendingRef = useRef<PendingStatsRead | null>(null);

  // Async readbacks resolve after the frame that requested them; publishing
  // to a parent that has already unmounted would warn and leak work.
  const statsMountedRef = useRef(true);
  useEffect(() => {
    statsMountedRef.current = true;
    return () => {
      statsMountedRef.current = false;
      statsPendingRef.current = null;
    };
  }, []);

  // Render the birth/death/alive classification for (prev -> current) into
  // the stats target, read it back, and publish HUD stats.
  //
  // Two things keep this off the critical path:
  //
  // 1. Throttling. `gl.readRenderTargetPixels` is a synchronous
  //    synchronisation point - the CPU blocks until the GPU has drained its
  //    queued commands, which destroys CPU/GPU pipelining for the whole
  //    frame. The transfer size is secondary to that stall, and at up to
  //    256x512 the buffer is 512KB. The HUD only needs a coarse trend, so we
  //    sample every Nth call rather than every tick.
  // 2. Async readback. Where the renderer supports it we use the PBO +
  //    fenceSync path, which never blocks the render loop at all.
  //
  // Split from `readStats` so the deferred-request path can re-issue a read
  // without re-entering the throttle bookkeeping.
  const performStatsRead = useCallback(
    // eslint-disable-next-line react-hooks/immutability -- Imperative readback callback mutates shader uniforms; these are GPU handles, not React state.
    (current: THREE.Texture, prev: THREE.Texture, generation: number, epoch: number) => {
      const prevTarget = gl.getRenderTarget();
      // eslint-disable-next-line react-hooks/immutability -- Stats uniforms are written imperatively during a readback, outside React's render.
      statsMaterial.uniforms.uPrevState.value = prev;
      statsMaterial.uniforms.uCurrentState.value = current;
      gl.setRenderTarget(statsTarget);
      gl.render(statsScene.scene, statsScene.camera);
      gl.setRenderTarget(prevTarget);

      const w = resolution.width;
      const h = resolution.height;
      const texelCount = w * h;
      const needed = texelCount * 4;
      if (!statsBufferRef.current || statsBufferRef.current.length < needed) {
        statsBufferRef.current = new Uint8Array(needed);
      }
      const pixels = statsBufferRef.current;

      const publish = () => {
        if (!statsMountedRef.current || !onStats) return;
        // The targets this read was issued against have been disposed by a
        // resolution change; its figures describe a world that no longer exists.
        if (epoch !== statsEpochRef.current) return;
        // Bound the reduction to the texels this readback refreshed; the
        // shared buffer is reused and may be larger after a resolution drop.
        const totals = sumStatsPixels(pixels, texelCount);
        onStats({
          generation,
          population: totals.population,
          birthsLastTick: totals.births,
          deathsLastTick: totals.deaths,
        });
      };

      // Release the in-flight lock and re-issue any request that arrived
      // while this read was outstanding, so a user action is never lost.
      const settle = () => {
        statsReadInFlightRef.current = false;
        const pending = statsPendingRef.current;
        statsPendingRef.current = null;
        if (!pending || !statsMountedRef.current) return;
        // Same rule as publish: never let a request whose textures belong to
        // a superseded render drive a read against disposed targets.
        if (pending.epoch !== statsEpochRef.current) return;
        // Re-issue through the newest read implementation, not this closure:
        // the render targets may have been rebuilt since this read started.
        performStatsReadRef.current(
          pending.current,
          pending.prev,
          pending.generation,
          pending.epoch,
        );
      };

      // Prefer the non-blocking path; fall back to the synchronous read only
      // if the renderer predates readRenderTargetPixelsAsync.
      if (typeof gl.readRenderTargetPixelsAsync === 'function') {
        statsReadInFlightRef.current = true;
        gl.readRenderTargetPixelsAsync(statsTarget, 0, 0, w, h, pixels)
          .then(publish)
          .catch((err: unknown) => {
            // A failed readback must never take down the render loop; the HUD
            // simply keeps its previous values until the next attempt.
            // eslint-disable-next-line no-console
            console.warn('[GPUSimulation] async stats readback failed', err);
          })
          .finally(settle);
        return;
      }

      const target = gl.getRenderTarget();
      gl.readRenderTargetPixels(statsTarget, 0, 0, w, h, pixels);
      gl.setRenderTarget(target);
      publish();
      settle();
    },
    [gl, onStats, resolution.height, resolution.width, statsMaterial, statsScene, statsTarget],
  );

  const readStats = useCallback(
    // eslint-disable-next-line react-hooks/immutability -- readStats writes material uniforms from an imperative callback invoked by the render loop.
    (current: THREE.Texture, prev: THREE.Texture, force = false) => {
      if (!onStats) return;

      // Evaluate the cadence against the current counter, then advance it. Testing
      // before incrementing means the very first request is due (counter is 0),
      // so the HUD populates immediately instead of waiting a full interval.
      const due = isStatsReadbackDue(statsTickRef.current);
      statsTickRef.current += 1;
      if (!force && !due) return;

      const epoch = statsEpochRef.current;

      // Defer rather than discard: the stats target is about to be
      // overwritten, so a concurrent read would sample a partially written
      // frame. The pending slot holds the latest request so the HUD always
      // reflects the most recent user action.
      if (statsReadInFlightRef.current) {
        statsPendingRef.current = { current, prev, generation: generationRef.current, epoch };
        return;
      }

      performStatsRead(current, prev, generationRef.current, epoch);
    },
    [onStats, performStatsRead, generationRef],
  );

  // Advance the render generation and publish the newest read implementation.
  //
  // This effect must be declared before any consumer's initialization effect:
  // React runs cleanups before setups and mounts effects in declaration order,
  // so by the time initialization issues its forced readback the epoch and the
  // read implementation both describe the freshly built targets. Reads still
  // in flight from the previous generation are recognised as stale and their
  // deferred work is discarded.
  useEffect(() => {
    statsEpochRef.current += 1;
    performStatsReadRef.current = performStatsRead;
    return () => {
      statsPendingRef.current = null;
    };
  }, [performStatsRead, statsTarget]);

  useEffect(() => {
    return () => {
      statsTarget.dispose();
    };
  }, [statsTarget]);

  return { statsTarget, readStats };
}
