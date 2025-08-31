import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        env: {
            GCLOUD_PROJECT: 'splitifyd',
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
        testTimeout: 10000, // Increased for integration tests
        hookTimeout: 10000, // Increased for integration tests setup/teardown
        // Allow file parallelism but prevent test case parallelism within files
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: false, // Allow multiple processes for file parallelism
                maxForks: 3, // Limit to 3 concurrent test files
            },
        },
        fileParallelism: true, // Allow test files to run in parallel
        maxConcurrency: 1, // But limit concurrent test cases within each file to 1
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
