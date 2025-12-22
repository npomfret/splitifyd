import type { AdminUpsertTenantRequest, BrandingMarketingFlags, BrandingTokens, TenantBranding, TenantDomainName, TenantId } from '@billsplit-wl/shared';
import { toShowMarketingContentFlag, toShowPricingPageFlag, toTenantAccentColor, toTenantDefaultFlag, toTenantDomainName, toTenantId, toTenantPrimaryColor, toTenantSecondaryColor } from '@billsplit-wl/shared';

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
                primaryColor: toTenantPrimaryColor('#2563eb'),
                secondaryColor: toTenantSecondaryColor('#7c3aed'),
                accentColor: toTenantAccentColor('#f97316'),
            },
            brandingTokens: this.createBaseBrandingTokens(),
            domains: [toTenantDomainName('test.local')],
            defaultTenant: toTenantDefaultFlag(false),
        };
    }

    private createBaseBrandingTokens(): TenantBranding {
        return {
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
                    logoUrl: '/test-assets/logo.svg',
                    faviconUrl: '/test-assets/favicon.png',
                },
                legal: {
                    appName: 'Test Tenant App',
                    companyName: 'Test Company',
                    supportEmail: 'support@test.com',
                },
                semantics: {
                    colors: {
                        surface: {
                            base: '#f8fafc',
                            raised: '#fafbfc',
                            sunken: '#eff1f3',
                            overlay: '#0f172a',
                            warning: '#fef3c7',
                            muted: '#e2e8f0',
                            // Skeleton loader colors (for shimmer animation)
                            skeleton: '#e2e8f0',
                            skeletonShimmer: '#f1f5f9',
                            // Popover/dropdown surfaces
                            popover: '#f8fafc',
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
        };
    }

    private get brandingTokens(): TenantBranding {
        if (!this.payload.brandingTokens) {
            this.payload.brandingTokens = this.createBaseBrandingTokens();
        }
        return this.payload.brandingTokens;
    }

    private get tokens(): BrandingTokens {
        return this.brandingTokens.tokens;
    }

    withTenantId(tenantId: TenantId | string): this {
        this.payload.tenantId = typeof tenantId === 'string' ? toTenantId(tenantId) : tenantId;
        return this;
    }

    withAppName(appName: string): this {
        this.tokens.legal.appName = appName;
        return this;
    }

    withCompanyName(companyName: string): this {
        this.tokens.legal.companyName = companyName;
        return this;
    }

    withSupportEmail(supportEmail: string): this {
        this.tokens.legal.supportEmail = supportEmail;
        return this;
    }

    withLogoUrl(logoUrl: string): this {
        this.tokens.assets.logoUrl = logoUrl;
        return this;
    }

    withFaviconUrl(faviconUrl: string): this {
        this.tokens.assets.faviconUrl = faviconUrl;
        return this;
    }

    withPrimaryColor(color: string): this {
        this.payload.branding.primaryColor = toTenantPrimaryColor(color);
        this.tokens.palette.primary = color as `#${string}`;
        return this;
    }

    withSecondaryColor(color: string): this {
        this.payload.branding.secondaryColor = toTenantSecondaryColor(color);
        this.tokens.palette.secondary = color as `#${string}`;
        return this;
    }

    withAccentColor(color: string): this {
        this.payload.branding.accentColor = toTenantAccentColor(color);
        this.tokens.palette.accent = color as `#${string}`;
        return this;
    }

    withMarketingFlags(flags: { showMarketingContent?: boolean; showPricingPage?: boolean }): this {
        const brandedFlags: Partial<BrandingMarketingFlags> = {};
        if (flags.showMarketingContent !== undefined) {
            brandedFlags.showMarketingContent = toShowMarketingContentFlag(flags.showMarketingContent);
        }
        if (flags.showPricingPage !== undefined) {
            brandedFlags.showPricingPage = toShowPricingPageFlag(flags.showPricingPage);
        }
        this.payload.marketingFlags = {
            ...this.payload.marketingFlags,
            ...brandedFlags,
        };
        return this;
    }

    withBranding(branding: Partial<AdminUpsertTenantRequest['branding']>): this {
        this.payload.branding = {
            ...this.payload.branding,
            ...branding,
        };
        // Sync palette colors with branding colors
        if (branding.primaryColor) {
            this.tokens.palette.primary = branding.primaryColor as `#${string}`;
        }
        if (branding.secondaryColor) {
            this.tokens.palette.secondary = branding.secondaryColor as `#${string}`;
        }
        if (branding.accentColor) {
            this.tokens.palette.accent = branding.accentColor as `#${string}`;
        }
        return this;
    }

    withBrandingTokens(tokens: Partial<AdminUpsertTenantRequest['brandingTokens']>): this {
        this.payload.brandingTokens = {
            ...this.brandingTokens,
            ...tokens,
        } as AdminUpsertTenantRequest['brandingTokens'];
        return this;
    }

    withDomains(domains: Array<TenantDomainName | string>): this {
        this.payload.domains = domains.map((d) => typeof d === 'string' ? toTenantDomainName(d) : d);
        return this;
    }

    withEmptyDomains(): this {
        (this.payload as any).domains = [];
        return this;
    }

    withFontFamily(fonts: { sans?: string; serif?: string; mono?: string; }): this {
        if (fonts.sans) this.tokens.typography.fontFamily.sans = fonts.sans;
        if (fonts.serif) this.tokens.typography.fontFamily.serif = fonts.serif;
        if (fonts.mono) this.tokens.typography.fontFamily.mono = fonts.mono;
        return this;
    }

    withGradient(gradient: { primary?: [string, string]; accent?: [string, string]; aurora?: string[]; }): this {
        if (!this.tokens.semantics.colors.gradient) {
            this.tokens.semantics.colors.gradient = {} as any;
        }
        if (gradient.primary) {
            this.tokens.semantics.colors.gradient!.primary = gradient.primary as any;
        }
        if (gradient.accent) {
            this.tokens.semantics.colors.gradient!.accent = gradient.accent as any;
        }
        if (gradient.aurora) {
            this.tokens.semantics.colors.gradient!.aurora = gradient.aurora as any;
        }
        return this;
    }

    withEmptyGradient(): this {
        this.tokens.semantics.colors.gradient = {} as any;
        return this;
    }

    withGlassColors(glass: string, glassBorder: string): this {
        this.tokens.semantics.colors.surface.glass = glass as any;
        this.tokens.semantics.colors.surface.glassBorder = glassBorder as any;
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
     * Enables Aurora theme features (motion animations + glassmorphism).
     * Useful for testing motion control toggles.
     */
    withAuroraTheme(): this {
        this.tokens.motion!.enableParallax = true;
        this.tokens.motion!.enableMagneticHover = true;
        this.tokens.motion!.enableScrollReveal = true;

        // Add glassmorphism properties
        this.tokens.semantics!.colors!.surface!.glass = 'rgba(25, 30, 50, 0.45)';
        this.tokens.semantics!.colors!.surface!.glassBorder = 'rgba(255, 255, 255, 0.12)';

        return this;
    }

    /**
     * Sets a specific value in the typography letter spacing.
     * Useful for testing edge cases like negative CSS values.
     */
    withLetterSpacing(key: 'tight' | 'normal' | 'wide', value: string): this {
        this.tokens.typography.letterSpacing[key] = value as any;
        return this;
    }

    /**
     * Overrides a specific color in the palette.
     * Useful for testing validation (e.g., invalid hex colors).
     */
    withPaletteColor(key: 'primary' | 'secondary' | 'accent', value: string): this {
        this.tokens.palette[key] = value as any;
        return this;
    }

    buildTokens(): BrandingTokens {
        return JSON.parse(JSON.stringify(this.tokens));
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

    /** For testing validation - sets an invalid (empty) tenant ID */
    withInvalidTenantId(tenantId: string): this {
        (this.payload as any).tenantId = tenantId;
        return this;
    }

    /** For testing validation - sets an invalid primary color in both branding and tokens */
    withInvalidPrimaryColor(color: string): this {
        (this.payload.branding as any).primaryColor = color;
        if (this.payload.brandingTokens?.tokens?.palette) {
            (this.payload.brandingTokens.tokens.palette as any).primary = color;
        }
        return this;
    }
}
