#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '../..');
const sharedDir = path.join(rootDir, 'packages/shared');
const srcFunctions = path.join(rootDir, 'firebase/functions');
const stageRoot = path.join(rootDir, '.firebase/deploy');
const stageFunctions = path.join(stageRoot, 'functions');

console.log('=== Preparing Firebase Functions for Deployment ===');

// Clean and create staging directory
console.log('Creating staging directory...');
fs.rmSync(stageFunctions, { recursive: true, force: true });
fs.mkdirSync(stageFunctions, { recursive: true });

// Build shared package
console.log('Building @splitifyd/shared...');
execSync('npm run build', { cwd: sharedDir, stdio: 'inherit' });

// Pack shared and capture actual filename
console.log('Packing @splitifyd/shared...');
const packOutput = execSync('npm pack --json', { cwd: sharedDir }).toString();
const [{ filename }] = JSON.parse(packOutput);
console.log(`Created tarball: ${filename}`);

// Stage functions directory
console.log('Staging functions directory...');
fs.cpSync(srcFunctions, stageFunctions, { recursive: true });

// Copy tarball to staged functions
const tarballSource = path.join(sharedDir, filename);
const tarballDest = path.join(stageFunctions, filename);
fs.cpSync(tarballSource, tarballDest);
console.log(`Copied tarball to staging: ${filename}`);

// Update package.json in staging directory only
const pkgPath = path.join(stageFunctions, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.dependencies = pkg.dependencies || {};

// Replace workspace reference with local tarball
pkg.dependencies['@splitifyd/shared'] = `file:./${filename}`;

// Write updated package.json
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('Updated staged package.json with local tarball reference');

// Clean up tarball from shared directory
fs.rmSync(tarballSource);
console.log('Cleaned up temporary tarball');

// Install production dependencies in staged directory
console.log('Installing production dependencies in staged functions...');
execSync('npm ci --omit=dev', { cwd: stageFunctions, stdio: 'inherit' });

console.log(`\n✓ Deployment stage ready at ${stageFunctions}`);
console.log('Firebase will deploy from this staged directory.');