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
