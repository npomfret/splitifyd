import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/__tests__/setup.ts'],
        globals: true,
        css: true,
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'playwright-tests/**', // Exclude Playwright tests from Vitest
        ],
        // Longer timeout for integration tests
        testTimeout: 5000,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@test-builders': resolve(__dirname, '../firebase/functions/__tests__/support/builders'),
            // React compatibility for libraries that expect React (like react-i18next)
            react: 'preact/compat',
            'react-dom': 'preact/compat',
        },
    },
});
