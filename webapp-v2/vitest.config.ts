import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.ts'],
        globals: true,
        css: true,
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/*playwright*/**', // Exclude Playwright tests from Vitest
            '**/*.playwright.test.ts', // Exclude Playwright test files
        ],
        // Longer timeout for integration tests
        testTimeout: 5000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'src/test-utils/', '**/*.d.ts', '**/*.config.*', '**/vite.config.*', 'dist/'],
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
            '@test-builders': resolve(__dirname, '../firebase/functions/__tests__/support/builders'),
        },
    },
});
