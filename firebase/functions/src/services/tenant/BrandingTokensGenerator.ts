import type { BrandingTokens, TenantBranding } from '@billsplit-wl/shared';
import type { AdminUpsertTenantRequest } from '../../schemas/tenant';

/**
 * Generates complete brandingTokens from simple branding colors.
 * This creates a full design token system with palette, typography, spacing, etc.
 * based on the provided branding configuration.
 */
export function generateBrandingTokens(branding: AdminUpsertTenantRequest['branding']): TenantBranding {
    const primaryColor = branding.primaryColor || '#2563eb';
    const secondaryColor = branding.secondaryColor || '#7c3aed';
    const accentColor = branding.accentColor || '#f97316';
    const surfaceColor = branding.surfaceColor || '#ffffff';
    const textColor = branding.textColor || '#111827';

    // Helper to calculate relative luminance (0 = black, 1 = white)
    const getLuminance = (color: string): number => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        // Simplified luminance calculation
        return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    // Helper to pick contrasting foreground color
    const getContrastingForeground = (bgColor: string): `#${string}` => {
        return getLuminance(bgColor) > 0.5 ? '#171717' as `#${string}` : '#ffffff' as `#${string}`;
    };

    // Helper to adjust color brightness (positive = darken, negative = lighten)
    const adjustColor = (color: string, amount: number): string => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        let newR: number, newG: number, newB: number;

        if (amount >= 0) {
            // Darken: reduce brightness
            newR = Math.max(0, Math.floor(r * (1 - amount)));
            newG = Math.max(0, Math.floor(g * (1 - amount)));
            newB = Math.max(0, Math.floor(b * (1 - amount)));
        } else {
            // Lighten: increase brightness towards 255
            const lightenAmount = Math.abs(amount);
            newR = Math.min(255, Math.floor(r + (255 - r) * lightenAmount));
            newG = Math.min(255, Math.floor(g + (255 - g) * lightenAmount));
            newB = Math.min(255, Math.floor(b + (255 - b) * lightenAmount));
        }

        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };

    const tokens: BrandingTokens = {
        version: 1,
        palette: {
            primary: primaryColor as `#${string}`,
            primaryVariant: adjustColor(primaryColor, 0.1) as `#${string}`,
            secondary: secondaryColor as `#${string}`,
            secondaryVariant: adjustColor(secondaryColor, 0.1) as `#${string}`,
            accent: accentColor as `#${string}`,
            neutral: surfaceColor as `#${string}`,
            neutralVariant: adjustColor(surfaceColor, 0.05) as `#${string}`,
            success: '#22c55e' as `#${string}`,
            warning: '#eab308' as `#${string}`,
            danger: '#ef4444' as `#${string}`,
            info: '#38bdf8' as `#${string}`,
        },
        typography: {
            fontFamily: {
                sans: 'Space Grotesk, Inter, system-ui, -apple-system, BlinkMacSystemFont',
                serif: 'Fraunces, Georgia, serif',
                mono: 'Geist Mono, JetBrains Mono, SF Mono, monospace',
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
            logoUrl: branding.logoUrl,
            faviconUrl: branding.faviconUrl,
        },
        legal: {
            companyName: 'Acme Labs',
            supportEmail: 'support@example.test',
            privacyPolicyUrl: 'https://example.test/legal/privacy',
            termsOfServiceUrl: 'https://example.test/legal/terms',
        },
        semantics: {
            colors: {
                surface: {
                    base: surfaceColor as `#${string}`,
                    // For dark surfaces, lighten more significantly; for light surfaces, darken slightly
                    raised: adjustColor(surfaceColor, getLuminance(surfaceColor) < 0.5 ? -0.15 : 0.02) as `#${string}`,
                    sunken: adjustColor(surfaceColor, getLuminance(surfaceColor) < 0.5 ? 0.1 : 0.05) as `#${string}`,
                    overlay: textColor as `#${string}`,
                    warning: '#fef3c7' as `#${string}`,
                },
                text: {
                    primary: textColor as `#${string}`,
                    secondary: adjustColor(textColor, -0.3) as `#${string}`,
                    muted: adjustColor(textColor, -0.5) as `#${string}`,
                    inverted: surfaceColor as `#${string}`,
                    accent: accentColor as `#${string}`,
                },
                interactive: {
                    primary: primaryColor as `#${string}`,
                    primaryHover: adjustColor(primaryColor, 0.1) as `#${string}`,
                    primaryActive: adjustColor(primaryColor, 0.15) as `#${string}`,
                    primaryForeground: getContrastingForeground(primaryColor),
                    secondary: secondaryColor as `#${string}`,
                    secondaryHover: adjustColor(secondaryColor, 0.1) as `#${string}`,
                    secondaryActive: adjustColor(secondaryColor, 0.15) as `#${string}`,
                    secondaryForeground: getContrastingForeground(secondaryColor),
                    destructive: '#ef4444' as `#${string}`,
                    destructiveHover: '#dc3e3e' as `#${string}`,
                    destructiveActive: '#c93838' as `#${string}`,
                    destructiveForeground: '#ffffff' as `#${string}`,
                    accent: accentColor as `#${string}`,
                },
                border: {
                    // For dark surfaces, lighten borders; for light surfaces, darken them
                    subtle: adjustColor(surfaceColor, getLuminance(surfaceColor) < 0.5 ? -0.15 : 0.1) as `#${string}`,
                    default: adjustColor(surfaceColor, getLuminance(surfaceColor) < 0.5 ? -0.25 : 0.2) as `#${string}`,
                    strong: adjustColor(surfaceColor, getLuminance(surfaceColor) < 0.5 ? -0.35 : 0.3) as `#${string}`,
                    focus: accentColor as `#${string}`,
                    warning: '#fbbf24' as `#${string}`,
                },
                status: {
                    success: '#22c55e' as `#${string}`,
                    warning: '#eab308' as `#${string}`,
                    danger: '#ef4444' as `#${string}`,
                    info: '#38bdf8' as `#${string}`,
                },
                gradient: {
                    // Primary button gradient - from primary to slightly darker variant
                    primary: [primaryColor, adjustColor(primaryColor, 0.15)] as [`#${string}`, `#${string}`],
                    // Accent gradient - from accent to primary
                    accent: [accentColor, primaryColor] as [`#${string}`, `#${string}`],
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

    return { tokens };
}
