#!/usr/bin/env npx tsx

import { ApiDriver } from '@splitifyd/test-support';
import type { BrandingTokens, BrandingTokenFixtureKey } from '@splitifyd/shared';
import { brandingTokenFixtures } from '@splitifyd/shared';
import { logger } from './logger';

type TenantSeed = {
    tenantId: string;
    displayName: string;
    primaryDomain: string;
    aliasDomains?: string[];
    fixture: BrandingTokenFixtureKey;
    defaultTenant?: boolean;
};

const TENANT_SEEDS: TenantSeed[] = [
    {
        tenantId: 'localhost-tenant',
        displayName: 'Splitifyd Demo',
        primaryDomain: 'localhost',
        aliasDomains: [],
        fixture: 'localhost',
    },
    {
        tenantId: 'partner-tenant',
        displayName: 'Partner Expenses',
        primaryDomain: '127.0.0.1',
        aliasDomains: [],
        fixture: 'loopback',
    },
    {
        tenantId: 'default-fallback-tenant',
        displayName: 'Splitifyd',
        primaryDomain: 'default.splitifyd.local',
        aliasDomains: [],
        fixture: 'default',
        defaultTenant: true,
    },
];

const BASE_FEATURES = {
    enableAdvancedReporting: false,
    enableMultiCurrency: true,
    enableCustomFields: false,
    maxGroupsPerUser: 200,
    maxUsersPerGroup: 200,
};

const normalizeDomain = (value: string): string => {
    return value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, '');
};

const buildBranding = (displayName: string, tokens: BrandingTokens) => ({
    appName: displayName,
    logoUrl: tokens.assets.logoUrl,
    faviconUrl: tokens.assets.faviconUrl,
    primaryColor: tokens.palette.primary,
    secondaryColor: tokens.palette.secondary,
    accentColor: tokens.palette.accent,
    themePalette: 'default',
});

async function seedTenant(api: ApiDriver, adminToken: string, seed: TenantSeed): Promise<void> {
    const tokens = brandingTokenFixtures[seed.fixture];

    if (!tokens) {
        throw new Error(`No branding token fixture found for key "${seed.fixture}"`);
    }

    const aliasDomains = seed.aliasDomains?.map(normalizeDomain) ?? [];
    const primaryDomain = normalizeDomain(seed.primaryDomain);
    const normalizedDomains = Array.from(new Set([primaryDomain, ...aliasDomains]));

    const payload = {
        tenantId: seed.tenantId,
        branding: buildBranding(seed.displayName, tokens),
        brandingTokens: {
            tokens,
        },
        features: BASE_FEATURES,
        domains: {
            primary: primaryDomain,
            aliases: aliasDomains,
            normalized: normalizedDomains,
        },
        defaultTenant: seed.defaultTenant,
    };

    logger.info(`→ Upserting ${seed.tenantId} (${seed.displayName})`);
    await api.adminUpsertTenant(adminToken, payload);
    logger.info(`   ✓ Upserted`);

    logger.info(`→ Publishing theme for ${seed.tenantId}`);
    const publishResult = await api.publishTenantTheme(adminToken, { tenantId: seed.tenantId });
    logger.info(`   ✓ Published hash ${publishResult.artifact.hash}`);
}

export async function publishLocalThemes(options?: { defaultOnly?: boolean }): Promise<void> {
    const apiDriver = new ApiDriver();

    logger.info('Authenticating default admin (Bill Splitter)…');
    const admin = await apiDriver.getDefaultAdminUser();
    logger.info(`Authenticated as ${admin.email}`);

    // Filter tenants based on options
    const tenantsToPublish = options?.defaultOnly
        ? TENANT_SEEDS.filter(seed => seed.defaultTenant === true)
        : TENANT_SEEDS;

    for (const seed of tenantsToPublish) {
        try {
            await seedTenant(apiDriver, admin.token, seed);
        } catch (error) {
            logger.error(`Failed to seed ${seed.tenantId}`, { error });
            throw error;
        }
    }

    if (options?.defaultOnly) {
        logger.info('✅ Default tenant theme ready.');
    } else {
        logger.info('✅ Local themes ready: visit http://localhost:5173 (localhost) or http://127.0.0.1:5173 (loopback).');
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
