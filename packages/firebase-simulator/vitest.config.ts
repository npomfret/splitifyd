import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        threads: false,
        maxConcurrency: 1,
        testTimeout: 5000,
        hookTimeout: 5000,
        teardownTimeout: 5000,
        setupFiles: ['./vitest.setup.ts'],
        poolOptions: {
            threads: {
                singleThread: true,
            },
        },
        coverage: {
            enabled: false,
        },
    },
});
