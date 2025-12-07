import { execSync } from 'child_process';

const MIN_VERSION = '14.14.0'; // Version that fixed firebase-functions v7 emulator support

function parseVersion(version: string): number[] {
    return version.split('.').map(Number);
}

function compareVersions(a: string, b: string): number {
    const partsA = parseVersion(a);
    const partsB = parseVersion(b);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const partA = partsA[i] || 0;
        const partB = partsB[i] || 0;
        if (partA > partB) return 1;
        if (partA < partB) return -1;
    }
    return 0;
}

try {
    const version = execSync('firebase --version', { encoding: 'utf8' }).trim();

    if (compareVersions(version, MIN_VERSION) < 0) {
        console.error(`\x1b[31m
================================================================================
ERROR: firebase-tools version ${version} is too old.

firebase-functions v7 requires firebase-tools >= ${MIN_VERSION}
Your version: ${version}

Fix: npm install -g firebase-tools@latest
================================================================================
\x1b[0m`);
        process.exit(1);
    }

    console.log(`firebase-tools version ${version} OK`);
} catch {
    console.error(`\x1b[31m
================================================================================
ERROR: firebase-tools not found.

Install: npm install -g firebase-tools
================================================================================
\x1b[0m`);
    process.exit(1);
}
