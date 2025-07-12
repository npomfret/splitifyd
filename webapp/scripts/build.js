const esbuild = require('esbuild');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.development
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });

const API_BASE_URL = process.env.API_BASE_URL;

if (!API_BASE_URL) {
  console.error('Error: API_BASE_URL is not defined in .env.development');
  process.exit(1);
}

const define = {
  'API_BASE_URL': JSON.stringify(API_BASE_URL),
  'FIREBASE_EMULATOR_HOST': JSON.stringify('localhost'),
  'FIREBASE_AUTH_EMULATOR_PORT': JSON.stringify('9099'),
  'FIREBASE_FUNCTIONS_PORT': JSON.stringify('5001'),
  'FIREBASE_HOSTING_PORT': JSON.stringify('5002'),
};

const commonEsbuildOptions = {
  entryPoints: ['src/js/**/*.ts', 'src/js/**/*.js'],
  outdir: 'dist/js',
  outbase: 'src/js',
  format: 'esm',
  bundle: true, // Bundle all modules into a single file
  define: define,
  platform: 'browser', // Target browser environment
  sourcemap: true, // Generate sourcemaps for debugging
};

async function build() {
  try {
    await esbuild.build({
      ...commonEsbuildOptions,
      minify: true, // Minify code for production builds
    });
    console.log('esbuild build complete.');
  } catch (error) {
    console.error('esbuild build failed:', error);
    process.exit(1);
  }
}

async function watch() {
  try {
    const context = await esbuild.context({
      ...commonEsbuildOptions,
    });
    await context.watch();
    console.log('esbuild watching for changes...');
  } catch (error) {
    console.error('esbuild watch failed:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

if (command === 'build') {
  build();
} else if (command === 'watch') {
  watch();
} else {
  console.error('Usage: node build.js [build|watch]');
  process.exit(1);
}
