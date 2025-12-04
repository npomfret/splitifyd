#!/usr/bin/env npx tsx
/**
 * Sync tenant configurations from docs/tenants/ to Firestore via API.
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
import { getTenantDirectory, loadAllTenantConfigs, loadTenantConfig, type TenantConfig } from './lib/load-tenant-configs';

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

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp', '.gif'];

interface LibraryUploadResult {
    logoUrl?: string;
    faviconUrl?: string;
}

/**
 * Upload all image files from the tenant directory to the tenant's image library.
 * Skips images that already exist in the library (by name) to avoid duplicates.
 * Returns URLs for images named "logo" and "favicon" so they can be auto-assigned.
 */
async function uploadLibraryImagesFromDirectory(
    apiDriver: ApiDriver,
    tenantId: string,
    adminToken: string,
): Promise<LibraryUploadResult> {
    const tenantDir = getTenantDirectory(tenantId);
    const result: LibraryUploadResult = {};

    // Get existing library images to avoid duplicates
    const existingImages = await apiDriver.listTenantImages(tenantId, adminToken);
    const existingByName = new Map(existingImages.images.map((img) => [img.name, img.url]));

    // Check if logo/favicon already exist in library
    if (existingByName.has('logo')) {
        result.logoUrl = existingByName.get('logo');
    }
    if (existingByName.has('favicon')) {
        result.faviconUrl = existingByName.get('favicon');
    }

    // Find all image files in tenant directory
    const files = fs.readdirSync(tenantDir);
    const imageFiles = files.filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()));

    // Also check images/ subdirectory if it exists
    const imagesSubdir = path.join(tenantDir, 'images');
    if (fs.existsSync(imagesSubdir) && fs.statSync(imagesSubdir).isDirectory()) {
        const subdirFiles = fs.readdirSync(imagesSubdir);
        imageFiles.push(
            ...subdirFiles.filter((f) => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase())).map((f) => `images/${f}`),
        );
    }

    if (imageFiles.length === 0) {
        return result;
    }

    console.log(`  📚 Syncing image library (${imageFiles.length} files)...`);

    for (const file of imageFiles) {
        const name = path.basename(file, path.extname(file));

        if (existingByName.has(name)) {
            console.log(`     ⏭️  "${name}" already in library`);
            continue;
        }

        const filePath = path.join(tenantDir, file);
        const buffer = fs.readFileSync(filePath);
        const contentType = getContentTypeFromExtension(path.extname(file));

        console.log(`     📤 Uploading "${name}" (${file})`);
        const uploaded = await apiDriver.uploadTenantLibraryImage(tenantId, name, buffer, contentType, adminToken);

        // Track logo/favicon URLs for auto-assignment
        if (name === 'logo') {
            result.logoUrl = uploaded.image.url;
        } else if (name === 'favicon') {
            result.faviconUrl = uploaded.image.url;
        }
    }

    return result;
}

/**
 * Upload an image file to Storage via API if the URL starts with "file://".
 * Otherwise, return the URL as-is.
 *
 * Relative paths are resolved from the tenant's config directory.
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
        // Resolve relative paths from the tenant's config directory
        const tenantDir = getTenantDirectory(tenantId);
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(tenantDir, filePath);

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
    let configs: TenantConfig[];

    // Filter based on options
    if (options?.tenantId) {
        const config = loadTenantConfig(options.tenantId);
        if (!config) {
            throw new Error(`Tenant '${options.tenantId}' not found in docs/tenants/`);
        }
        configs = [config];
        console.log(`🔄 Syncing tenant: ${options.tenantId}...`);
    } else {
        configs = loadAllTenantConfigs();
        if (options?.defaultOnly) {
            configs = configs.filter((c) => c.isDefault === true);
            console.log('🔄 Syncing default tenant only...');
        } else {
            console.log('🔄 Syncing all tenant configurations from docs/tenants/...');
        }
    }

    // Normalize domains (remove port for storage)
    const normalizeDomain = (domain: string): string => {
        return domain.replace(/:\d+$/, '');
    };

    for (const config of configs) {
        const domains = config.domains.map((d) => toTenantDomainName(normalizeDomain(d)));

        // Upload images from tenant directory to image library first
        // This returns URLs for "logo" and "favicon" named files
        const libraryAssets = await uploadLibraryImagesFromDirectory(apiDriver, config.id, adminToken);

        // Upload assets if they are local files (only if configured in config.json)
        // Falls back to library assets if not explicitly configured
        let logoUrl = config.branding.logoUrl
            ? await uploadAssetIfLocal(apiDriver, config.id, 'logo', config.branding.logoUrl, adminToken)
            : libraryAssets.logoUrl;
        let faviconUrl = config.branding.faviconUrl
            ? await uploadAssetIfLocal(apiDriver, config.id, 'favicon', config.branding.faviconUrl, adminToken)
            : libraryAssets.faviconUrl;

        // Validate brandingTokens are present
        if (!config.brandingTokens) {
            throw new Error(`Tenant '${config.id}' is missing required brandingTokens in docs/tenants/${config.id}/config.json`);
        }

        // Build request object
        const request: AdminUpsertTenantRequest = {
            tenantId: toTenantId(config.id),
            branding: {
                appName: toTenantAppName(config.branding.appName),
                primaryColor: toTenantPrimaryColor(config.branding.primaryColor),
                secondaryColor: toTenantSecondaryColor(config.branding.secondaryColor),
                ...(logoUrl && { logoUrl: toTenantLogoUrl(logoUrl) }),
                ...(faviconUrl && { faviconUrl: toTenantFaviconUrl(faviconUrl) }),
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
