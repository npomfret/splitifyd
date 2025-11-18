import { AppConfiguration, TenantConfig, toShowLandingPageFlag, toShowMarketingContentFlag, toShowPricingPageFlag } from '@splitifyd/shared';
import { getTenantAwareAppConfig } from '../client-config';
import { HTTP_STATUS } from '../constants';
import type { TenantRequestContext } from '../types/tenant';
import { ApiError } from './errors';

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
    if (!context) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'TENANT_NOT_FOUND', 'Tenant context is required for configuration');
    }

    const effectiveTenant = cloneTenantConfig(context.config);
    const baseConfig = getTenantAwareAppConfig(effectiveTenant);

    if (context.themeArtifact) {
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
