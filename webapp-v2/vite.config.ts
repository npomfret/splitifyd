import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/v2/' : '/',
  plugins: [
    preact(),
    {
      name: 'post-build-script',
      closeBundle: async () => {
        try {
          await execAsync('node scripts/post-build.js');
          console.log('Post-build script executed successfully');
        } catch (error) {
          console.error('Post-build script failed:', error);
        }
      }
    }
  ],
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
    // Only used for temporary development
    open: false
  },
  build: {
    outDir: '../webapp/dist/v2',
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