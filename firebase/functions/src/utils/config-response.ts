import {
    AppConfiguration,
    TenantConfig,
    toShowLandingPageFlag,
    toShowMarketingContentFlag,
    toShowPricingPageFlag,
} from '@splitifyd/shared';
import { getTenantAwareAppConfig } from '../client-config';
import { HARDCODED_FALLBACK_TENANT } from '../services/tenant/TenantRegistryService';
import type { TenantRequestContext } from '../types/tenant';

const cloneTenantConfig = (tenant: TenantConfig): TenantConfig => {
    const { marketingFlags, ...restOfBranding } = tenant.branding;
    return {
        tenantId: tenant.tenantId,
        branding: {
            ...restOfBranding,
            marketingFlags: marketingFlags
                ? { ...marketingFlags }
                : {
                      showLandingPage: toShowLandingPageFlag(true),
                      showMarketingContent: toShowMarketingContentFlag(true),
                      showPricingPage: toShowPricingPageFlag(true),
                  },
        },
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
    };
};

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
