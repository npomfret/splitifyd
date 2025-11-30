import { AppConfiguration, TenantConfig, toShowLandingPageFlag, toShowMarketingContentFlag, toShowPricingPageFlag } from '@billsplit-wl/shared';
import { getTenantAwareAppConfig } from '../client-config';
import { HTTP_STATUS } from '../constants';
import type { TenantRequestContext } from '../types/tenant';
import { ErrorDetail, Errors } from '../errors';

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
        throw Errors.notFound('Tenant', ErrorDetail.TENANT_NOT_FOUND);
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
