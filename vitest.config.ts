import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: [
      'tests/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.tsx',
      'tests/**/*.test.tsx',
    ],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },

  benchmark: {
    include: ['tests/**/*.bench.ts', 'tests/**/*.bench.tsx'],
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
