/**
 * Utility to load tenant configurations from the docs/tenants directory.
 *
 * Each tenant is stored in its own directory with a config.json file:
 *   docs/tenants/<tenant-id>/config.json
 */
import type { TenantBranding } from '@billsplit-wl/shared';
import * as fs from 'fs';
import * as path from 'path';

export interface TenantConfig {
    id: string;
    domains: string[];
    branding: {
        appName: string;
        logoUrl?: string;
        faviconUrl?: string;
        primaryColor: string;
        secondaryColor: string;
        accentColor?: string;
        surfaceColor?: string;
        textColor?: string;
        marketingFlags?: {
            showLandingPage?: boolean;
            showMarketingContent?: boolean;
            showPricingPage?: boolean;
        };
    };
    brandingTokens?: TenantBranding;
    isDefault: boolean;
}

/**
 * Get the path to the tenants directory
 */
export function getTenantsDirectory(): string {
    return path.join(__dirname, '..', 'docs', 'tenants');
}

/**
 * Load all tenant configurations from the docs/tenants directory
 */
export function loadAllTenantConfigs(): TenantConfig[] {
    const tenantsDir = getTenantsDirectory();

    if (!fs.existsSync(tenantsDir)) {
        throw new Error(`Tenants directory not found: ${tenantsDir}`);
    }

    const tenantDirs = fs.readdirSync(tenantsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    const configs: TenantConfig[] = [];

    for (const tenantId of tenantDirs) {
        const configPath = path.join(tenantsDir, tenantId, 'config.json');
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf-8');
            const config: TenantConfig = JSON.parse(configData);
            configs.push(config);
        }
    }

    return configs;
}

/**
 * Load a specific tenant configuration by ID
 */
export function loadTenantConfig(tenantId: string): TenantConfig | null {
    const tenantsDir = getTenantsDirectory();
    const configPath = path.join(tenantsDir, tenantId, 'config.json');

    if (!fs.existsSync(configPath)) {
        return null;
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
}

/**
 * Get the directory path for a specific tenant
 */
export function getTenantDirectory(tenantId: string): string {
    return path.join(getTenantsDirectory(), tenantId);
}
