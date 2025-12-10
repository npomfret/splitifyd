/**
 * Utility to load tenant configurations from the docs/tenants directory.
 *
 * Each tenant is stored in its own directory with a config.json file:
 *   docs/tenants/<tenant-id>/config.json
 */
import { TenantConfigFile, TenantConfigFileSchema } from '@billsplit-wl/shared';
import * as fs from 'fs';
import * as path from 'path';

// Re-export the type for consumers
export type { TenantConfigFile };

/**
 * Get the path to the tenants directory
 */
export function getTenantsDirectory(): string {
    return path.join(__dirname, '../..', 'docs', 'tenants');
}

/**
 * Load all tenant configurations from the docs/tenants directory
 */
export function loadAllTenantConfigs(): TenantConfigFile[] {
    const tenantsDir = getTenantsDirectory();

    if (!fs.existsSync(tenantsDir)) {
        throw new Error(`Tenants directory not found: ${tenantsDir}`);
    }

    const tenantDirs = fs
        .readdirSync(tenantsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    const configs: TenantConfigFile[] = [];

    for (const tenantId of tenantDirs) {
        const configPath = path.join(tenantsDir, tenantId, 'config.json');
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(configData);
            const config = TenantConfigFileSchema.parse(parsed);
            configs.push(config);
        }
    }

    return configs;
}

/**
 * Load a specific tenant configuration by ID
 */
export function loadTenantConfig(tenantId: string): TenantConfigFile | null {
    const tenantsDir = getTenantsDirectory();
    const configPath = path.join(tenantsDir, tenantId, 'config.json');

    if (!fs.existsSync(configPath)) {
        return null;
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(configData);
    return TenantConfigFileSchema.parse(parsed);
}

/**
 * Get the directory path for a specific tenant
 */
export function getTenantDirectory(tenantId: string): string {
    return path.join(getTenantsDirectory(), tenantId);
}
