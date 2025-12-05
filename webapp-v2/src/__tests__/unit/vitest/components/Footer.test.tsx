import { Footer } from '@/components/layout/Footer';
import { useConfig } from '@/hooks/useConfig.ts';
import type { ClientAppConfiguration } from '@billsplit-wl/shared';
import { toShowPricingPageFlag } from '@billsplit-wl/shared';
import { AppConfigurationBuilder } from '@billsplit-wl/test-support';
import { render, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const mockNavigation = {
    goToPricing: vi.fn(),
    goToTerms: vi.fn(),
    goToPrivacyPolicy: vi.fn(),
    goToCookiePolicy: vi.fn(),
};

vi.mock('@/hooks/useNavigation', () => ({
    useNavigation: () => mockNavigation,
}));

vi.mock('@/hooks/useConfig.ts', () => ({
    useConfig: vi.fn(),
}));

const mockedUseConfig = vi.mocked(useConfig);

const buildConfig = (showPricingPage: boolean): ClientAppConfiguration =>
    new AppConfigurationBuilder()
        .withTenantOverrides({
            marketingFlags: {
                showPricingPage: toShowPricingPageFlag(showPricingPage),
            },
        })
        .build();

const resetNavigation = () => {
    Object.values(mockNavigation).forEach((fn) => fn.mockClear());
};

describe('Footer', () => {
    beforeEach(() => {
        mockedUseConfig.mockReturnValue(buildConfig(true));
        resetNavigation();
    });

    it('shows the pricing link when the pricing flag is enabled', () => {
        const { container } = render(<Footer />);

        // Pricing link now uses aria-label instead of data-testid
        expect(screen.getByRole('button', { name: 'Go to pricing page' })).toBeInTheDocument();
        const grid = container.querySelector('.grid');
        expect(grid?.classList.contains('md:grid-cols-3')).toBe(true);
    });

    it('hides the pricing section when the pricing flag is disabled', () => {
        mockedUseConfig.mockReturnValue(buildConfig(false));
        const { container } = render(<Footer />);

        // Pricing link now uses aria-label instead of data-testid
        expect(screen.queryByRole('button', { name: 'Go to pricing page' })).not.toBeInTheDocument();
        const grid = container.querySelector('.grid');
        expect(grid?.classList.contains('md:grid-cols-2')).toBe(true);
    });

    it('hides the pricing section while config is loading', () => {
        mockedUseConfig.mockReturnValue(null);
        const { container } = render(<Footer />);

        // Pricing link now uses aria-label instead of data-testid
        expect(screen.queryByRole('button', { name: 'Go to pricing page' })).not.toBeInTheDocument();
        const grid = container.querySelector('.grid');
        expect(grid?.classList.contains('md:grid-cols-2')).toBe(true);
    });
});
