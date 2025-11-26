#!/usr/bin/env npx tsx
/**
 * Publish themes for staging tenants to deployed Firebase
 *
 * ARCHITECTURE NOTE:
 * This script does NOT define theme values in code.
 * ALL theme values must come from Firestore, set via TenantEditorModal.
 *
 * This script:
 * 1. Reads existing tenants from Firestore
 * 2. Publishes their theme CSS artifacts
 *
 * To create a new tenant with theme, use the TenantEditorModal UI.
 */

import { logger } from '../functions/src/logger';

export async function publishStagingThemes(): Promise<void> {
    logger.info('🎨 Publishing themes for staging tenants...');

    // Just call sync-tenant-configs which uses TenantAdminService properly
    const { buildServices, syncTenantConfigs } = await import('./sync-tenant-configs');
    const { parseEnvironment, initializeFirebase } = await import('./firebase-init');

    const env = parseEnvironment(['staging']);
    initializeFirebase(env);

    const services = await buildServices(env);

    // Sync staging-tenant which will publish the theme from existing Firestore data
    // Note: If tenant doesn't exist, it must be created via TenantEditorModal first
    await syncTenantConfigs(services, { tenantId: 'staging-tenant' });

    logger.info('✅ Staging themes published successfully');
    logger.info(`  - staging-tenant: Theme published from Firestore data`);
}

async function main(): Promise<void> {
    await publishStagingThemes();
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Staging theme publishing script failed');
        console.error('Error details:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
        logger.error('Staging theme publishing script failed', { error });
        process.exit(1);
    });
}
