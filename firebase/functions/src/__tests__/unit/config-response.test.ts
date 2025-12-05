import type { ClientAppConfiguration } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from '@billsplit-wl/shared';
import { BrandingArtifactMetadataBuilder, TenantRequestContextBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientConfig from '../../app-config';
import { getEnhancedConfigResponse } from '../../utils/config-response';

describe('getEnhancedConfigResponse', () => {
    const mockAppConfig = { firebase: {}, environment: {}, formDefaults: {} } as unknown as ClientAppConfiguration;

    beforeEach(() => {
        vi.spyOn(clientConfig, 'getTenantAwareAppConfig').mockReturnValue(mockAppConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('forwards provided tenant config without mutating input references', () => {
        const sourceTenant = new TenantConfigBuilder('provided-tenant')
            .withMarketingFlags({ showLandingPage: true })
            .build();

        const context = new TenantRequestContextBuilder()
            .withConfig(sourceTenant)
            .build();

        const result = getEnhancedConfigResponse(context);

        expect(result).toBe(mockAppConfig);

        const calls = vi.mocked(clientConfig.getTenantAwareAppConfig).mock.calls;
        const forwarded = calls.length > 0 ? calls[calls.length - 1]![0] : undefined;
        expect(forwarded).toBeDefined();
        expect(forwarded).not.toBe(sourceTenant);
        expect(forwarded?.branding).not.toBe(sourceTenant.branding);
        expect(forwarded?.marketingFlags).not.toBe(sourceTenant.marketingFlags);
        expect(forwarded?.tenantId).toBe(sourceTenant.tenantId);
    });

    it('throws when tenant context is missing', () => {
        expect(() => getEnhancedConfigResponse()).toThrow();
    });

    it('augments config with theme hash when artifact is present', () => {
        const tenant = new TenantConfigBuilder('tenant-with-theme')
            .withMarketingFlags({ showLandingPage: false })
            .build();

        const themeArtifact = new BrandingArtifactMetadataBuilder()
            .withHash('abc123')
            .withGeneratedAtEpochMs(123456789)
            .build();

        const context = new TenantRequestContextBuilder()
            .withConfig(tenant)
            .withThemeArtifact(themeArtifact)
            .build();

        const result = getEnhancedConfigResponse(context);

        expect(result).not.toBe(mockAppConfig);
        expect(result.theme?.hash).toBe('abc123');
        expect(result.theme?.generatedAtEpochMs).toBe(123456789);
    });

    it('provides default marketingFlags when tenant has undefined marketingFlags', () => {
        // TenantConfigBuilder doesn't set marketingFlags by default
        const tenantWithoutMarketingFlags = new TenantConfigBuilder('no-marketing-tenant').build();

        const context = new TenantRequestContextBuilder()
            .withConfig(tenantWithoutMarketingFlags)
            .build();

        const result = getEnhancedConfigResponse(context);

        expect(result).toBe(mockAppConfig);

        const calls = vi.mocked(clientConfig.getTenantAwareAppConfig).mock.calls;
        const forwarded = calls.length > 0 ? calls[calls.length - 1]![0] : undefined;
        expect(forwarded).toBeDefined();
        expect(forwarded?.marketingFlags).toBeDefined();
        expect(forwarded?.marketingFlags?.showLandingPage).toBe(true);
        expect(forwarded?.marketingFlags?.showMarketingContent).toBe(true);
        expect(forwarded?.marketingFlags?.showPricingPage).toBe(true);
    });
});
