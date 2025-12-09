#!/usr/bin/env npx tsx
/**
 * Sync tenant configurations from docs/tenants/ to Firestore via API.
 *
 * Usage:
 *   npx tsx scripts/sync-tenant-configs.ts <base-url> <email> <password> [options]
 *
 * Examples:
 *   # Local emulator (using default admin user)
 *   npx tsx scripts/sync-tenant-configs.ts http://localhost:6005 test1@test.com passwordpass
 *
 *   # Staging/production
 *   npx tsx scripts/sync-tenant-configs.ts https://splitifyd.web.app admin@example.com yourpassword
 *
 *   # Single tenant
 *   npx tsx scripts/sync-tenant-configs.ts http://localhost:6005 test1@test.com passwordpass --tenant-id staging-tenant
 *
 * Options:
 *   --default-only: Only sync the default tenant (isDefault: true)
 *   --tenant-id <id>: Only sync specific tenant by ID
 *   --skip-theme-publish: Skip theme publishing step
 */
import {
    type AdminUpsertTenantRequest,
    type ClientAppConfiguration,
    SIGN_IN_WITH_PASSWORD_ENDPOINT,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAccentColor,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantId,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@billsplit-wl/shared';
import { ApiDriver, type ApiDriverConfig, emulatorHostingURL } from '@billsplit-wl/test-support';
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
 * Fetch Firebase API key from the app's bootstrap-config endpoint.
 */
async function fetchApiKey(baseUrl: string): Promise<string> {
    const apiUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
    console.log(`🔑 Fetching API key from ${apiUrl}/bootstrap-config...`);

    const configResponse = await fetch(`${apiUrl}/bootstrap-config`);
    if (!configResponse.ok) {
        throw new Error(`Failed to fetch config from ${apiUrl}/bootstrap-config: ${configResponse.status} ${configResponse.statusText}`);
    }

    const appConfig: ClientAppConfiguration = await configResponse.json();
    return appConfig.firebase.apiKey;
}

/**
 * Authenticate with email/password via Firebase REST API.
 */
async function authenticateWithCredentials(
    apiDriver: ApiDriver,
    email: string,
    password: string,
): Promise<string> {
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
        const error = (await signInResponse.json()) as { error?: { message?: string; }; };
        throw new Error(`Authentication failed: ${error.error?.message || 'Unknown error'}`);
    }

    const authData = (await signInResponse.json()) as { idToken: string; };
    return authData.idToken;
}

/**
 * Create ApiDriver from base URL by fetching config from bootstrap-config endpoint.
 */
async function createApiDriverFromUrl(baseUrl: string): Promise<ApiDriver> {
    const apiKey = await fetchApiKey(baseUrl);
    const apiUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;

    // Determine auth base URL - use emulator auth if localhost, otherwise production
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    // For localhost, we need to fetch the full config to get the auth emulator URL
    let authBaseUrl = 'https://identitytoolkit.googleapis.com';
    if (isLocalhost) {
        const configResponse = await fetch(`${apiUrl}/bootstrap-config`);
        if (configResponse.ok) {
            const appConfig: ClientAppConfiguration = await configResponse.json();
            if (appConfig.firebaseAuthUrl) {
                authBaseUrl = `${appConfig.firebaseAuthUrl}/identitytoolkit.googleapis.com`;
            }
        }
    }

    const driverConfig: ApiDriverConfig = {
        baseUrl: apiUrl,
        firebaseApiKey: apiKey,
        authBaseUrl,
    };
    return new ApiDriver(driverConfig);
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

        // Upload assets if they are local files (only if configured in brandingTokens.tokens.assets)
        // Falls back to library assets if not explicitly configured
        const configuredLogoUrl = config.brandingTokens.tokens?.assets?.logoUrl;
        const configuredFaviconUrl = config.brandingTokens.tokens?.assets?.faviconUrl;
        let logoUrl = configuredLogoUrl
            ? await uploadAssetIfLocal(apiDriver, config.id, 'logo', configuredLogoUrl, adminToken)
            : libraryAssets.logoUrl;
        let faviconUrl = configuredFaviconUrl
            ? await uploadAssetIfLocal(apiDriver, config.id, 'favicon', configuredFaviconUrl, adminToken)
            : libraryAssets.faviconUrl;

        // Copy brandingTokens and update assets with resolved URLs
        const brandingTokens = { ...config.brandingTokens };
        if (brandingTokens.tokens?.assets) {
            // Override assets with resolved URLs from library
            if (logoUrl) {
                brandingTokens.tokens.assets.logoUrl = logoUrl;
            }
            if (faviconUrl) {
                brandingTokens.tokens.assets.faviconUrl = faviconUrl;
            }
        }

        // Build request object
        const request: AdminUpsertTenantRequest = {
            tenantId: toTenantId(config.id),
            branding: {
                primaryColor: toTenantPrimaryColor(config.branding.primaryColor),
                secondaryColor: toTenantSecondaryColor(config.branding.secondaryColor),
                ...(config.branding.accentColor && {
                    accentColor: toTenantAccentColor(config.branding.accentColor),
                }),
            },
            marketingFlags: {
                showMarketingContent: toShowMarketingContentFlag(config.marketingFlags?.showMarketingContent ?? false),
                showPricingPage: toShowPricingPageFlag(config.marketingFlags?.showPricingPage ?? false),
            },
            brandingTokens,
            domains,
            defaultTenant: toTenantDefaultFlag(config.isDefault),
        };

        // Upsert tenant via Admin API
        try {
            const result = await apiDriver.adminUpsertTenant(request, adminToken);
            const appName = config.brandingTokens.tokens.legal.appName;
            console.log(`  ✓ ${result.created ? 'Created' : 'Updated'} tenant: ${config.id} (${appName})`);
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

/**
 * Sync tenant configurations for local emulator using default admin user.
 * This is a convenience function for npm scripts and test-data-generator.
 * Auto-detects the emulator URL from firebase.json.
 */
export async function syncLocalTenantConfigs(options?: SyncTenantOptions): Promise<void> {
    const baseUrl = emulatorHostingURL();
    console.log(`🎯 Syncing tenant configs to local emulator at ${baseUrl}`);

    const apiDriver = await ApiDriver.create();

    console.log('🔑 Authenticating default admin...');
    const admin = await apiDriver.getDefaultAdminUser();
    console.log(`   ✓ Authenticated as ${admin.email}`);

    await syncTenantConfigs(apiDriver, admin.token, options);
}

interface CliOptions {
    baseUrl: string;
    email: string;
    password: string;
    defaultOnly: boolean;
    skipThemePublish: boolean;
    tenantId?: string;
}

function parseArgs(): CliOptions {
    const args = process.argv.slice(2);

    // Parse flags
    let tenantId: string | undefined;
    let defaultOnly = false;
    let skipThemePublish = false;
    const positionalArgs: string[] = [];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--tenant-id' && i + 1 < args.length) {
            tenantId = args[++i];
        } else if (args[i] === '--default-only') {
            defaultOnly = true;
        } else if (args[i] === '--skip-theme-publish') {
            skipThemePublish = true;
        } else if (!args[i].startsWith('--')) {
            positionalArgs.push(args[i]);
        }
    }

    const [baseUrl, email, password] = positionalArgs;

    if (!baseUrl || !email || !password) {
        console.error('Usage: npx tsx scripts/sync-tenant-configs.ts <base-url> <email> <password> [options]');
        console.error('');
        console.error('Examples:');
        console.error('  npx tsx scripts/sync-tenant-configs.ts http://localhost:6005 test1@test.com passwordpass');
        console.error('  npx tsx scripts/sync-tenant-configs.ts https://splitifyd.web.app admin@example.com yourpassword');
        console.error('  npx tsx scripts/sync-tenant-configs.ts http://localhost:6005 test1@test.com passwordpass --tenant-id staging-tenant');
        console.error('');
        console.error('Options:');
        console.error('  --default-only         Only sync the default tenant');
        console.error('  --tenant-id <id>       Only sync specific tenant by ID');
        console.error('  --skip-theme-publish   Skip theme publishing step');
        process.exit(1);
    }

    return { baseUrl, email, password, tenantId, defaultOnly, skipThemePublish };
}

async function main(): Promise<void> {
    const options = parseArgs();
    const { baseUrl, email, password, tenantId, defaultOnly, skipThemePublish } = options;

    console.log(`🎯 Syncing tenant configs to ${baseUrl}`);

    // Create ApiDriver from base URL
    const apiDriver = await createApiDriverFromUrl(baseUrl);

    // Authenticate with provided credentials
    console.log(`🔑 Authenticating as ${email}...`);
    const token = await authenticateWithCredentials(apiDriver, email, password);
    console.log('   ✓ Authenticated');

    await syncTenantConfigs(apiDriver, token, { defaultOnly, tenantId, skipThemePublish });

    console.log('✅ Tenant sync complete');
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Tenant config sync failed:', error);
        process.exit(1);
    });
}
