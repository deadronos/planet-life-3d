/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: 'https://deadronos.github.io/planet-life-3d/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    rolldownOptions: {
      output: {
        // Keep three.js, R3F and Leva in their own chunks so app-code changes
        // don't invalidate their cache entries. Initial JS is still loaded at boot.
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /node_modules[\\/](three|three-stdlib|@react-three[\\/]fiber)[\\/]/,
              priority: 30,
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
