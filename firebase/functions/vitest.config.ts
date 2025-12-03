import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        silent: false,
        env: {
        },
        include: ['src/**/*.test.ts'],
        exclude: ['node_modules', 'lib', 'dist'],
        testTimeout: 20000, // Increased for integration tests
        hookTimeout: 10000, // Increased for integration tests setup/teardown
        // Force sequential execution for Firebase integration tests
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true, // Run everything in a single process
            },
        },
        fileParallelism: false, // No file parallelism - run test files sequentially
        maxConcurrency: 1, // Limit concurrent test cases within each file to 1
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
