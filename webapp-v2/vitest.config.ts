import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: process.env.TEST_INTEGRATION 
      ? ['./src/__tests__/setup.integration.ts']
      : ['./src/__tests__/setup.ts'],
    globals: true,
    css: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',  // Exclude E2E tests from Vitest
    ],
    // Longer timeout for integration tests
    testTimeout: process.env.TEST_INTEGRATION ? 30000 : 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-utils/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/vite.config.*',
        'dist/',
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 75,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../firebase/functions/src/shared'),
      '@test-builders': resolve(__dirname, '../firebase/functions/__tests__/support/builders'),
    },
  },
});