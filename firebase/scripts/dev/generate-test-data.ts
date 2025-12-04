#!/usr/bin/env tsx

import { loadRuntimeConfig } from '../lib/scripts-config';
import { getEnvironmentForModule, initializeFirebase } from '../lib/firebase-init';
import { generateFullTestData } from './test-data-generator';

// Load and validate runtime configuration
loadRuntimeConfig();

async function main(): Promise<void> {
    // Initialize Firebase (project ID is read from .firebaserc)
    const env = getEnvironmentForModule();
    await initializeFirebase(env);

    await generateFullTestData();
}

main();
