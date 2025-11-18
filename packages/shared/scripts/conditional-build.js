#!/usr/bin/env node

/**
 * Conditional build script for @billsplit-wl/shared
 *
 * This script runs the production build only when BUILD_MODE=production.
 * During local development, it creates wrapper files that use tsx to run TypeScript directly.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildMode = process.env.BUILD_MODE || 'development';
if (process.env.SKIP_WORKSPACE_BUILD === 'true') {
    console.log('⏭️  Skipping build for @billsplit-wl/shared (SKIP_WORKSPACE_BUILD detected)');
    process.exit(0);
}

if (buildMode === 'production' || buildMode === 'test') {
    console.log('🏗️  Running production build for @billsplit-wl/shared...');
    execSync('npx tsup', { stdio: 'inherit' });
} else {
    console.log('⚡ Setting up @billsplit-wl/shared development mode (using tsx for direct TypeScript execution)');

    // Ensure dist directory exists
    const distDir = path.join(__dirname, '..', 'dist');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    // Create CommonJS wrapper
    const cjsWrapper = `// Development wrapper for CommonJS
// This file allows Node.js to load TypeScript directly using tsx
// without requiring compilation. In production, this file is replaced with
// the actual compiled JavaScript.

require('tsx');
module.exports = require('../src/index.ts');
`;

    // Create ESM wrapper
    // Note: We can't use 'import tsx' here as bundlers like Vite won't understand it
    // Instead, we re-export the TypeScript directly and rely on bundler's TypeScript support
    const esmWrapper = `// Development wrapper for ESM
// This file re-exports TypeScript directly for development.
// Bundlers like Vite/Webpack will handle the TypeScript compilation.
// In production, this file is replaced with the actual compiled JavaScript.

export * from '../src/index.ts';
`;

    // Create type definition files that re-export from source
    // This ensures TypeScript can still find the types during development
    const dtsContent = `// Type definitions (development mode)
// Re-exporting from source TypeScript files
export * from '../src/index';
export * from '../src/shared-types';
export * from '../src/user-colors';
`;

    // Write all wrapper files
    fs.writeFileSync(path.join(distDir, 'index.cjs'), cjsWrapper);
    fs.writeFileSync(path.join(distDir, 'index.mjs'), esmWrapper);
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), dtsContent);
    fs.writeFileSync(path.join(distDir, 'index.d.cts'), dtsContent);

    console.log('✅ Created dist wrappers for tsx execution');
    console.log('   - index.cjs (CommonJS wrapper)');
    console.log('   - index.mjs (ESM wrapper)');
    console.log('   - index.d.ts (TypeScript definitions)');
    console.log('   - index.d.cts (CommonJS TypeScript definitions)');
}
