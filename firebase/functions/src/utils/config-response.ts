import { AppConfiguration, TenantConfig } from '@splitifyd/shared';
import { getTenantAwareAppConfig } from '../client-config';
import { HARDCODED_FALLBACK_TENANT } from '../services/tenant/TenantRegistryService';
import type { TenantRequestContext } from '../types/tenant';

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

export const getEnhancedConfigResponse = (context?: TenantRequestContext): AppConfiguration => {
    const tenant = context?.config ?? HARDCODED_FALLBACK_TENANT.tenant;
    const effectiveTenant = cloneTenantConfig(tenant);
    const baseConfig = getTenantAwareAppConfig(effectiveTenant);

    if (context?.themeArtifact) {
        return {
            ...baseConfig,
            theme: {
                hash: context.themeArtifact.hash,
                generatedAtEpochMs: context.themeArtifact.generatedAtEpochMs,
            },
        };
    }

    return baseConfig;
};
