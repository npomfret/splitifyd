#!/usr/bin/env npx tsx
/**
 * Sync tenant configurations from tenant-configs.json to Firestore.
 *
 * Usage:
 *   ./scripts/sync-tenant-configs.ts <emulator|production> [--default-only]
 *
 * Flags:
 *   --default-only: Only sync the default tenant (isDefault: true)
 */
import { createFirestoreDatabase } from '@billsplit-wl/firebase-simulator';
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
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@billsplit-wl/shared';
import * as admin from 'firebase-admin';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { FirestoreCollections } from '../functions/src/constants';
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

async function resolveFirestore(env: ScriptEnvironment): Promise<Firestore> {
    if (env.isEmulator) {
        const firebaseModule = await import('../functions/src/firebase');
        return firebaseModule.getFirestore();
    }
    return admin.firestore();
}

async function syncTenantConfigs(firestore: Firestore, options?: { defaultOnly?: boolean; }) {
    const configPath = path.join(__dirname, 'tenant-configs.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    let configs: TenantConfig[] = JSON.parse(configData);

    // If defaultOnly, filter to only the default tenant
    if (options?.defaultOnly) {
        configs = configs.filter((c) => c.isDefault === true);
        console.log('🔄 Syncing default tenant only...');
    } else {
        console.log('🔄 Syncing all tenant configurations from JSON...');
    }

    const db = createFirestoreDatabase(firestore);
    const now = Timestamp.now();

    for (const config of configs) {
        const tenantRef = db.collection(FirestoreCollections.TENANTS).doc(config.id);
        const existingDoc = await tenantRef.get();

        // Normalize domains (remove port for storage)
        const normalizeDomain = (domain: string): string => {
            return domain.replace(/:\d+$/, '');
        };

        const normalizedDomains = config.domains.map((d) => toTenantDomainName(normalizeDomain(d)));
        const primaryDomain = normalizedDomains.length > 0 ? normalizedDomains[0] : toTenantDomainName('localhost');

        if (existingDoc.exists) {
            // For existing tenants, use update() to preserve brandingTokens.artifact (theme CSS)
            const updateData: Record<string, any> = {
                'branding.appName': toTenantAppName(config.branding.appName),
                'branding.logoUrl': toTenantLogoUrl(config.branding.logoUrl),
                'branding.faviconUrl': toTenantFaviconUrl(config.branding.faviconUrl),
                'branding.primaryColor': toTenantPrimaryColor(config.branding.primaryColor),
                'branding.secondaryColor': toTenantSecondaryColor(config.branding.secondaryColor),
                'branding.marketingFlags.showLandingPage': toShowLandingPageFlag(config.branding.marketingFlags?.showLandingPage ?? false),
                'branding.marketingFlags.showMarketingContent': toShowMarketingContentFlag(config.branding.marketingFlags?.showMarketingContent ?? false),
                'branding.marketingFlags.showPricingPage': toShowPricingPageFlag(config.branding.marketingFlags?.showPricingPage ?? false),
                domains: {
                    primary: primaryDomain,
                    aliases: [],
                    normalized: normalizedDomains,
                },
                defaultTenant: toTenantDefaultFlag(config.isDefault),
                updatedAt: now,
            };

            if (config.branding.backgroundColor) {
                updateData['branding.backgroundColor'] = toTenantBackgroundColor(config.branding.backgroundColor);
            }
            if (config.branding.headerBackgroundColor) {
                updateData['branding.headerBackgroundColor'] = toTenantHeaderBackgroundColor(config.branding.headerBackgroundColor);
            }

            await tenantRef.update(updateData);
        } else {
            // For new tenants, use set() to create the document
            const tenantDoc = {
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
                domains: {
                    primary: primaryDomain,
                    aliases: [],
                    normalized: normalizedDomains,
                },
                defaultTenant: toTenantDefaultFlag(config.isDefault),
                createdAt: now,
                updatedAt: now,
            };

            await tenantRef.set(tenantDoc);
        }
        console.log(`  ✓ Synced tenant: ${config.id} (${config.branding.appName})`);
    }

    console.log('✅ Tenant configurations synced successfully');
}

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2);
    const defaultOnly = rawArgs.includes('--default-only');
    const argsWithoutFlags = rawArgs.filter((arg) => !arg.startsWith('--'));
    const env = parseEnvironment(argsWithoutFlags);

    initializeFirebase(env);

    if (env.isEmulator) {
        console.log('✅ Connected to Firebase Emulator');
    } else {
        console.log('✅ Connected to Production Firebase');
    }

    const firestore = await resolveFirestore(env);
    await syncTenantConfigs(firestore, { defaultOnly });

    console.log('✅ Tenant sync complete');
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Tenant config sync failed:', error);
        process.exit(1);
    });
}

export { syncTenantConfigs };
