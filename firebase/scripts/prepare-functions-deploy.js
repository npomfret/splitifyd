#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

const rootDir = path.join(__dirname, '../..');
const srcFunctions = path.join(__dirname, '../functions');
const stageRoot = path.join(__dirname, '../.firebase/deploy');
const stageFunctions = path.join(stageRoot, 'functions');

// Load instance name from .env file (set by switch-instance.ts)
const envPath = path.join(srcFunctions, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const instanceName = process.env.__INSTANCE_NAME;
if (!instanceName || !instanceName.startsWith('staging-')) {
    console.error('❌ Error: __INSTANCE_NAME must be set to a staging instance');
    console.error('   Run: tsx scripts/switch-instance.ts staging-1');
    console.error(`   Current value: ${instanceName || '(not set)'}`);
    process.exit(1);
}

const productionEnv = {
    ...process.env,
    __INSTANCE_NAME: instanceName,
    BUILD_MODE: 'production',
};

const workspacePackages = [
    {
        name: '@billsplit-wl/shared',
        directory: path.join(rootDir, 'packages/shared'),
    },
];

console.log('=== Preparing Firebase Functions for Deployment ===');

// Clean and create staging directory
console.log('Creating staging directory...');
fs.rmSync(stageFunctions, { recursive: true, force: true });
fs.mkdirSync(stageFunctions, { recursive: true });

const tarballs = workspacePackages.map(({ name, directory }) => {
    console.log(`Building ${name}...`);
    execSync('npm run build', { cwd: directory, stdio: 'inherit', env: productionEnv });

    console.log(`Packing ${name}...`);
    const packOutput = execSync('npm pack --json', { cwd: directory, env: productionEnv }).toString();
    const [{ filename }] = JSON.parse(packOutput);
    console.log(`Created tarball: ${filename}`);

    return {
        name,
        filename,
        sourcePath: path.join(directory, filename),
    };
});

// Ensure production build artifacts exist before staging
console.log('Ensuring Firebase Functions build for deployment...');
execSync('npm run build', { cwd: srcFunctions, stdio: 'inherit', env: productionEnv });

// Stage functions directory
console.log('Staging functions directory...');
fs.cpSync(srcFunctions, stageFunctions, { recursive: true });

const filesToPrune = [
    '.DS_Store',
    '.gcloudignore',
    '.env.devinstance.example',
    '.env.staging-1.example',
    'integration-test-results.json',
    'package-lock.json',
    'service-account-key.json',
    'test-integration-results.json',
    'tsconfig.deploy.json',
    'tsconfig.json',
    'vitest.config.ts',
    'vitest.global-setup.ts',
    'vitest.setup.ts',
    '.gitignore',
];

const directoriesToPrune = [
    'scripts',
    'src',
    'lib/__tests__',
];

function prune(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return;
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
        fs.rmSync(targetPath, { force: true });
    }
    console.log(`Pruned staged artifact: ${path.relative(stageFunctions, targetPath)}`);
}

filesToPrune.forEach((fileName) => prune(path.join(stageFunctions, fileName)));
directoriesToPrune.forEach((directoryName) => prune(path.join(stageFunctions, directoryName)));

// Remove any existing node_modules to avoid copying dev-only artifacts
const stagedNodeModules = path.join(stageFunctions, 'node_modules');
if (fs.existsSync(stagedNodeModules)) {
    fs.rmSync(stagedNodeModules, { recursive: true, force: true });
    console.log('Removed existing node_modules from staging directory');
}

// Copy tarballs to staged functions
tarballs.forEach(({ name, filename, sourcePath }) => {
    const destination = path.join(stageFunctions, filename);
    fs.cpSync(sourcePath, destination);
    console.log(`Copied ${name} tarball to staging: ${filename}`);
});

// Update package.json in staging directory only
const pkgPath = path.join(stageFunctions, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.devDependencies = pkg.devDependencies || {};

tarballs.forEach(({ name, filename }) => {
    pkg.dependencies[name] = `file:./${filename}`;
});

Object.keys(pkg.devDependencies).forEach((dep) => {
    if (dep.startsWith('@billsplit-wl/')) {
        console.log(`Removing devDependency: ${dep}`);
        delete pkg.devDependencies[dep];
    }
});

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('Updated staged package.json with local tarball references');

// Clean up tarballs from workspace directories
tarballs.forEach(({ filename, sourcePath }) => {
    fs.rmSync(sourcePath);
    console.log(`Cleaned up temporary tarball: ${filename}`);
});

console.log(`\n✓ Deployment stage ready at ${stageFunctions}`);
console.log(`Deploying to instance: ${instanceName}`);
console.log('Firebase will deploy from this staged directory.');
