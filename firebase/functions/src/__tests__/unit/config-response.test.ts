import {
    toISOString,
    toShowLandingPageFlag,
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
} from '@splitifyd/shared';
import type { AppConfiguration, TenantConfig } from '@splitifyd/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientConfig from '../../client-config';
import type { TenantRequestContext } from '../../types/tenant';
import { getEnhancedConfigResponse } from '../../utils/config-response';

describe('getEnhancedConfigResponse', () => {
    const mockAppConfig = { firebase: {}, environment: {}, formDefaults: {} } as unknown as AppConfiguration;

    beforeEach(() => {
        vi.spyOn(clientConfig, 'getTenantAwareAppConfig').mockReturnValue(mockAppConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('forwards provided tenant config without mutating input references', () => {
        const sourceTenant: TenantConfig = {
            tenantId: toTenantId('provided-tenant'),
            branding: {
                appName: toTenantAppName('Provided'),
                logoUrl: toTenantLogoUrl('https://provided.example/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://provided.example/favicon.ico'),
                primaryColor: toTenantPrimaryColor('#123456'),
                secondaryColor: toTenantSecondaryColor('#654321'),
                marketingFlags: {
                    showLandingPage: toShowLandingPageFlag(true),
                },
            },
            createdAt: toISOString('2025-02-01T10:00:00.000Z'),
            updatedAt: toISOString('2025-02-02T12:00:00.000Z'),
        };

        const context: TenantRequestContext = {
            tenantId: sourceTenant.tenantId,
            config: sourceTenant,
            domains: [],
            primaryDomain: null,
            isDefault: toTenantDefaultFlag(false),
            source: 'override',
        };

        const result = getEnhancedConfigResponse(context);

        expect(result).toBe(mockAppConfig);

        const calls = vi.mocked(clientConfig.getTenantAwareAppConfig).mock.calls;
        const forwarded = calls.length > 0 ? calls[calls.length - 1]![0] : undefined;
        expect(forwarded).toBeDefined();
        expect(forwarded).not.toBe(sourceTenant);
        expect(forwarded?.branding).not.toBe(sourceTenant.branding);
        expect(forwarded?.branding.marketingFlags).not.toBe(sourceTenant.branding.marketingFlags);
        expect(forwarded?.tenantId).toBe(sourceTenant.tenantId);
    });

    it('throws when tenant context is missing', () => {
        expect(() => getEnhancedConfigResponse()).toThrowError(/Tenant context is required for configuration/);
    });

    it('augments config with theme hash when artifact is present', () => {
        const tenant = {
            tenantId: toTenantId('tenant-with-theme'),
            branding: {
                appName: toTenantAppName('With Theme'),
                logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
                primaryColor: toTenantPrimaryColor('#111111'),
                secondaryColor: toTenantSecondaryColor('#222222'),
                marketingFlags: {
                    showLandingPage: toShowLandingPageFlag(false),
                },
            },
            createdAt: toISOString('2025-02-01T00:00:00.000Z'),
            updatedAt: toISOString('2025-02-02T00:00:00.000Z'),
        } satisfies TenantConfig;

        const context: TenantRequestContext = {
            tenantId: tenant.tenantId,
            config: tenant,
            domains: [],
            primaryDomain: null,
            isDefault: toTenantDefaultFlag(false),
            source: 'domain',
            themeArtifact: {
                hash: 'abc123',
                cssUrl: 'file:///tmp/theme.css',
                tokensUrl: 'file:///tmp/tokens.json',
                version: 1,
                generatedAtEpochMs: 123456789,
                generatedBy: 'tester',
            },
        };

        const result = getEnhancedConfigResponse(context);

        expect(result).not.toBe(mockAppConfig);
        expect(result.theme?.hash).toBe('abc123');
        expect(result.theme?.generatedAtEpochMs).toBe(123456789);
    });

    it('provides default marketingFlags when tenant has undefined marketingFlags', () => {
        const tenantWithoutMarketingFlags: TenantConfig = {
            tenantId: toTenantId('no-marketing-tenant'),
            branding: {
                appName: toTenantAppName('Test App'),
                logoUrl: toTenantLogoUrl('/logo.svg'),
                faviconUrl: toTenantFaviconUrl('/favicon.ico'),
                primaryColor: toTenantPrimaryColor('#123456'),
                secondaryColor: toTenantSecondaryColor('#654321'),
                // marketingFlags intentionally omitted
            },
            createdAt: toISOString('2025-02-01T10:00:00.000Z'),
            updatedAt: toISOString('2025-02-02T12:00:00.000Z'),
        };

        const context: TenantRequestContext = {
            tenantId: tenantWithoutMarketingFlags.tenantId,
            config: tenantWithoutMarketingFlags,
            domains: [],
            primaryDomain: null,
            isDefault: toTenantDefaultFlag(false),
            source: 'override',
        };

        const result = getEnhancedConfigResponse(context);

        expect(result).toBe(mockAppConfig);

        const calls = vi.mocked(clientConfig.getTenantAwareAppConfig).mock.calls;
        const forwarded = calls.length > 0 ? calls[calls.length - 1]![0] : undefined;
        expect(forwarded).toBeDefined();
        expect(forwarded?.branding.marketingFlags).toBeDefined();
        expect(forwarded?.branding.marketingFlags?.showLandingPage).toBe(true);
        expect(forwarded?.branding.marketingFlags?.showMarketingContent).toBe(true);
        expect(forwarded?.branding.marketingFlags?.showPricingPage).toBe(true);
    });
});
