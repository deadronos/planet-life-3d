/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: 'https://deadronos.github.io/planet-life-3d/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
