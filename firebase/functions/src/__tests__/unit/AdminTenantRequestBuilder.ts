import type { BrandingTokens, TenantDomainName, TenantId } from '@billsplit-wl/shared';
import {
    toTenantAccentColor,
    toTenantAppName,
    toTenantDefaultFlag,
    toTenantDomainName,
    toTenantFaviconUrl,
    toTenantId,
    toTenantLogoUrl,
    toTenantPrimaryColor,
    toTenantSecondaryColor,
    toTenantThemePaletteName,
} from '@billsplit-wl/shared';
import type { AdminUpsertTenantRequest } from '../../schemas/tenant';

/**
 * Builder for creating AdminUpsertTenantRequest for admin API endpoints.
 * Provides sensible defaults for all the extensive branding and token configuration.
 */
export class AdminTenantRequestBuilder {
    private payload: AdminUpsertTenantRequest;

    constructor(tenantId?: string) {
        this.payload = {
            tenantId: toTenantId(tenantId || 'test-tenant'),
            branding: {
                appName: toTenantAppName('Test Tenant App'),
                logoUrl: toTenantLogoUrl('https://foo/branding/test/logo.svg'),
                faviconUrl: toTenantFaviconUrl('https://foo/branding/test/favicon.png'),
                primaryColor: toTenantPrimaryColor('#2563eb'),
                secondaryColor: toTenantSecondaryColor('#7c3aed'),
                accentColor: toTenantAccentColor('#f97316'),
                themePalette: toTenantThemePaletteName('default'),
            },
            brandingTokens: {
                tokens: {
                    version: 1,
                    palette: {
                        primary: '#2563eb',
                        primaryVariant: '#1d4ed8',
                        secondary: '#7c3aed',
                        secondaryVariant: '#6d28d9',
                        accent: '#f97316',
                        neutral: '#f8fafc',
                        neutralVariant: '#e2e8f0',
                        success: '#22c55e',
                        warning: '#eab308',
                        danger: '#ef4444',
                        info: '#38bdf8',
                    },
                    typography: {
                        fontFamily: {
                            sans: 'Space Grotesk, Inter, system-ui, -apple-system, BlinkMacSystemFont',
                            serif: 'Fraunces, Georgia, serif',
                            mono: 'JetBrains Mono, SFMono-Regular, Menlo, monospace',
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
                        sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
                        md: '0 4px 12px rgba(15, 23, 42, 0.12)',
                        lg: '0 20px 60px rgba(15, 23, 42, 0.18)',
                    },
                    assets: {
                        logoUrl: 'https://foo/branding/test/logo.svg',
                        faviconUrl: 'https://foo/branding/test/favicon.png',
                    },
                    legal: {
                        companyName: 'Test Company',
                        supportEmail: 'support@test.com',
                        privacyPolicyUrl: 'https://test.com/privacy',
                        termsOfServiceUrl: 'https://test.com/terms',
                    },
                    semantics: {
                        colors: {
                            surface: {
                                base: '#f8fafc',
                                raised: '#fafbfc',
                                sunken: '#eff1f3',
                                overlay: '#0f172a',
                                warning: '#fef3c7',
                            },
                            text: {
                                primary: '#0f172a',
                                secondary: '#475569',
                                muted: '#94a3b8',
                                inverted: '#ffffff',
                                accent: '#f97316',
                            },
                            interactive: {
                                primary: '#2563eb',
                                primaryHover: '#224dc7',
                                primaryActive: '#1f45b3',
                                primaryForeground: '#ffffff',
                                secondary: '#7c3aed',
                                secondaryHover: '#7235d9',
                                secondaryActive: '#6730c5',
                                secondaryForeground: '#ffffff',
                                destructive: '#ef4444',
                                destructiveHover: '#dc3e3e',
                                destructiveActive: '#c93838',
                                destructiveForeground: '#ffffff',
                                accent: '#f97316',
                            },
                            border: {
                                subtle: '#e2e8f0',
                                default: '#cbd5f5',
                                strong: '#94a3b8',
                                focus: '#f97316',
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
            },
            domains: {
                primary: toTenantDomainName('foo'),
                aliases: [toTenantDomainName('bar')],
                normalized: [toTenantDomainName('foo'), toTenantDomainName('bar')],
            },
            defaultTenant: toTenantDefaultFlag(false),
        };
    }

    withTenantId(tenantId: TenantId | string): this {
        this.payload.tenantId = typeof tenantId === 'string' ? toTenantId(tenantId) : tenantId;
        return this;
    }

    withAppName(appName: string): this {
        this.payload.branding.appName = toTenantAppName(appName);
        return this;
    }

    withLogoUrl(logoUrl: string): this {
        this.payload.branding.logoUrl = toTenantLogoUrl(logoUrl);
        this.payload.brandingTokens.tokens.assets.logoUrl = logoUrl;
        return this;
    }

    withFaviconUrl(faviconUrl: string): this {
        this.payload.branding.faviconUrl = toTenantFaviconUrl(faviconUrl);
        this.payload.brandingTokens.tokens.assets.faviconUrl = faviconUrl;
        return this;
    }

    withPrimaryColor(color: string): this {
        this.payload.branding.primaryColor = toTenantPrimaryColor(color);
        this.payload.brandingTokens.tokens.palette.primary = color as `#${string}`;
        return this;
    }

    withSecondaryColor(color: string): this {
        this.payload.branding.secondaryColor = toTenantSecondaryColor(color);
        this.payload.brandingTokens.tokens.palette.secondary = color as `#${string}`;
        return this;
    }

    withAccentColor(color: string): this {
        this.payload.branding.accentColor = toTenantAccentColor(color);
        this.payload.brandingTokens.tokens.palette.accent = color as `#${string}`;
        return this;
    }

    withThemePalette(palette: string): this {
        this.payload.branding.themePalette = toTenantThemePaletteName(palette);
        return this;
    }

    withBranding(branding: Partial<AdminUpsertTenantRequest['branding']>): this {
        this.payload.branding = {
            ...this.payload.branding,
            ...branding,
        };
        return this;
    }

    withBrandingTokens(tokens: Partial<AdminUpsertTenantRequest['brandingTokens']>): this {
        this.payload.brandingTokens = {
            ...this.payload.brandingTokens,
            ...tokens,
        } as AdminUpsertTenantRequest['brandingTokens'];
        return this;
    }

    withPrimaryDomain(domain: TenantDomainName | string): this {
        const domainName = typeof domain === 'string' ? toTenantDomainName(domain) : domain;
        this.payload.domains.primary = domainName;

        // Update normalized to include the new primary
        const normalized = new Set([domainName, ...this.payload.domains.aliases]);
        this.payload.domains.normalized = Array.from(normalized);

        return this;
    }

    withDomainAliases(aliases: Array<TenantDomainName | string>): this {
        this.payload.domains.aliases = aliases.map((alias) => typeof alias === 'string' ? toTenantDomainName(alias) : alias);

        // Update normalized
        const normalized = new Set([this.payload.domains.primary, ...this.payload.domains.aliases]);
        this.payload.domains.normalized = Array.from(normalized);

        return this;
    }

    withDomains(domains: AdminUpsertTenantRequest['domains']): this {
        this.payload.domains = { ...domains };
        return this;
    }

    asDefaultTenant(): this {
        this.payload.defaultTenant = toTenantDefaultFlag(true);
        return this;
    }

    asNonDefaultTenant(): this {
        this.payload.defaultTenant = toTenantDefaultFlag(false);
        return this;
    }

    withDefaultTenantFlag(isDefault: boolean): this {
        this.payload.defaultTenant = toTenantDefaultFlag(isDefault);
        return this;
    }

    /**
     * Sets a specific value in the typography letter spacing.
     * Useful for testing edge cases like negative CSS values.
     */
    withLetterSpacing(key: 'tight' | 'normal' | 'wide', value: string): this {
        this.payload.brandingTokens.tokens.typography.letterSpacing[key] = value as any;
        return this;
    }

    /**
     * Overrides a specific color in the palette.
     * Useful for testing validation (e.g., invalid hex colors).
     */
    withPaletteColor(key: 'primary' | 'secondary' | 'accent', value: string): this {
        this.payload.brandingTokens.tokens.palette[key] = value as any;
        return this;
    }

    buildTokens(): BrandingTokens {
        return JSON.parse(JSON.stringify(this.payload.brandingTokens.tokens));
    }

    /**
     * Builds AdminUpsertTenantRequest for use with admin API endpoints.
     * INCLUDES tenantId in the payload.
     */
    build(): AdminUpsertTenantRequest {
        // Deep clone to prevent mutations
        return JSON.parse(JSON.stringify(this.payload));
    }

    /**
     * Static factory method for creating a builder with a specific tenant ID
     */
    static forTenant(tenantId: string): AdminTenantRequestBuilder {
        return new AdminTenantRequestBuilder(tenantId);
    }
}
