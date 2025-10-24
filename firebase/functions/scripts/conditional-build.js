#!/usr/bin/env node

/**
 * Conditional build script for Firebase Functions
 *
 * This script runs the production build only when BUILD_MODE=production.
 * During local development, it creates a wrapper that uses tsx to run TypeScript directly.
 */

const fs = require('fs');
const path = require('path');

const buildMode = process.env.BUILD_MODE || 'development';

if (buildMode === 'production' || buildMode === 'test') {
    console.log('🏗️  Running production build for Firebase Functions...');
    require('child_process').execSync('npm run build:prod', { stdio: 'inherit' });
} else {
    console.log('⚡ Setting up development mode (using tsx for direct TypeScript execution)');

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
 * without requiring compilation. In production, this file is replaced with
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
