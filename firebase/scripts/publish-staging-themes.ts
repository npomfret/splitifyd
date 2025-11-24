#!/usr/bin/env npx tsx
/**
 * Publish themes for staging tenants to deployed Firebase
 *
 * Usage:
 *   ./scripts/publish-staging-themes.ts
 *
 * This script syncs staging-tenant configuration to deployed Firebase (staging-1),
 * which includes updating branding tokens. Uses TenantAdminService for proper validation.
 */
import { localhostBrandingTokens, loopbackBrandingTokens, type BrandingTokens } from '@billsplit-wl/shared';
import type { BrandingTokenFixtureKey } from '@billsplit-wl/shared';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../functions/src/logger';

interface TenantSeed {
    tenantId: string;
    displayName: string;
    primaryDomain: string;
    aliasDomains: string[];
    fixture: BrandingTokenFixtureKey;
    defaultTenant: boolean;
}

function loadStagingTenantSeeds(): TenantSeed[] {
    const configPath = path.join(__dirname, 'tenant-configs.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const configs = JSON.parse(configData);

    // Map fixture names based on tenant ID
    const fixtureMap: Record<string, BrandingTokenFixtureKey> = {
        'staging-default-tenant': 'loopback', // Brutalist theme (staging fallback)
        'staging-tenant': 'localhost', // Aurora theme (staging production domain)
    };

    // Only load staging tenants
    return configs
        .filter((config: any) => config.id.startsWith('staging-'))
        .map((config: any) => ({
            tenantId: config.id,
            displayName: config.branding.appName,
            primaryDomain: config.domains[0] || 'unknown',
            aliasDomains: config.domains.slice(1),
            fixture: fixtureMap[config.id] || 'localhost',
            defaultTenant: config.isDefault,
        }));
}

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

async function apiRequest(baseUrl: string, method: string, path: string, body: any, token?: string): Promise<any> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
}

async function seedTenant(baseUrl: string, token: string, seed: TenantSeed): Promise<void> {
    const fixtures: Record<BrandingTokenFixtureKey, BrandingTokens> = {
        default: loopbackBrandingTokens,
        localhost: localhostBrandingTokens,
        loopback: loopbackBrandingTokens,
    };

    const fixture = fixtures[seed.fixture];
    if (!fixture) {
        throw new Error(`Unknown fixture: ${seed.fixture}`);
    }

    const branding = buildBranding(seed.displayName, fixture);
    const tenantId = seed.tenantId;
    const primaryDomain = normalizeDomain(seed.primaryDomain);
    const aliasDomains = seed.aliasDomains.map(normalizeDomain);
    const domains = Array.from(new Set([primaryDomain, ...aliasDomains]));

    const payload = {
        tenantId,
        branding,
        brandingTokens: {
            tokens: fixture,
        },
        domains,
        defaultTenant: seed.defaultTenant,
    };

    logger.info(`Publishing theme for ${tenantId} (${seed.displayName})`, {
        tenantId,
        fixture: seed.fixture,
        domain: primaryDomain,
    });

    await apiRequest(baseUrl, 'POST', '/admin/tenants', payload, token);

    logger.info(`✓ Theme published for ${tenantId}`);
}

export async function publishStagingThemes(): Promise<void> {
    logger.info('🎨 Publishing themes for staging tenants...');

    // Just call sync-tenant-configs which uses TenantAdminService properly
    const { buildServices, syncTenantConfigs } = await import('./sync-tenant-configs');
    const { parseEnvironment, initializeFirebase } = await import('./firebase-init');

    const env = parseEnvironment(['staging']);
    initializeFirebase(env);

    const services = await buildServices(env);

    // Sync staging-tenant which will update/create it with proper branding tokens
    await syncTenantConfigs(services, { tenantId: 'staging-tenant' });

    logger.info('✅ Staging themes published successfully');
    logger.info(`  - staging-tenant: Aurora theme (splitifyd.web.app)`);
}

async function main(): Promise<void> {
    await publishStagingThemes();
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Staging theme publishing script failed');
        console.error('Error details:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
        logger.error('Staging theme publishing script failed', { error });
        process.exit(1);
    });
}
