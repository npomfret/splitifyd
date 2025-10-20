import preact from '@preact/preset-vite';
import path from 'path';
import { defineConfig } from 'vite';

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
        host: '127.0.0.1',
        port: 0, // Ask OS for a free port each run
        strictPort: false,
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
