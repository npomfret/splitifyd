import { ClientAppConfiguration, TenantConfig, toShowLandingPageFlag, toShowMarketingContentFlag, toShowPricingPageFlag } from '@billsplit-wl/shared';
import { getTenantAwareAppConfig } from '../app-config';
import type { TenantRequestContext } from '../types/tenant';
import { ErrorDetail, Errors } from '../errors';

const cloneTenantConfig = (tenant: TenantConfig): TenantConfig => {
    return {
        tenantId: tenant.tenantId,
        branding: { ...tenant.branding },
        brandingTokens: { ...tenant.brandingTokens },
        marketingFlags: tenant.marketingFlags
            ? { ...tenant.marketingFlags }
            : {
                showLandingPage: toShowLandingPageFlag(true),
                showMarketingContent: toShowMarketingContentFlag(true),
                showPricingPage: toShowPricingPageFlag(true),
            },
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
    };
};

export const getEnhancedConfigResponse = (context?: TenantRequestContext): ClientAppConfiguration => {
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
