import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact', 'preact-router']
        }
      }
    }
  }
});