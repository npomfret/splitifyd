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

import { ApiDriver, type ApiDriverConfig } from '@billsplit-wl/test-support';
import { logger } from '../functions/src/logger';

export async function publishStagingThemes(): Promise<void> {
    logger.info('🎨 Publishing themes for staging tenants...');

    const { syncTenantConfigs } = await import('./sync-tenant-configs');

    // Create ApiDriver for deployed environment
    const projectId = process.env.GCLOUD_PROJECT;
    if (!projectId) {
        throw new Error('GCLOUD_PROJECT must be set for deployed environments');
    }
    const apiKey = process.env.__CLIENT_API_KEY;
    if (!apiKey) {
        throw new Error('__CLIENT_API_KEY must be set for deployed environments');
    }

    const deployedConfig: ApiDriverConfig = {
        baseUrl: `https://${projectId}.web.app/api`,
        firebaseApiKey: apiKey,
        authBaseUrl: 'https://identitytoolkit.googleapis.com',
    };
    const apiDriver = new ApiDriver(deployedConfig);

    // Get admin user token for API calls
    logger.info('🔑 Authenticating admin user...');
    const adminUser = await apiDriver.getDefaultAdminUser();
    logger.info('   ✓ Authenticated as admin');

    // Sync staging-tenant which will publish the theme from existing Firestore data
    // Note: If tenant doesn't exist, it must be created via TenantEditorModal first
    await syncTenantConfigs(apiDriver, adminUser.token, { tenantId: 'staging-tenant' });

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
