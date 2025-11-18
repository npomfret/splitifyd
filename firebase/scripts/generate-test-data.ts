#!/usr/bin/env tsx

import { getProjectId } from '@billsplit-wl/test-support';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { requireInstanceMode } from '../functions/src/shared/instance-mode';
import { getEnvironmentForModule, initializeFirebase } from './firebase-init';
import { generateFullTestData } from './test-data-generator';

// Load environment
const envPath = path.join(__dirname, '../functions/.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

requireInstanceMode();

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

    await generateFullTestData();
}

main();
