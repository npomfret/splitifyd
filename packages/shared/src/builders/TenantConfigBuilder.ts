import { toISOString, toShowMarketingContentFlag, toShowPricingPageFlag, toTenantAccentColor, toTenantId, toTenantPrimaryColor, toTenantSecondaryColor } from '../shared-types';
import type { BrandingMarketingFlags, ISOString, TenantConfig, TenantId } from '../shared-types';
import type { FooterLink, TenantBranding } from '../types/branding';

const DEFAULT_BRANDING_TOKENS: TenantBranding = {
    tokens: {
        version: 1,
        palette: {
            primary: '#0066cc',
            primaryVariant: '#0052a3',
            secondary: '#ff6600',
            secondaryVariant: '#cc5200',
            accent: '#00cc66',
            neutral: '#f8fafc',
            neutralVariant: '#e2e8f0',
            success: '#22c55e',
            warning: '#eab308',
            danger: '#ef4444',
            info: '#38bdf8',
        },
        typography: {
            fontFamily: {
                sans: 'Inter, system-ui, sans-serif',
                serif: 'Georgia, serif',
                mono: 'Menlo, monospace',
            },
            sizes: {
                xs: '0.75rem',
                sm: '0.875rem',
                md: '1rem',
                lg: '1.125rem',
                xl: '1.25rem',
                '2xl': '1.5rem',
                '3xl': '1.875rem',
                '4xl': '2.25rem',
                '5xl': '3rem',
            },
            weights: {
                regular: 400,
                medium: 500,
                semibold: 600,
                bold: 700,
            },
            lineHeights: {
                compact: '1.25rem',
                standard: '1.5rem',
                spacious: '1.75rem',
            },
            letterSpacing: {
                tight: '-0.02rem',
                normal: '0rem',
                wide: '0.04rem',
            },
            semantics: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'sm',
                eyebrow: 'xs',
                heading: '2xl',
                display: '4xl',
            },
        },
        spacing: {
            '2xs': '0.125rem',
            xs: '0.25rem',
            sm: '0.5rem',
            md: '0.75rem',
            lg: '1rem',
            xl: '1.5rem',
            '2xl': '2rem',
        },
        radii: {
            none: '0px',
            sm: '4px',
            md: '8px',
            lg: '16px',
            pill: '999px',
            full: '9999px',
        },
        shadows: {
            sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px rgba(0, 0, 0, 0.1)',
            lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
        },
        assets: {
            logoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%230066cc" width="100" height="100"/></svg>',
            faviconUrl: 'data:image/x-icon;base64,AA==',
        },
        legal: {
            appName: 'Test App',
            companyName: 'Test Company',
            supportEmail: 'support@example.com',
        },
        semantics: {
            colors: {
                surface: {
                    base: '#ffffff',
                    raised: '#fafafa',
                    sunken: '#f5f5f5',
                    overlay: 'rgba(0, 0, 0, 0.5)',
                    warning: '#fef3c7',
                },
                text: {
                    primary: '#0f172a',
                    secondary: '#475569',
                    muted: '#94a3b8',
                    inverted: '#ffffff',
                    accent: '#0066cc',
                },
                interactive: {
                    primary: '#0066cc',
                    primaryHover: '#0052a3',
                    primaryActive: '#004080',
                    primaryForeground: '#ffffff',
                    secondary: '#ff6600',
                    secondaryHover: '#cc5200',
                    secondaryActive: '#993d00',
                    secondaryForeground: '#ffffff',
                    destructive: '#ef4444',
                    destructiveHover: '#dc2626',
                    destructiveActive: '#b91c1c',
                    destructiveForeground: '#ffffff',
                    accent: '#00cc66',
                },
                border: {
                    subtle: '#e2e8f0',
                    default: '#cbd5e1',
                    strong: '#94a3b8',
                    focus: '#0066cc',
                    warning: '#fbbf24',
                },
                status: {
                    success: '#22c55e',
                    warning: '#eab308',
                    danger: '#ef4444',
                    info: '#38bdf8',
                },
            },
            spacing: {
                pagePadding: '1.5rem',
                sectionGap: '2rem',
                cardPadding: '1rem',
                componentGap: '0.75rem',
            },
            typography: {
                body: 'md',
                bodyStrong: 'md',
                caption: 'sm',
                button: 'sm',
                eyebrow: 'xs',
                heading: '2xl',
                display: '4xl',
            },
        },
        motion: {
            duration: {
                instant: 50,
                fast: 150,
                base: 250,
                slow: 400,
                glacial: 800,
            },
            easing: {
                standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
                decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
                accelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
                spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            },
            enableParallax: false,
            enableMagneticHover: false,
            enableScrollReveal: false,
        },
    },
};

export class TenantConfigBuilder {
    private config: Partial<TenantConfig> = {};

    constructor(tenantId?: string) {
        this.config.tenantId = toTenantId(tenantId || 'test-tenant');
        this.config.branding = {
            primaryColor: toTenantPrimaryColor('#0066CC'),
            secondaryColor: toTenantSecondaryColor('#FF6600'),
        };
        this.config.brandingTokens = JSON.parse(JSON.stringify(DEFAULT_BRANDING_TOKENS));
        this.config.createdAt = toISOString('2025-01-15T10:00:00.000Z');
        this.config.updatedAt = toISOString('2025-01-20T14:30:00.000Z');
    }

    withTenantId(tenantId: TenantId | string): this {
        this.config.tenantId = toTenantId(tenantId);
        return this;
    }

    withAppName(appName: string): this {
        this.config.brandingTokens!.tokens.legal.appName = appName;
        return this;
    }

    withCompanyName(companyName: string): this {
        this.config.brandingTokens!.tokens.legal.companyName = companyName;
        return this;
    }

    withSupportEmail(supportEmail: string): this {
        this.config.brandingTokens!.tokens.legal.supportEmail = supportEmail;
        return this;
    }

    withLogoUrl(url: string): this {
        this.config.brandingTokens!.tokens.assets.logoUrl = url;
        return this;
    }

    withFaviconUrl(url: string): this {
        this.config.brandingTokens!.tokens.assets.faviconUrl = url;
        return this;
    }

    withPrimaryColor(color: string): this {
        this.config.branding!.primaryColor = toTenantPrimaryColor(color);
        return this;
    }

    withSecondaryColor(color: string): this {
        this.config.branding!.secondaryColor = toTenantSecondaryColor(color);
        return this;
    }

    withAccentColor(color: string): this {
        this.config.branding!.accentColor = toTenantAccentColor(color);
        return this;
    }

    withMarketingFlags(flags: { showMarketingContent?: boolean; showPricingPage?: boolean; }): this {
        const brandedFlags: BrandingMarketingFlags = {};
        if (flags.showMarketingContent !== undefined) {
            brandedFlags.showMarketingContent = toShowMarketingContentFlag(flags.showMarketingContent);
        }
        if (flags.showPricingPage !== undefined) {
            brandedFlags.showPricingPage = toShowPricingPageFlag(flags.showPricingPage);
        }
        this.config.marketingFlags = brandedFlags;
        return this;
    }

    withBrandingTokens(tokens: TenantBranding): this {
        this.config.brandingTokens = tokens;
        return this;
    }

    withFooterLinks(links: FooterLink[]): this {
        this.config.brandingTokens!.tokens.footer = { links };
        return this;
    }

    withShowAppNameInHeader(show: boolean): this {
        this.config.branding!.showAppNameInHeader = show;
        return this;
    }

    withCreatedAt(date: ISOString | string): this {
        this.config.createdAt = toISOString(date);
        return this;
    }

    withUpdatedAt(date: ISOString | string): this {
        this.config.updatedAt = toISOString(date);
        return this;
    }

    build(): TenantConfig {
        return this.config as TenantConfig;
    }
}
