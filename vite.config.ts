/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: 'https://deadronos.github.io/planet-life-3d/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // Pre-bundle the lazily imported bloom deps so the first dev load of the
  // chunk is not a 500 while Vite discovers and optimises them mid-request.
  optimizeDeps: { include: ['@react-three/postprocessing', 'postprocessing'] },
  build: {
    rolldownOptions: {
      output: {
        // Keep three.js, R3F, React and Leva in their own chunks so app-code changes
        // don't invalidate their cache entries. Leva is only reached through the
        // lazy LevaPanel import; React gets its own group so shared deps like
        // react-dom are not pulled into the leva chunk (which would make it eager).
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /node_modules[\\/](three|three-stdlib|@react-three[\\/]fiber)[\\/]/,
              priority: 30,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 25,
            },
            {
              name: 'leva',
              test: /node_modules[\\/](leva|@leva|react-colorful)[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
});
