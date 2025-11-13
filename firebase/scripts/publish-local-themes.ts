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
        tenantId: 'tenant_localhost',
        displayName: 'Splitifyd – Localhost',
        primaryDomain: 'localhost',
        aliasDomains: ['127.0.0.1'],
        fixture: 'localhost',
    },
    {
        tenantId: 'tenant_loopback',
        displayName: 'Splitifyd – Loopback',
        primaryDomain: '120.0.0.1',
        aliasDomains: ['loopback.local', 'localhost.localdomain'],
        fixture: 'loopback',
    },
    {
        tenantId: 'tenant_default',
        displayName: 'Splitifyd – Default',
        primaryDomain: 'default.splitifyd.local',
        aliasDomains: ['fallback.splitifyd.local', 'preview.splitifyd.local'],
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

async function main(): Promise<void> {
    const apiDriver = new ApiDriver();

    logger.info('Authenticating default admin (Bill Splitter)…');
    const admin = await apiDriver.getDefaultAdminUser();
    logger.info(`Authenticated as ${admin.email}`);

    for (const seed of TENANT_SEEDS) {
        try {
            await seedTenant(apiDriver, admin.token, seed);
        } catch (error) {
            logger.error(`Failed to seed ${seed.tenantId}`, { error });
            throw error;
        }
    }

    logger.info('✅ Local themes ready: visit http://localhost:5173 (localhost) or http://120.0.0.1:5173 (loopback) once front-end bootstrap lands.');
}

main().catch((error) => {
    logger.error('Theme publishing script failed', { error });
    process.exit(1);
});
