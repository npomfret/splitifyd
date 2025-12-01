import { useConfig } from '@/hooks/useConfig.ts';
import { LandingPage } from '@/pages/LandingPage.tsx';
import type { ClientAppConfiguration } from '@billsplit-wl/shared';
import { toShowMarketingContentFlag } from '@billsplit-wl/shared';
import { AppConfigurationBuilder } from '@billsplit-wl/test-support';
import { render, screen } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/components/layout/BaseLayout', () => ({
    BaseLayout: ({ children }: { children: ComponentChildren; }) => <div data-testid='base-layout'>{children}</div>,
}));

vi.mock('@/components/landing/HeroSection', () => ({
    HeroSection: () => <div data-testid='hero-section' />,
}));

vi.mock('@/components/landing/FeaturesGrid', () => ({
    FeaturesGrid: () => <div data-testid='features-grid' />,
}));

vi.mock('@/components/landing/CTASection', () => ({
    CTASection: () => <div data-testid='cta-section' />,
}));

vi.mock('@/hooks/useConfig.ts', () => ({
    useConfig: vi.fn(),
}));

const mockedUseConfig = vi.mocked(useConfig);

const enableMarketing = (): ClientAppConfiguration =>
    new AppConfigurationBuilder()
        .withTenantOverrides({
            branding: {
                marketingFlags: {
                    showMarketingContent: toShowMarketingContentFlag(true),
                },
            },
        })
        .build();

const disableMarketing = (): ClientAppConfiguration =>
    new AppConfigurationBuilder()
        .withTenantOverrides({
            branding: {
                marketingFlags: {
                    showMarketingContent: toShowMarketingContentFlag(false),
                },
            },
        })
        .build();

describe('LandingPage', () => {
    beforeEach(() => {
        mockedUseConfig.mockReset();
    });

    it('renders marketing sections when marketing content flag is enabled', async () => {
        mockedUseConfig.mockReturnValue(enableMarketing());

        render(<LandingPage />);

        expect(screen.getByTestId('hero-section')).toBeInTheDocument();
        expect(screen.getByTestId('features-grid')).toBeInTheDocument();
        expect(screen.getByTestId('cta-section')).toBeInTheDocument();
    });

    it('omits marketing sections when marketing content flag is disabled', async () => {
        mockedUseConfig.mockReturnValue(disableMarketing());

        render(<LandingPage />);

        expect(screen.getByTestId('hero-section')).toBeInTheDocument();
        expect(screen.queryByTestId('features-grid')).not.toBeInTheDocument();
        expect(screen.queryByTestId('cta-section')).not.toBeInTheDocument();
    });

    it('omits marketing sections when config is not yet loaded', async () => {
        mockedUseConfig.mockReturnValue(null);

        render(<LandingPage />);

        expect(screen.getByTestId('hero-section')).toBeInTheDocument();
        expect(screen.queryByTestId('features-grid')).not.toBeInTheDocument();
        expect(screen.queryByTestId('cta-section')).not.toBeInTheDocument();
    });
});
