#!/usr/bin/env node

/**
 * Conditional build script for @splitifyd/firebase-simulator
 *
 * - In production or test environments we emit compiled bundles with tsup.
 * - During local development we create lightweight wrappers that delegate to the
 *   TypeScript sources. This keeps hot-reload tooling (Vite, Vitest, tsx) fast
 *   while still letting Node.js consumers require the package without manual builds.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '..', 'dist');

const buildMode = process.env.BUILD_MODE || 'development';
if (process.env.SKIP_WORKSPACE_BUILD === 'true') {
    console.log('⏭️  Skipping build for @splitifyd/firebase-simulator (SKIP_WORKSPACE_BUILD detected)');
    process.exit(0);
}
const shouldEmitBundles = buildMode === 'production' || buildMode === 'test' || process.env.FORCE_PROD_BUILD === 'true';

if (shouldEmitBundles) {
    console.log('🏗️  Building @splitifyd/firebase-simulator bundles with tsup...');
    execSync('npx tsup', { stdio: 'inherit' });
    console.log('✅  Bundles written to dist/');
    process.exit(0);
}

console.log('⚡  Preparing @splitifyd/firebase-simulator development wrappers (tsx-powered)');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const cjsWrapper = `// Auto-generated development wrapper for CommonJS consumers
// Registers tsx so we can execute the TypeScript sources without a manual build.
require('tsx');
module.exports = require('../src/index.ts');
`;

const esmWrapper = `// Auto-generated development wrapper for ESM consumers
// Bundlers (Vite/Webpack) will compile the TypeScript sources directly.
export * from '../src/index.ts';
`;

const dtsWrapper = `// Auto-generated development types wrapper
export * from '../src/index';
`;

fs.writeFileSync(path.join(distDir, 'index.cjs'), cjsWrapper);
fs.writeFileSync(path.join(distDir, 'index.mjs'), esmWrapper);
fs.writeFileSync(path.join(distDir, 'index.d.ts'), dtsWrapper);
fs.writeFileSync(path.join(distDir, 'index.d.cts'), dtsWrapper);

console.log('✅  Development wrappers ready (dist/index.cjs|mjs|d.ts|d.cts)');
