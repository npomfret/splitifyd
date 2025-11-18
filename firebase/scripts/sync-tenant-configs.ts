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
import { Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { FirestoreCollections } from '../functions/src/constants';

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

// Lazy initialization - will be set when Firebase is initialized
let firestoreDb: ReturnType<typeof createFirestoreDatabase>;

function getFirestoreDb() {
    if (!firestoreDb) {
        // Import getFirestore lazily to avoid module-level execution before GCLOUD_PROJECT is set
        const { getFirestore } = require('../functions/src/firebase');
        firestoreDb = createFirestoreDatabase(getFirestore());
    }
    return firestoreDb;
}

async function syncTenantConfigs(options?: { defaultOnly?: boolean; }) {
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

    const db = getFirestoreDb();
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
            createdAt: existingDoc.exists ? existingDoc.data()?.createdAt : now,
            updatedAt: now,
        };

        await tenantRef.set(tenantDoc);
        console.log(`  ✓ Synced tenant: ${config.id} (${config.branding.appName})`);
    }

    console.log('✅ Tenant configurations synced successfully');
}

// Run if executed directly
if (require.main === module) {
    syncTenantConfigs().catch((error) => {
        console.error('❌ Tenant config sync failed:', error);
        process.exit(1);
    });
}

export { syncTenantConfigs };
