#!/usr/bin/env tsx

import { getProjectId } from '@billsplit-wl/test-support';
import { loadRuntimeConfig } from '../shared/scripts-config';
import { getEnvironmentForModule, initializeFirebase } from './firebase-init';
import { seedPolicies } from './seed-policies';
import { generateFullTestData } from './test-data-generator';

// Load and validate runtime configuration
loadRuntimeConfig();

// Set GCLOUD_PROJECT if not already set
if (!process.env.GCLOUD_PROJECT) {
    try {
        const projectId = getProjectId();
        process.env.GCLOUD_PROJECT = projectId;
        console.log(`📦 Set GCLOUD_PROJECT to ${projectId}`);
    } catch (error) {
        console.error('❌ Failed to get project ID from firebase.json');
        process.exit(1);
    }
}

async function main(): Promise<void> {
    // Initialize Firebase
    const env = getEnvironmentForModule();
    initializeFirebase(env);

    // Seed policies first so they're available during user registration
    console.log('\n📚 Seeding policies before user creation...');
    await seedPolicies();

    await generateFullTestData();
}

main();
