import { act, cleanup, render, screen, waitFor } from '@testing-library/preact';
import type { AppConfiguration } from '@splitifyd/shared';
import { AppConfigurationBuilder, type TenantOverrides } from '@splitifyd/test-support';
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

const buildConfig = (overrides: TenantOverrides = {}): AppConfiguration =>
    new AppConfigurationBuilder().withTenantOverrides(overrides).build();

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
            features: {
                enableAdvancedReporting: false,
            },
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
            features: {
                enableAdvancedReporting: false,
            },
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
            features: {
                enableAdvancedReporting: false,
            },
        }));

        await waitFor(() => expect(screen.queryByText('protected')).not.toBeInTheDocument());
        expect(await screen.findByText('fallback')).toBeInTheDocument();
    });
});
