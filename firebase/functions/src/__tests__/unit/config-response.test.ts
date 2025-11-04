import {
    toFeatureToggleAdvancedReporting,
    toFeatureToggleCustomFields,
    toFeatureToggleMultiCurrency,
    toTenantAppName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantMaxGroupsPerUser,
    toTenantMaxUsersPerGroup,
    toISOString,
    toShowLandingPageFlag,
} from '@splitifyd/shared';
import type { AppConfiguration, TenantConfig } from '@splitifyd/shared';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as clientConfig from '../../client-config';
import { HARDCODED_FALLBACK_TENANT } from '../../services/tenant/TenantRegistryService';
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
            features: {
                enableAdvancedReporting: toFeatureToggleAdvancedReporting(true),
                enableMultiCurrency: toFeatureToggleMultiCurrency(false),
                enableCustomFields: toFeatureToggleCustomFields(true),
                maxGroupsPerUser: toTenantMaxGroupsPerUser(25),
                maxUsersPerGroup: toTenantMaxUsersPerGroup(50),
            },
            createdAt: toISOString('2025-02-01T10:00:00.000Z'),
            updatedAt: toISOString('2025-02-02T12:00:00.000Z'),
        };

        const result = getEnhancedConfigResponse(sourceTenant);

        expect(result).toBe(mockAppConfig);

        const calls = vi.mocked(clientConfig.getTenantAwareAppConfig).mock.calls;
        const forwarded = calls.length > 0 ? calls[calls.length - 1]![0] : undefined;
        expect(forwarded).toBeDefined();
        expect(forwarded).not.toBe(sourceTenant);
        expect(forwarded?.branding).not.toBe(sourceTenant.branding);
        expect(forwarded?.branding.marketingFlags).not.toBe(sourceTenant.branding.marketingFlags);
        expect(forwarded?.tenantId).toBe(sourceTenant.tenantId);
    });

    it('uses hardcoded fallback tenant when none provided', () => {
        const result = getEnhancedConfigResponse();

        expect(result).toBe(mockAppConfig);

        const calls = vi.mocked(clientConfig.getTenantAwareAppConfig).mock.calls;
        const forwarded = calls.length > 0 ? calls[calls.length - 1]![0] : undefined;
        expect(forwarded).toBeDefined();
        expect(forwarded?.tenantId).toBe(HARDCODED_FALLBACK_TENANT.tenant.tenantId);
        expect(forwarded).not.toBe(HARDCODED_FALLBACK_TENANT.tenant);
    });
});
