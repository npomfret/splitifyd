#!/usr/bin/env npx tsx
/**
 * Publish themes for staging tenants to deployed Firebase
 *
 * Usage:
 *   ./scripts/publish-staging-themes.ts <admin-email> <admin-password> <base-url>
 *
 * Arguments:
 *   admin-email    - Email address of system admin account
 *   admin-password - Password for admin account
 *   base-url       - Base URL of deployed Firebase Functions (e.g., https://us-central1-splitifyd.cloudfunctions.net/api)
 *
 * Example:
 *   ./scripts/publish-staging-themes.ts admin@example.com mypassword https://us-central1-splitifyd.cloudfunctions.net/api
 *
 * Prerequisites:
 *   - Admin user must already exist and have system_admin role
 *   - Use promote-user-to-admin.ts to create/promote the admin user first
 *
 * This script publishes themes for staging-default-tenant and staging-tenant
 * to the deployed Firebase environment (not emulator).
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

export async function publishStagingThemes(
    adminEmail: string,
    adminPassword: string,
    baseUrl: string,
): Promise<void> {
    const STAGING_TENANT_SEEDS = loadStagingTenantSeeds();

    logger.info('🎨 Publishing themes for staging tenants...');
    logger.info(`Found ${STAGING_TENANT_SEEDS.length} staging tenants to publish`);

    logger.info(`Authenticating as ${adminEmail}...`);
    const loginResponse = await apiRequest(baseUrl, 'POST', '/register', {
        email: adminEmail,
        password: adminPassword,
        displayName: adminEmail.split('@')[0],
    });
    const token = loginResponse.token;
    logger.info(`✓ Authenticated successfully`);

    for (const seed of STAGING_TENANT_SEEDS) {
        try {
            await seedTenant(baseUrl, token, seed);
        } catch (error) {
            logger.error(`Failed to seed ${seed.tenantId}`, { error });
            throw error;
        }
    }

    logger.info('✅ Staging themes published successfully');
    logger.info(`  - staging-default-tenant: Brutalist theme (fallback)`);
    logger.info(`  - staging-tenant: Aurora theme (splitifyd.web.app)`);
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.error('❌ Usage: script.ts <admin-email> <admin-password> <base-url>');
        console.error('');
        console.error('Arguments:');
        console.error('  admin-email    - Email address of system admin account');
        console.error('  admin-password - Password for admin account');
        console.error('  base-url       - Base URL of deployed Firebase Functions');
        console.error('');
        console.error('Example:');
        console.error('  ./scripts/publish-staging-themes.ts admin@example.com mypassword https://us-central1-splitifyd.cloudfunctions.net/api');
        process.exit(1);
    }

    const [adminEmail, adminPassword, baseUrl] = args;

    await publishStagingThemes(adminEmail, adminPassword, baseUrl);
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        logger.error('Staging theme publishing script failed', { error });
        process.exit(1);
    });
}
