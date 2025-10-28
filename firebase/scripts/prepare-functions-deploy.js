#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '../..');
const srcFunctions = path.join(__dirname, '../functions');
const stageRoot = path.join(__dirname, '../.firebase/deploy');
const stageFunctions = path.join(stageRoot, 'functions');

const productionEnv = {
    ...process.env,
    BUILD_MODE: 'production',
    FORCE_PROD_BUILD: 'true',
};

const workspacePackages = [
    {
        name: '@splitifyd/shared',
        directory: path.join(rootDir, 'packages/shared'),
    },
    {
        name: '@splitifyd/firebase-simulator',
        directory: path.join(rootDir, 'packages/firebase-simulator'),
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
console.log('Ensuring Firebase Functions production build...');
execSync('npm run build:prod', { cwd: srcFunctions, stdio: 'inherit', env: productionEnv });

// Stage functions directory
console.log('Staging functions directory...');
fs.cpSync(srcFunctions, stageFunctions, { recursive: true });

const filesToPrune = [
    '.DS_Store',
    '.gcloudignore',
    '.env.devinstance.example',
    '.env.prod.example',
    'integration-test-results.json',
    'package-lock.json',
    'splitifyd-service-account-key.json',
    'test-integration-results.json',
    'tsconfig.build.json',
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
    if (dep.startsWith('@splitifyd/')) {
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

// Install production dependencies in staged directory
console.log('Installing production dependencies in staged functions...');
execSync('npm install --omit=dev --package-lock=false', { cwd: stageFunctions, stdio: 'inherit' });
prune(path.join(stageFunctions, 'package-lock.json'));

// Sanity check: ensure production env mode is present
const stagedEnvPath = path.join(stageFunctions, '.env');
if (!fs.existsSync(stagedEnvPath)) {
    const stagedProdTemplate = path.join(stageFunctions, '.env.instanceprod');
    if (fs.existsSync(stagedProdTemplate)) {
        fs.copyFileSync(stagedProdTemplate, stagedEnvPath);
        console.log('📄 Copied .env.instanceprod to .env for staging');
    }
}

if (!fs.existsSync(stagedEnvPath)) {
    console.warn('⚠️  No .env found in staged functions directory. Prod deployments expect .env.instanceprod to be copied earlier.');
} else {
    const envContent = fs.readFileSync(stagedEnvPath, 'utf8');
    if (!/^INSTANCE_MODE=prod$/m.test(envContent)) {
        throw new Error('Staged .env does not contain INSTANCE_MODE=prod. Aborting deployment staging.');
    }
    console.log('✅ Verified staged .env contains INSTANCE_MODE=prod');

    // Remove any environment instance templates to avoid leaking non-production configs
    fs
        .readdirSync(stageFunctions)
        .filter((fileName) => fileName.startsWith('.env.instance'))
        .forEach((fileName) => prune(path.join(stageFunctions, fileName)));
}

console.log(`\n✓ Deployment stage ready at ${stageFunctions}`);
console.log('Firebase will deploy from this staged directory.');
