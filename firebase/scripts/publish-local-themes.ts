#!/usr/bin/env npx tsx

import type { BrandingTokenFixtureKey, BrandingTokens } from '@billsplit-wl/shared';
import { brandingTokenFixtures } from '@billsplit-wl/shared';
import { ApiDriver } from '@billsplit-wl/test-support';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

type TenantSeed = {
    tenantId: string;
    displayName: string;
    primaryDomain: string;
    aliasDomains?: string[];
    fixture: BrandingTokenFixtureKey;
    defaultTenant?: boolean;
};

// Load tenants from tenant-configs.json - SINGLE SOURCE OF TRUTH
function loadTenantSeeds(): TenantSeed[] {
    const configPath = path.join(__dirname, 'tenant-configs.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const configs = JSON.parse(configData);

    // Map fixture names based on tenant ID
    const fixtureMap: Record<string, BrandingTokenFixtureKey> = {
        'localhost-tenant': 'localhost',
        'default-tenant': 'loopback',
    };

    return configs.map((config: any) => ({
        tenantId: config.id,
        displayName: config.branding.appName,
        primaryDomain: config.domains[0] || 'localhost',
        aliasDomains: config.domains.slice(1),
        fixture: fixtureMap[config.id] || 'localhost',
        defaultTenant: config.isDefault,
    }));
}

const TENANT_SEEDS = loadTenantSeeds();

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

export async function publishLocalThemes(options?: { defaultOnly?: boolean; }): Promise<void> {
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
