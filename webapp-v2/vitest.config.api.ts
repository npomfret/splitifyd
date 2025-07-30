import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node', // Use node environment for API tests
    globals: true,
    include: ['src/__tests__/api-integration/**/*.test.ts'],
    testTimeout: 30000, // Longer timeout for API tests
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../firebase/functions/src/shared'),
      '@test-builders': resolve(__dirname, '../firebase/functions/__tests__/support/builders'),
    },
  },
});