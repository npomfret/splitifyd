import { Footer } from '@/components/layout/Footer';
import { useConfig } from '@/hooks/useConfig.ts';
import type { ClientAppConfiguration, TenantConfig } from '@billsplit-wl/shared';
import { TenantConfigBuilder } from '@billsplit-wl/shared';
import { AppConfigurationBuilder } from '@billsplit-wl/test-support';
import { render, screen } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/hooks/useConfig.ts', () => ({
    useConfig: vi.fn(),
}));

const mockedUseConfig = vi.mocked(useConfig);

function buildTenantWithFooterLinks(links: Array<{ id: string; label: string; url: string; }>): TenantConfig {
    const tenant = new TenantConfigBuilder().build();
    // Add footer links to the branding tokens
    tenant.brandingTokens!.tokens.footer = { links };
    tenant.brandingTokens!.tokens.legal.appName = 'Test App';
    return tenant;
}

function buildConfigWithFooterLinks(links: Array<{ id: string; label: string; url: string; }>): ClientAppConfiguration {
    return new AppConfigurationBuilder()
        .withTenantConfig(buildTenantWithFooterLinks(links))
        .build();
}

function buildConfigWithNoFooterLinks(): ClientAppConfiguration {
    return new AppConfigurationBuilder()
        .withTenantConfig(buildTenantWithFooterLinks([]))
        .build();
}

describe('Footer', () => {
    beforeEach(() => {
        mockedUseConfig.mockReset();
    });

    it('renders footer links from tenant configuration', () => {
        const links = [
            { id: 'terms', label: 'Terms of Service', url: 'https://example.com/terms' },
            { id: 'privacy', label: 'Privacy Policy', url: 'https://example.com/privacy' },
        ];
        mockedUseConfig.mockReturnValue(buildConfigWithFooterLinks(links));

        render(<Footer />);

        expect(screen.getByText('Terms of Service')).toBeInTheDocument();
        expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    });

    it('renders footer links as external links with correct attributes', () => {
        const links = [
            { id: 'terms', label: 'Terms of Service', url: 'https://example.com/terms' },
        ];
        mockedUseConfig.mockReturnValue(buildConfigWithFooterLinks(links));

        render(<Footer />);

        const link = screen.getByText('Terms of Service');
        expect(link).toHaveAttribute('href', 'https://example.com/terms');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows two-column layout when footer links are present', () => {
        const links = [
            { id: 'terms', label: 'Terms', url: 'https://example.com/terms' },
        ];
        mockedUseConfig.mockReturnValue(buildConfigWithFooterLinks(links));

        const { container } = render(<Footer />);

        const grid = container.querySelector('.grid');
        expect(grid?.classList.contains('md:grid-cols-2')).toBe(true);
    });

    it('shows single-column layout when no footer links are configured', () => {
        mockedUseConfig.mockReturnValue(buildConfigWithNoFooterLinks());

        const { container } = render(<Footer />);

        const grid = container.querySelector('.grid');
        expect(grid?.classList.contains('md:grid-cols-2')).toBe(false);
    });

    it('shows single-column layout while config is loading', () => {
        mockedUseConfig.mockReturnValue(null);

        const { container } = render(<Footer />);

        const grid = container.querySelector('.grid');
        expect(grid?.classList.contains('md:grid-cols-2')).toBe(false);
    });

    it('displays app name from tenant legal config', () => {
        mockedUseConfig.mockReturnValue(buildConfigWithNoFooterLinks());

        render(<Footer />);

        expect(screen.getByText('Test App')).toBeInTheDocument();
    });

    it('falls back to translation key when legal config is not available', () => {
        mockedUseConfig.mockReturnValue(null);

        render(<Footer />);

        // The mock t() function returns the key as-is
        expect(screen.getByText('footer.companyName')).toBeInTheDocument();
    });

    it('renders links section header when links are present', () => {
        const links = [
            { id: 'terms', label: 'Terms', url: 'https://example.com/terms' },
        ];
        mockedUseConfig.mockReturnValue(buildConfigWithFooterLinks(links));

        render(<Footer />);

        // The mock t() function returns the key as-is
        expect(screen.getByText('footer.linksSection')).toBeInTheDocument();
    });

    it('does not render links section when no links configured', () => {
        mockedUseConfig.mockReturnValue(buildConfigWithNoFooterLinks());

        render(<Footer />);

        expect(screen.queryByText('footer.linksSection')).not.toBeInTheDocument();
    });
});
