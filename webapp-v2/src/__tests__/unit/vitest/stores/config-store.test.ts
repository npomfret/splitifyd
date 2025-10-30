import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AppConfiguration, BrandingConfig } from '@splitifyd/shared';
import {
    toFeatureToggleAdvancedReporting,
    toFeatureToggleCustomFields,
    toFeatureToggleMultiCurrency,
    toISOString,
    toTenantAppName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantMaxGroupsPerUser,
    toTenantMaxUsersPerGroup,
} from '@splitifyd/shared';
import { configStore } from '@/stores/config-store.ts';

vi.mock('@/app/firebase-config', () => ({
    firebaseConfigManager: {
        getConfig: vi.fn(),
    },
}));

vi.mock('@/utils/branding', () => ({
    applyBrandingPalette: vi.fn(),
}));

const { firebaseConfigManager } = await import('@/app/firebase-config');
const { applyBrandingPalette } = await import('@/utils/branding');

describe('configStore', () => {
    const baseConfig = (branding?: BrandingConfig): AppConfiguration => ({
        firebase: {
            apiKey: 'test',
            authDomain: 'test',
            projectId: 'test',
            storageBucket: 'test',
            messagingSenderId: 'test',
            appId: 'test',
        },
        environment: {},
        formDefaults: {},
        tenant: branding
            ? {
                tenantId: toTenantId('tenant'),
                branding,
                features: {
                    enableAdvancedReporting: toFeatureToggleAdvancedReporting(true),
                    enableMultiCurrency: toFeatureToggleMultiCurrency(false),
                    enableCustomFields: toFeatureToggleCustomFields(true),
                    maxGroupsPerUser: toTenantMaxGroupsPerUser(10),
                    maxUsersPerGroup: toTenantMaxUsersPerGroup(20),
                },
                createdAt: toISOString('2025-01-01T00:00:00.000Z'),
                updatedAt: toISOString('2025-01-01T00:00:00.000Z'),
            }
            : undefined,
    });

    beforeEach(() => {
        vi.mocked(firebaseConfigManager.getConfig).mockResolvedValue(baseConfig());
    });

    afterEach(() => {
        configStore.reset();
        vi.clearAllMocks();
    });

    it('applies branding palette and theme when tenant branding exists', async () => {
        const branding: BrandingConfig = {
            appName: toTenantAppName('Branded'),
            logoUrl: toTenantLogoUrl('https://logo.svg'),
            faviconUrl: toTenantFaviconUrl('https://favicon.ico'),
            primaryColor: toTenantPrimaryColor('#112233'),
            secondaryColor: toTenantSecondaryColor('#445566'),
        };

        vi.mocked(firebaseConfigManager.getConfig).mockResolvedValue(baseConfig(branding));

        await configStore.loadConfig();

        expect(applyBrandingPalette).toHaveBeenCalledWith(branding);
    });

    it('clears branding palette when reset is called', async () => {
        await configStore.loadConfig();
        configStore.reset();

        expect(applyBrandingPalette).toHaveBeenCalledWith(null);
    });
});
