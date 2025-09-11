import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig(() => ({
    base: '/',
    plugins: [
        preact({
            // Temporarily disable SSG until auth issues are resolved
            prerender: {
                enabled: false,
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            // React compatibility for libraries that expect React
            react: 'preact/compat',
            'react-dom': 'preact/compat',
        },
    },
    server: {
        // Only used for temporary development
        open: false,
    },
    build: {
        target: 'es2022',
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['preact', 'preact-router'],
                },
            },
        },
    },
}));
