#!/usr/bin/env npx tsx
/**
 * Publish themes for staging tenants to deployed Firebase
 *
 * Usage:
 *   GCLOUD_PROJECT=splitifyd tsx scripts/publish-staging-themes.ts <email> <password>
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

import {SIGN_IN_WITH_PASSWORD_ENDPOINT, type ClientAppConfiguration, type Email } from '@billsplit-wl/shared';
import { ApiDriver, type ApiDriverConfig } from '@billsplit-wl/test-support';
import { logger } from '../functions/src/logger';

interface AdminCredentials {
    email: string;
    password: string;
}

async function authenticateAdmin(apiDriver: ApiDriver, credentials: AdminCredentials): Promise<string> {
    // Use Firebase Auth REST API to sign in
    const config = (apiDriver as any).config as ApiDriverConfig;
    const signInResponse = await fetch(`${config.authBaseUrl}${SIGN_IN_WITH_PASSWORD_ENDPOINT}?key=${config.firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            returnSecureToken: true,
        }),
    });

    if (!signInResponse.ok) {
        const error = (await signInResponse.json()) as { error?: { message?: string } };
        throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
    }

    const authData = (await signInResponse.json()) as { idToken: string };
    return authData.idToken;
}

export async function publishStagingThemes(credentials: AdminCredentials): Promise<void> {
    logger.info('🎨 Publishing themes for staging tenants...');

    const { syncTenantConfigs } = await import('./sync-tenant-configs');

    // Create ApiDriver for deployed environment
    const projectId = process.env.GCLOUD_PROJECT;
    if (!projectId) {
        throw new Error('GCLOUD_PROJECT must be set for deployed environments');
    }

    // Fetch config from deployed app (API key is public, served to every browser)
    const baseUrl = `https://${projectId}.web.app/api`;
    logger.info('🔍 Fetching config from deployed app...', { baseUrl });
    const configResponse = await fetch(`${baseUrl}/bootstrap-config`);
    if (!configResponse.ok) {
        throw new Error(`Failed to fetch config from ${baseUrl}/bootstrap-config: ${configResponse.status} ${configResponse.statusText}`);
    }
    const appConfig: ClientAppConfiguration = await configResponse.json();

    const deployedConfig: ApiDriverConfig = {
        baseUrl,
        firebaseApiKey: appConfig.firebase.apiKey,
        authBaseUrl: 'https://identitytoolkit.googleapis.com',
    };
    const apiDriver = new ApiDriver(deployedConfig);

    // Authenticate admin user
    logger.info('🔑 Authenticating admin user...', { email: credentials.email });
    const token = await authenticateAdmin(apiDriver, credentials);
    logger.info('   ✓ Authenticated as admin');

    // Sync staging-tenant which will publish the theme from existing Firestore data
    // Note: If tenant doesn't exist, it must be created via TenantEditorModal first
    await syncTenantConfigs(apiDriver, token, { tenantId: 'staging-tenant' });

    logger.info('✅ Staging themes published successfully');
    logger.info(`  - staging-tenant: Theme published from Firestore data`);
}

async function main(): Promise<void> {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        console.error('Usage: GCLOUD_PROJECT=<project> tsx scripts/publish-staging-themes.ts <email> <password>');
        console.error('Example: GCLOUD_PROJECT=splitifyd tsx scripts/publish-staging-themes.ts admin@example.com mypassword');
        process.exit(1);
    }

    await publishStagingThemes({ email, password });
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
