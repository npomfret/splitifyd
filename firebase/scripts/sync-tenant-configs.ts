#!/usr/bin/env npx tsx
/**
 * Sync tenant configurations from tenant-configs.json to Firestore.
 *
 * Usage:
 *   ./scripts/sync-tenant-configs.ts <emulator|production> [--default-only]
 *
 * Flags:
 *   --default-only: Only sync the default tenant (isDefault: true)
 *   --tenant-id <id>: Only sync specific tenant by ID
 */
import {
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
    toTenantAppName,
    toTenantBackgroundColor,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantHeaderBackgroundColor,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@billsplit-wl/shared';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { getIdentityToolkitConfig } from '../functions/src/client-config';
import { getAuth, getFirestore, getStorage } from '../functions/src/firebase';
import { getServiceConfig } from '../functions/src/merge/ServiceConfig';
import type { AdminUpsertTenantRequest } from '../functions/src/schemas/tenant';
import { ComponentBuilder } from '../functions/src/services/ComponentBuilder';
import { TenantAdminService } from '../functions/src/services/tenant/TenantAdminService';
import { initializeFirebase, parseEnvironment, type ScriptEnvironment } from './firebase-init';

interface TenantConfig {
    id: string;
    domains: string[];
    branding: {
        appName: string;
        logoUrl: string;
        faviconUrl: string;
        primaryColor: string;
        secondaryColor: string;
        backgroundColor?: string;
        headerBackgroundColor?: string;
        marketingFlags?: {
            showLandingPage?: boolean;
            showMarketingContent?: boolean;
            showPricingPage?: boolean;
        };
    };
    isDefault: boolean;
}

async function buildTenantAdminService(env: ScriptEnvironment): Promise<TenantAdminService> {
    const firestore = env.isEmulator ? getFirestore() : admin.firestore();
    const auth = env.isEmulator ? getAuth() : admin.auth();
    const storage = env.isEmulator ? getStorage() : admin.storage();
    const identityToolkit = getIdentityToolkitConfig();
    const serviceConfig = getServiceConfig();

    const componentBuilder = ComponentBuilder.createComponentBuilder(
        firestore,
        auth,
        storage,
        identityToolkit,
        serviceConfig,
    );
    return componentBuilder.buildTenantAdminService();
}

async function syncTenantConfigs(
    tenantAdminService: TenantAdminService,
    options?: { defaultOnly?: boolean; tenantId?: string; },
) {
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

        // Build request object that will be validated by the schema
        const request: AdminUpsertTenantRequest = {
            tenantId: toTenantId(config.id),
            branding: {
                appName: toTenantAppName(config.branding.appName),
                logoUrl: toTenantLogoUrl(config.branding.logoUrl),
                faviconUrl: toTenantFaviconUrl(config.branding.faviconUrl),
                primaryColor: toTenantPrimaryColor(config.branding.primaryColor),
                secondaryColor: toTenantSecondaryColor(config.branding.secondaryColor),
                ...(config.branding.backgroundColor && {
                    backgroundColor: toTenantBackgroundColor(config.branding.backgroundColor),
                }),
                ...(config.branding.headerBackgroundColor && {
                    headerBackgroundColor: toTenantHeaderBackgroundColor(config.branding.headerBackgroundColor),
                }),
                marketingFlags: {
                    showLandingPage: toShowLandingPageFlag(config.branding.marketingFlags?.showLandingPage ?? false),
                    showMarketingContent: toShowMarketingContentFlag(config.branding.marketingFlags?.showMarketingContent ?? false),
                    showPricingPage: toShowPricingPageFlag(config.branding.marketingFlags?.showPricingPage ?? false),
                },
            },
            domains,
            defaultTenant: toTenantDefaultFlag(config.isDefault),
        };

        // Use the service layer which includes all validation
        try {
            const result = await tenantAdminService.upsertTenant(request);
            console.log(`  ✓ ${result.created ? 'Created' : 'Updated'} tenant: ${config.id} (${config.branding.appName})`);
        } catch (error) {
            console.error(`  ✗ Failed to sync tenant: ${config.id}`);
            throw error;
        }
    }

    console.log('✅ Tenant configurations synced successfully');
}

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2);
    const defaultOnly = rawArgs.includes('--default-only');

    // Parse --tenant-id flag
    const tenantIdIndex = rawArgs.indexOf('--tenant-id');
    let tenantId: string | undefined;
    if (tenantIdIndex !== -1 && tenantIdIndex + 1 < rawArgs.length) {
        tenantId = rawArgs[tenantIdIndex + 1];
    }

    const argsWithoutFlags = rawArgs.filter((arg) => !arg.startsWith('--') && arg !== tenantId);
    const env = parseEnvironment(argsWithoutFlags);

    initializeFirebase(env);

    if (env.isEmulator) {
        console.log('✅ Connected to Firebase Emulator');
    } else {
        console.log('✅ Connected to Deployed Firebase');
    }

    const tenantAdminService = await buildTenantAdminService(env);
    await syncTenantConfigs(tenantAdminService, { defaultOnly, tenantId });

    console.log('✅ Tenant sync complete');
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Tenant config sync failed:', error);
        process.exit(1);
    });
}

export { buildTenantAdminService, syncTenantConfigs };
