import type { BrandingTokens } from '@billsplit-wl/shared';

export class BrandingTokensBuilder {
    private tokens: BrandingTokens;

    constructor() {
        this.tokens = this.createDefaultTokens();
    }

    private createDefaultTokens(): BrandingTokens {
        return {
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
                appName: 'Test App',
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
                        muted: '#e2e8f0',
                        skeleton: '#e2e8f0',
                        skeletonShimmer: '#f1f5f9',
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
        };
    }

    withPrimaryColor(color: string): this {
        this.tokens.palette.primary = color as `#${string}`;
        return this;
    }

    withSecondaryColor(color: string): this {
        this.tokens.palette.secondary = color as `#${string}`;
        return this;
    }

    withAccentColor(color: string): this {
        this.tokens.palette.accent = color as `#${string}`;
        return this;
    }

    withMotionEnabled(): this {
        this.tokens.motion = {
            ...this.tokens.motion,
            enableParallax: true,
            enableMagneticHover: true,
            enableScrollReveal: true,
        };
        return this;
    }

    withMotionDisabled(): this {
        this.tokens.motion = {
            ...this.tokens.motion,
            enableParallax: false,
            enableMagneticHover: false,
            enableScrollReveal: false,
        };
        return this;
    }

    withSkeletonColors(skeleton: string, skeletonShimmer: string): this {
        this.tokens.semantics.colors.surface.skeleton = skeleton as any;
        this.tokens.semantics.colors.surface.skeletonShimmer = skeletonShimmer as any;
        return this;
    }

    withGlassColors(glass: string, glassBorder: string): this {
        this.tokens.semantics.colors.surface.glass = glass as any;
        this.tokens.semantics.colors.surface.glassBorder = glassBorder as any;
        return this;
    }

    withFontFamily(fonts: { sans?: string; serif?: string; mono?: string }): this {
        if (fonts.sans) this.tokens.typography.fontFamily.sans = fonts.sans;
        if (fonts.serif) this.tokens.typography.fontFamily.serif = fonts.serif;
        if (fonts.mono) this.tokens.typography.fontFamily.mono = fonts.mono;
        return this;
    }

    withLogoUrl(logoUrl: string): this {
        this.tokens.assets.logoUrl = logoUrl;
        return this;
    }

    withWordmarkUrl(wordmarkUrl: string | undefined): this {
        this.tokens.assets.wordmarkUrl = wordmarkUrl;
        return this;
    }

    withMotionFlags(flags: { enableParallax?: boolean; enableMagneticHover?: boolean; enableScrollReveal?: boolean }): this {
        this.tokens.motion = {
            ...this.tokens.motion,
            ...(flags.enableParallax !== undefined && { enableParallax: flags.enableParallax }),
            ...(flags.enableMagneticHover !== undefined && { enableMagneticHover: flags.enableMagneticHover }),
            ...(flags.enableScrollReveal !== undefined && { enableScrollReveal: flags.enableScrollReveal }),
        };
        return this;
    }

    withAllPaletteColors(color: string): this {
        const typedColor = color as `#${string}`;
        this.tokens.palette = {
            primary: typedColor,
            primaryVariant: typedColor,
            secondary: typedColor,
            secondaryVariant: typedColor,
            accent: typedColor,
            neutral: typedColor,
            neutralVariant: typedColor,
            success: typedColor,
            warning: typedColor,
            danger: typedColor,
            info: typedColor,
        };
        return this;
    }

    withCompanyName(companyName: string): this {
        this.tokens.legal.companyName = companyName;
        return this;
    }

    withAppName(appName: string): this {
        this.tokens.legal.appName = appName;
        return this;
    }

    withFaviconUrl(faviconUrl: string): this {
        this.tokens.assets.faviconUrl = faviconUrl;
        return this;
    }

    withGradient(gradient: { primary?: [string, string]; accent?: [string, string]; aurora?: string[] }): this {
        if (!this.tokens.semantics.colors.gradient) {
            this.tokens.semantics.colors.gradient = {};
        }
        if (gradient.primary) {
            this.tokens.semantics.colors.gradient.primary = gradient.primary as any;
        }
        if (gradient.accent) {
            this.tokens.semantics.colors.gradient.accent = gradient.accent as any;
        }
        if (gradient.aurora) {
            this.tokens.semantics.colors.gradient.aurora = gradient.aurora as any;
        }
        return this;
    }

    build(): BrandingTokens {
        return JSON.parse(JSON.stringify(this.tokens));
    }
}
