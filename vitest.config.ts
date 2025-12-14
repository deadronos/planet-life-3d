import { defineConfig } from 'vitest/config';
import path from 'path';

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
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
