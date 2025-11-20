#!/usr/bin/env npx tsx

import * as admin from 'firebase-admin';
import { getEnvironment, initializeFirebase } from './firebase-init';
import { logger } from './logger';

async function setupStorageBucket(): Promise<void> {
    const env = getEnvironment();
    initializeFirebase(env);

    logger.info('🪣 Setting up Cloud Storage bucket for static assets...');

    const storage = admin.storage();
    const bucket = storage.bucket();

    logger.info(`   Environment: ${env.environment}`);
    logger.info(`   Bucket: ${bucket.name}`);

    // Skip setup for emulator - buckets are auto-created on first write
    if (env.isEmulator) {
        logger.info('   ℹ️  Emulator mode: bucket will be auto-created on first write');
        logger.info('✅ Storage bucket setup skipped for emulator');
        return;
    }

    // Check if bucket exists
    const [exists] = await bucket.exists();

    if (!exists) {
        logger.error('❌ Default bucket does not exist');
        logger.error('   Create it in Firebase Console: Storage > Get Started');
        process.exit(1);
    }

    // Create theme-artifacts directory structure (metadata marker)
    const markerFile = bucket.file('theme-artifacts/.initialized');
    const [markerExists] = await markerFile.exists();

    if (!markerExists) {
        await markerFile.save('Theme artifacts storage initialized', {
            metadata: {
                contentType: 'text/plain',
                cacheControl: 'public, max-age=31536000',
            },
        });
        logger.info('   ✓ Created theme-artifacts directory structure');
    } else {
        logger.info('   ✓ theme-artifacts directory already exists');
    }

    // Set CORS configuration for static asset delivery (theme CSS, images, etc.)
    // Allow all origins since files are publicly readable
    await bucket.setCorsConfiguration([
        {
            origin: ['*'],
            method: ['GET', 'HEAD'],
            responseHeader: ['Content-Type', 'Cache-Control', 'ETag'],
            maxAgeSeconds: 3600,
        },
    ]);
    logger.info('   ✓ CORS configuration updated (allows all origins)');

    logger.info('✅ Storage bucket ready!');
    logger.info(`   Bucket: ${bucket.name}`);
    logger.info('   Paths:');
    logger.info('     - theme-artifacts/{tenantId}/{hash}/theme.css');
    logger.info('     - theme-artifacts/{tenantId}/{hash}/tokens.json');
    logger.info('     - tenant-assets/{tenantId}/logo.{ext} (future)');
    logger.info('     - tenant-assets/{tenantId}/favicon.{ext} (future)');
    logger.info('   Note: Files are publicly readable (read-only access)');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('❌ Usage: setup-storage-bucket.ts <emulator|production>');
        process.exit(1);
    }

    await setupStorageBucket();
}

if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Bucket setup failed:', error);
        process.exit(1);
    });
}
