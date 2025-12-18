import type { TenantData } from '../types';
import type { AnyFieldDef } from './field-types';
import { FIELD_REGISTRY } from './registry';

function generateDefaultsFromRegistry(registry: readonly AnyFieldDef[]): Partial<TenantData> {
    const defaults: Partial<TenantData> = {};

    for (const field of registry) {
        (defaults as Record<string, unknown>)[field.key] = field.default;
    }

    return defaults;
}

const registryDefaults = generateDefaultsFromRegistry(FIELD_REGISTRY);

export const EMPTY_TENANT_DATA: TenantData = {
    // Core fields not in registry (handled specially in UI)
    tenantId: '',
    appName: '',
    domains: [],
    logoUrl: '',
    faviconUrl: '',
    showAppNameInHeader: true,

    // Derivation options (UI-only, not persisted to tokens)
    derivationThemeMode: 'light',
    derivationStyle: 'balanced',
    derivationIntensity: 50,

    // All registry-generated defaults
    ...registryDefaults,
} as TenantData;
