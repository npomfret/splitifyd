#!/usr/bin/env npx tsx
/**
 * Sync tenant configurations from tenant-configs.json to Firestore via API.
 *
 * Usage:
 *   ./scripts/sync-tenant-configs.ts <emulator|production> [--default-only]
 *
 * Flags:
 *   --default-only: Only sync the default tenant (isDefault: true)
 *   --tenant-id <id>: Only sync specific tenant by ID
 *   --skip-theme-publish: Skip theme publishing step
 */
import {
    type AdminUpsertTenantRequest,
    type TenantBranding,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantSurfaceColor,
    toTenantTextColor,
} from '@billsplit-wl/shared';
import { ApiDriver, type ApiDriverConfig } from '@billsplit-wl/test-support';
import * as fs from 'fs';
import * as path from 'path';

interface TenantConfig {
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
    brandingTokens: TenantBranding;
    isDefault: boolean;
}

interface SyncTenantOptions {
    defaultOnly?: boolean;
    tenantId?: string;
    skipThemePublish?: boolean;
}

/**
 * Get content type from file extension
 */
function getContentTypeFromExtension(ext: string): string {
    const map: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
    };
    return map[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Upload an image file to Storage via API if the URL starts with "file://".
 * Otherwise, return the URL as-is.
 */
async function uploadAssetIfLocal(
    apiDriver: ApiDriver,
    tenantId: string,
    assetType: 'logo' | 'favicon',
    urlOrPath: string,
    adminToken: string,
): Promise<string> {
    if (urlOrPath.startsWith('file://')) {
        const filePath = urlOrPath.slice('file://'.length);
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`);
        }

        const buffer = fs.readFileSync(absolutePath);
        const contentType = getContentTypeFromExtension(path.extname(absolutePath));

        console.log(`  📤 Uploading ${assetType}: ${path.basename(absolutePath)}`);
        const result = await apiDriver.uploadTenantImage(tenantId, assetType, buffer, contentType, adminToken);
        console.log(`     ✓ Uploaded to: ${result.url}`);
        return result.url;
    }

    return urlOrPath;
}

/**
 * Create ApiDriver configured for either emulator or deployed environment
 */
async function createApiDriver(isEmulator: boolean): Promise<ApiDriver> {
    if (isEmulator) {
        return await ApiDriver.create();
    }

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
    return new ApiDriver(deployedConfig);
}

/**
 * Sync tenant configurations using the Admin API
 */
export async function syncTenantConfigs(
    apiDriver: ApiDriver,
    adminToken: string,
    options?: SyncTenantOptions,
): Promise<void> {
    const configPath = path.join(__dirname, 'tenant-configs.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    let configs: TenantConfig[] = JSON.parse(configData);

    // Filter based on options
    if (options?.defaultOnly) {
        configs = configs.filter((c) => c.isDefault === true);
        console.log('🔄 Syncing default tenant only...');
    } else if (options?.tenantId) {
        configs = configs.filter((c) => c.id === options.tenantId);
        if (configs.length === 0) {
            throw new Error(`Tenant '${options.tenantId}' not found in tenant-configs.json`);
        }
        console.log(`🔄 Syncing tenant: ${options.tenantId}...`);
    } else {
        console.log('🔄 Syncing all tenant configurations from JSON...');
    }

    // Normalize domains (remove port for storage)
    const normalizeDomain = (domain: string): string => {
        return domain.replace(/:\d+$/, '');
    };

    for (const config of configs) {
        const domains = config.domains.map((d) => toTenantDomainName(normalizeDomain(d)));

        // Upload assets if they are local files
        const logoUrl = await uploadAssetIfLocal(
            apiDriver,
            config.id,
            'logo',
            config.branding.logoUrl,
            adminToken,
        );
        const faviconUrl = await uploadAssetIfLocal(
            apiDriver,
            config.id,
            'favicon',
            config.branding.faviconUrl,
            adminToken,
        );

        // Validate brandingTokens are present
        if (!config.brandingTokens) {
            throw new Error(`Tenant '${config.id}' is missing required brandingTokens in tenant-configs.json`);
        }

        // Build request object
        const request: AdminUpsertTenantRequest = {
            tenantId: toTenantId(config.id),
            branding: {
                appName: toTenantAppName(config.branding.appName),
                logoUrl: toTenantLogoUrl(logoUrl),
                faviconUrl: toTenantFaviconUrl(faviconUrl),
                primaryColor: toTenantPrimaryColor(config.branding.primaryColor),
                secondaryColor: toTenantSecondaryColor(config.branding.secondaryColor),
                ...(config.branding.accentColor && {
                    accentColor: toTenantAccentColor(config.branding.accentColor),
                }),
                ...(config.branding.surfaceColor && {
                    surfaceColor: toTenantSurfaceColor(config.branding.surfaceColor),
                }),
                ...(config.branding.textColor && {
                    textColor: toTenantTextColor(config.branding.textColor),
                }),
                marketingFlags: {
                    showLandingPage: toShowLandingPageFlag(config.branding.marketingFlags?.showLandingPage ?? false),
                    showMarketingContent: toShowMarketingContentFlag(config.branding.marketingFlags?.showMarketingContent ?? false),
                    showPricingPage: toShowPricingPageFlag(config.branding.marketingFlags?.showPricingPage ?? false),
                },
            },
            brandingTokens: config.brandingTokens,
            domains,
            defaultTenant: toTenantDefaultFlag(config.isDefault),
        };

        // Upsert tenant via Admin API
        try {
            const result = await apiDriver.adminUpsertTenant(request, adminToken);
            console.log(`  ✓ ${result.created ? 'Created' : 'Updated'} tenant: ${config.id} (${config.branding.appName})`);
        } catch (error) {
            console.error(`  ✗ Failed to sync tenant: ${config.id}`);
            throw error;
        }

        // Publish theme CSS via API (if not skipped)
        if (!options?.skipThemePublish) {
            try {
                const publishResult = await apiDriver.publishTenantTheme({ tenantId: config.id }, adminToken);
                console.log(`  ✓ Published theme: ${publishResult.artifact.hash}`);
            } catch (error) {
                console.error(`  ✗ Failed to publish theme for tenant: ${config.id}`);
                throw error;
            }
        }
    }

    console.log('✅ Tenant configurations synced successfully');
}

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2);
    const defaultOnly = rawArgs.includes('--default-only');
    const skipThemePublish = rawArgs.includes('--skip-theme-publish');

    // Parse --tenant-id flag
    const tenantIdIndex = rawArgs.indexOf('--tenant-id');
    let tenantId: string | undefined;
    if (tenantIdIndex !== -1 && tenantIdIndex + 1 < rawArgs.length) {
        tenantId = rawArgs[tenantIdIndex + 1];
    }

    // Determine environment from first positional argument
    const argsWithoutFlags = rawArgs.filter((arg) => !arg.startsWith('--') && arg !== tenantId);
    const targetEnvironment = argsWithoutFlags[0];

    if (!targetEnvironment || !['emulator', 'staging', 'deployed'].includes(targetEnvironment)) {
        console.error('❌ Usage: sync-tenant-configs.ts <emulator|staging> [--default-only] [--tenant-id <id>] [--skip-theme-publish]');
        process.exit(1);
    }

    const isEmulator = targetEnvironment === 'emulator';
    console.log(`🎯 Syncing tenant configs to ${isEmulator ? 'EMULATOR' : 'DEPLOYED'}`);

    // Create ApiDriver for API calls
    const apiDriver = await createApiDriver(isEmulator);

    // Get admin user token for API calls
    console.log('🔑 Authenticating admin user...');
    const adminUser = await apiDriver.getDefaultAdminUser();
    console.log(`   ✓ Authenticated as admin`);

    await syncTenantConfigs(apiDriver, adminUser.token, { defaultOnly, tenantId, skipThemePublish });

    console.log('✅ Tenant sync complete');
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Tenant config sync failed:', error);
        process.exit(1);
    });
}
