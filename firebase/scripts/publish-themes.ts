#!/usr/bin/env npx tsx
/**
 * Publish themes for tenants to any environment (local or deployed).
 *
 * Usage:
 *   npx tsx scripts/publish-themes.ts <base-url> <email> <password> [--tenant-id <id>] [--default-only]
 *
 * Examples:
 *   # Local emulator
 *   npx tsx scripts/publish-themes.ts http://localhost:6005 admin@example.com password123
 *
 *   # Staging/production
 *   npx tsx scripts/publish-themes.ts https://splitifyd.web.app admin@example.com password123
 *
 *   # Single tenant
 *   npx tsx scripts/publish-themes.ts http://localhost:6005 admin@example.com password123 --tenant-id staging-tenant
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

import { SIGN_IN_WITH_PASSWORD_ENDPOINT, type ClientAppConfiguration } from '@billsplit-wl/shared';
import { ApiDriver, type ApiDriverConfig } from '@billsplit-wl/test-support';
import { logger } from './logger';
import { loadAllTenantConfigs, loadTenantConfig, type TenantConfig } from './load-tenant-configs';

interface PublishOptions {
    baseUrl: string;
    email: string;
    password: string;
    tenantId?: string;
    defaultOnly?: boolean;
}

async function fetchApiKey(baseUrl: string): Promise<string> {
    const apiUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
    logger.info('Fetching API key from bootstrap-config...', { url: `${apiUrl}/bootstrap-config` });

    const configResponse = await fetch(`${apiUrl}/bootstrap-config`);
    if (!configResponse.ok) {
        throw new Error(`Failed to fetch config from ${apiUrl}/bootstrap-config: ${configResponse.status} ${configResponse.statusText}`);
    }

    const appConfig: ClientAppConfiguration = await configResponse.json();
    return appConfig.firebase.apiKey;
}

async function authenticateAdmin(apiDriver: ApiDriver, email: string, password: string): Promise<string> {
    const config = (apiDriver as any).config as ApiDriverConfig;
    const signInResponse = await fetch(`${config.authBaseUrl}${SIGN_IN_WITH_PASSWORD_ENDPOINT}?key=${config.firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            password,
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

async function publishTenantTheme(api: ApiDriver, adminToken: string, tenantId: string): Promise<boolean> {
    const response = await api.listAllTenants(adminToken);
    const tenant = response.tenants.find((t: any) => t.tenant.tenantId === tenantId);

    if (!tenant) {
        logger.warn(`Tenant ${tenantId} does not exist. Create it via TenantEditorModal first.`);
        return false;
    }

    if (!tenant.brandingTokens?.tokens) {
        logger.warn(`Tenant ${tenantId} has no branding tokens. Configure theme via TenantEditorModal first.`);
        return false;
    }

    logger.info(`Publishing theme for ${tenantId}...`);
    const publishResult = await api.publishTenantTheme({ tenantId }, adminToken);
    logger.info(`  Published hash ${publishResult.artifact.hash}`);
    return true;
}

/**
 * Publish themes for local emulator using default admin user.
 * This is a convenience wrapper for test-data-generator and npm scripts.
 */
export async function publishLocalThemes(options?: { defaultOnly?: boolean; tenantId?: string }): Promise<void> {
    const apiDriver = await ApiDriver.create();

    logger.info('Authenticating default admin...');
    const admin = await apiDriver.getDefaultAdminUser();
    logger.info(`  Authenticated as ${admin.email}`);

    // Determine which tenants to publish
    let configs: TenantConfig[];
    if (options?.tenantId) {
        const config = loadTenantConfig(options.tenantId);
        if (!config) {
            throw new Error(`Tenant '${options.tenantId}' not found in docs/tenants/`);
        }
        configs = [config];
    } else {
        configs = loadAllTenantConfigs();
        if (options?.defaultOnly) {
            configs = configs.filter((c) => c.isDefault === true);
        }
    }

    let published = 0;
    let skipped = 0;

    for (const config of configs) {
        try {
            const success = await publishTenantTheme(apiDriver, admin.token, config.id);
            if (success) {
                published++;
            } else {
                skipped++;
            }
        } catch (error) {
            logger.error(`Failed to publish theme for ${config.id}`, { error });
            skipped++;
        }
    }

    if (published > 0) {
        logger.info(`Published ${published} theme(s)`);
    }
    if (skipped > 0) {
        logger.warn(`Skipped ${skipped} tenant(s)`);
    }
}

export async function publishThemes(options: PublishOptions): Promise<void> {
    const { baseUrl, email, password, tenantId, defaultOnly } = options;

    logger.info('Publishing themes...', { baseUrl, email });

    // Get API key from the app
    const apiKey = await fetchApiKey(baseUrl);

    // Create ApiDriver
    const apiUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
    const driverConfig: ApiDriverConfig = {
        baseUrl: apiUrl,
        firebaseApiKey: apiKey,
        authBaseUrl: 'https://identitytoolkit.googleapis.com',
    };
    const apiDriver = new ApiDriver(driverConfig);

    // Authenticate
    logger.info('Authenticating...', { email });
    const token = await authenticateAdmin(apiDriver, email, password);
    logger.info('  Authenticated as admin');

    // Determine which tenants to publish
    let configs: TenantConfig[];
    if (tenantId) {
        const config = loadTenantConfig(tenantId);
        if (!config) {
            throw new Error(`Tenant '${tenantId}' not found in docs/tenants/`);
        }
        configs = [config];
        logger.info(`Publishing single tenant: ${tenantId}`);
    } else {
        configs = loadAllTenantConfigs();
        if (defaultOnly) {
            configs = configs.filter((c) => c.isDefault === true);
            logger.info('Publishing default tenant only');
        } else {
            logger.info(`Publishing all ${configs.length} tenants`);
        }
    }

    let published = 0;
    let skipped = 0;

    for (const config of configs) {
        try {
            const success = await publishTenantTheme(apiDriver, token, config.id);
            if (success) {
                published++;
            } else {
                skipped++;
            }
        } catch (error) {
            logger.error(`Failed to publish theme for ${config.id}`, { error });
            skipped++;
        }
    }

    if (published > 0) {
        logger.info(`Published ${published} theme(s)`);
    }
    if (skipped > 0) {
        logger.warn(`Skipped ${skipped} tenant(s)`);
    }
    if (published === 0 && skipped === 0) {
        logger.info('No tenants found to publish');
    }
}

function parseArgs(): PublishOptions {
    const args = process.argv.slice(2);

    // Parse flags
    let tenantId: string | undefined;
    let defaultOnly = false;
    const positionalArgs: string[] = [];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--tenant-id' && i + 1 < args.length) {
            tenantId = args[++i];
        } else if (args[i] === '--default-only') {
            defaultOnly = true;
        } else if (!args[i].startsWith('--')) {
            positionalArgs.push(args[i]);
        }
    }

    const [baseUrl, email, password] = positionalArgs;

    if (!baseUrl || !email || !password) {
        console.error('Usage: npx tsx scripts/publish-themes.ts <base-url> <email> <password> [--tenant-id <id>] [--default-only]');
        console.error('');
        console.error('Examples:');
        console.error('  npx tsx scripts/publish-themes.ts http://localhost:6005 admin@example.com password123');
        console.error('  npx tsx scripts/publish-themes.ts https://splitifyd.web.app admin@example.com password123');
        console.error('  npx tsx scripts/publish-themes.ts http://localhost:6005 admin@example.com password123 --tenant-id staging-tenant');
        process.exit(1);
    }

    return { baseUrl, email, password, tenantId, defaultOnly };
}

async function main(): Promise<void> {
    const options = parseArgs();
    await publishThemes(options);
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Theme publishing failed');
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
        process.exit(1);
    });
}
