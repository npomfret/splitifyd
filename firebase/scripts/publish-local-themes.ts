#!/usr/bin/env npx tsx

/**
 * Publishes theme CSS for existing local tenants.
 *
 * ARCHITECTURE NOTE:
 * This script does NOT create tenants or define theme values.
 * ALL theme values must come from Firestore, set via TenantEditorModal.
 *
 * This script:
 * 1. Reads existing tenants from Firestore
 * 2. Publishes their theme CSS artifacts
 *
 * To create a new tenant with theme, use the TenantEditorModal UI.
 */

import { ApiDriver } from '@billsplit-wl/test-support';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

type TenantConfig = {
    id: string;
    domains: string[];
    branding: {
        appName: string;
        logoUrl: string;
        faviconUrl: string;
        primaryColor: string;
        secondaryColor: string;
        accentColor?: string;
        surfaceColor?: string;
        textColor?: string;
        marketingFlags?: {
            showLandingPage?: boolean;
            showMarketingContent?: boolean;
            showPricingPage?: boolean;
        };
    };
    isDefault: boolean;
};

// Load tenant IDs from config (just for reference, not for theme data)
function loadTenantConfigs(): TenantConfig[] {
    const configPath = path.join(__dirname, 'tenant-configs.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
}

async function publishTenantTheme(api: ApiDriver, adminToken: string, tenantId: string): Promise<void> {
    // Check if tenant exists
    const response = await api.listAllTenants(adminToken);
    const tenant = response.tenants.find((t: any) => t.tenant.tenantId === tenantId);

    if (!tenant) {
        logger.warn(`⚠️  Tenant ${tenantId} does not exist. Create it via TenantEditorModal first.`);
        return;
    }

    if (!tenant.brandingTokens?.tokens) {
        logger.warn(`⚠️  Tenant ${tenantId} has no branding tokens. Configure theme via TenantEditorModal first.`);
        return;
    }

    logger.info(`→ Publishing theme for ${tenantId}`);
    const publishResult = await api.publishTenantTheme({ tenantId }, adminToken);
    logger.info(`   ✓ Published hash ${publishResult.artifact.hash}`);
}

export async function publishLocalThemes(options?: { defaultOnly?: boolean; }): Promise<void> {
    const apiDriver = new ApiDriver();

    logger.info('Authenticating default admin (Bill Splitter)…');
    const admin = await apiDriver.getDefaultAdminUser();
    logger.info(`Authenticated as ${admin.email}`);

    // Get tenant IDs from config
    const configs = loadTenantConfigs();
    const tenantsToPublish = options?.defaultOnly
        ? configs.filter(c => c.isDefault === true)
        : configs;

    let published = 0;
    let skipped = 0;

    for (const config of tenantsToPublish) {
        try {
            await publishTenantTheme(apiDriver, admin.token, config.id);
            published++;
        } catch (error) {
            logger.error(`Failed to publish theme for ${config.id}`, { error });
            skipped++;
        }
    }

    if (published > 0) {
        logger.info(`✅ Published ${published} theme(s).`);
    }
    if (skipped > 0) {
        logger.warn(`⚠️  Skipped ${skipped} tenant(s). Create them via TenantEditorModal.`);
    }
    if (published === 0 && skipped === 0) {
        logger.info('No tenants found to publish. Create tenants via TenantEditorModal first.');
    }
}

async function main(): Promise<void> {
    await publishLocalThemes();
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        logger.error('Theme publishing script failed', { error });
        process.exit(1);
    });
}
