import { act, cleanup, render, screen, waitFor } from '@testing-library/preact';
import type { AppConfiguration, FeatureConfig } from '@splitifyd/shared';
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
import { signal } from '@preact/signals';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/stores/config-store.ts', () => {
    const configSignal = signal<AppConfiguration | null>(null);

    return {
        configStore: {
            configSignal,
            get config() {
                return configSignal.value;
            },
        },
    };
});

const { configStore } = await import('@/stores/config-store.ts');
const { FeatureGate, readFeatureFlag, useFeatureFlag } = await import('@/utils/feature-flags.ts');

const buildConfig = (features: Partial<FeatureConfig> = {}): AppConfiguration => ({
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
    tenant: {
        tenantId: toTenantId('tenant'),
        branding: {
            appName: toTenantAppName('Splitifyd Tenant'),
            logoUrl: toTenantLogoUrl('https://example.com/logo.svg'),
            faviconUrl: toTenantFaviconUrl('https://example.com/favicon.ico'),
            primaryColor: toTenantPrimaryColor('#112233'),
            secondaryColor: toTenantSecondaryColor('#445566'),
        },
        features: {
            enableAdvancedReporting: toFeatureToggleAdvancedReporting(true),
            enableMultiCurrency: toFeatureToggleMultiCurrency(false),
            enableCustomFields: toFeatureToggleCustomFields(false),
            maxGroupsPerUser: toTenantMaxGroupsPerUser(10),
            maxUsersPerGroup: toTenantMaxUsersPerGroup(20),
            ...features,
        },
        createdAt: toISOString('2025-01-01T00:00:00.000Z'),
        updatedAt: toISOString('2025-01-01T00:00:00.000Z'),
    },
});

const updateConfig = (config: AppConfiguration | null) => {
    act(() => {
        // @ts-expect-error - configSignal is mocked as writable in tests
        configStore.configSignal.value = config;
    });
};

describe('feature-flags utilities', () => {
    beforeEach(() => {
        updateConfig(buildConfig());
    });

    afterEach(() => {
        cleanup();
        updateConfig(null);
    });

    it('reads the current feature flag value', () => {
        expect(readFeatureFlag('enableAdvancedReporting')).toBe(true);

        updateConfig(buildConfig({
            enableAdvancedReporting: toFeatureToggleAdvancedReporting(false),
        }));

        expect(readFeatureFlag('enableAdvancedReporting')).toBe(false);
    });

    it('falls back to provided default when config is absent', () => {
        updateConfig(null);
        expect(readFeatureFlag('enableAdvancedReporting', true)).toBe(true);
    });

    it('reacts to feature flag updates via useFeatureFlag', async () => {
        function UnderTest() {
            const enabled = useFeatureFlag('enableAdvancedReporting');
            return <span>{enabled ? 'enabled' : 'disabled'}</span>;
        }

        render(<UnderTest />);
        expect(screen.getByText('enabled')).toBeInTheDocument();

        updateConfig(buildConfig({
            enableAdvancedReporting: toFeatureToggleAdvancedReporting(false),
        }));

        expect(await screen.findByText('disabled')).toBeInTheDocument();
    });

    it('FeatureGate toggles children based on flag state', async () => {
        render(
            <FeatureGate feature='enableAdvancedReporting' fallback={<span>fallback</span>}>
                <span>protected</span>
            </FeatureGate>,
        );

        expect(screen.getByText('protected')).toBeInTheDocument();

        updateConfig(buildConfig({
            enableAdvancedReporting: toFeatureToggleAdvancedReporting(false),
        }));

        await waitFor(() => expect(screen.queryByText('protected')).not.toBeInTheDocument());
        expect(await screen.findByText('fallback')).toBeInTheDocument();
    });
});
