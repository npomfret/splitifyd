import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/v2/' : '/',
  plugins: [preact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      // React compatibility for libraries that expect React
      'react': 'preact/compat',
      'react-dom': 'preact/compat'
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: '../firebase/public/v2',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact', 'preact-router']
        }
      }
    }
  }
}));