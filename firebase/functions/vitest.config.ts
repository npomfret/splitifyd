import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'lib', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'lib/',
        'scripts/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/index.ts', // Entry point
      ],
    },
    testTimeout: 30000, // Increased for integration tests
    hookTimeout: 30000, // Increased for integration tests setup/teardown
    // Force sequential execution for integration tests to prevent Firebase emulator conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single process
      },
    },
    maxConcurrency: 1, // Limit to 1 concurrent test
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});