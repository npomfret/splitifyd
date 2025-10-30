import { AppConfiguration, TenantConfig } from '@splitifyd/shared';
import { getTenantAwareAppConfig } from '../client-config';
import { HARDCODED_FALLBACK_TENANT } from '../services/tenant/TenantRegistryService';

const cloneTenantConfig = (tenant: TenantConfig): TenantConfig => ({
    tenantId: tenant.tenantId,
    branding: {
        ...tenant.branding,
        marketingFlags: tenant.branding.marketingFlags ? { ...tenant.branding.marketingFlags } : undefined,
    },
    features: { ...tenant.features },
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
});

export const getEnhancedConfigResponse = (tenant?: TenantConfig): AppConfiguration => {
    const effectiveTenant = tenant ? cloneTenantConfig(tenant) : cloneTenantConfig(HARDCODED_FALLBACK_TENANT.tenant);
    return getTenantAwareAppConfig(effectiveTenant);
};
