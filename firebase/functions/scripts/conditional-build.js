#!/usr/bin/env node

/**
 * Conditional build script for Firebase Functions
 *
 * This script determines compilation strategy based on INSTANCE_NAME:
 * - dev1-4: Creates tsx wrapper for direct TypeScript execution (no compilation)
 * - test/prod: Runs full production build (tsc + esbuild)
 *
 * INSTANCE_NAME is the single source of truth for both runtime behavior and compilation strategy.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load INSTANCE_NAME from .env file
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const instanceName = process.env.INSTANCE_NAME || 'dev1';
const needsCompilation = instanceName === 'prod';

if (needsCompilation) {
    console.log(`🏗️  Running production build for Firebase Functions (INSTANCE_NAME=${instanceName})...`);
    require('child_process').execSync('npm run build:prod', { stdio: 'inherit' });
} else {
    console.log(`⚡ Setting up development mode for ${instanceName} (using tsx for direct TypeScript execution)`);

    // Ensure lib directory exists
    const libDir = path.join(__dirname, '..', 'lib');
    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
    }

    // Create the wrapper file
    const wrapperContent = `#!/usr/bin/env node

/**
 * Development wrapper for Firebase Functions
 *
 * This file allows the Firebase emulator to run TypeScript directly using tsx
 * without requiring compilation. In production/test, this file is replaced with
 * the actual compiled JavaScript.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// Use tsx to run the TypeScript source directly
require('tsx');
module.exports = require('../src/index.ts');
`;

    fs.writeFileSync(path.join(libDir, 'index.js'), wrapperContent);
    console.log('✅ Created lib/index.js wrapper for tsx execution');
}
