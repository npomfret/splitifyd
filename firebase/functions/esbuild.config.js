const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Read package.json to get all dependencies
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const external = [
    // Keep Firebase runtime modules external
    'firebase-admin',
    'firebase-functions',
    // Keep large/native dependencies external
    'express',
    'i18next',
    'i18next-fs-backend',
    'joi',
    'dotenv',
    'xss',
    // Exclude test-only dependencies
    'playwright',
    'playwright-core',
    'chromium-bidi',
    'fsevents',
];

esbuild
    .build({
        entryPoints: [path.join(__dirname, 'lib/index.js')],
        bundle: true,
        platform: 'node',
        target: 'node22',
        format: 'cjs',
        outfile: path.join(__dirname, 'lib/index.bundled.js'),
        external,
        sourcemap: true,
        minify: false,
        treeShaking: true,
        // Bundle workspace packages and zod
    })
    .catch(() => process.exit(1));
