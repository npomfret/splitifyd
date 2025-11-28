#!/usr/bin/env tsx

import { loadRuntimeConfig } from './scripts-config';
import { getEnvironmentForModule, initializeFirebase } from './firebase-init';
import { seedPolicies } from './seed-policies';
import { generateFullTestData } from './test-data-generator';

// Load and validate runtime configuration
loadRuntimeConfig();

async function main(): Promise<void> {
    // Initialize Firebase (project ID is read from .firebaserc)
    const env = getEnvironmentForModule();
    initializeFirebase(env);

    // Seed policies first so they're available during user registration
    console.log('\n📚 Seeding policies before user creation...');
    await seedPolicies();

    await generateFullTestData();
}

main();
