import { BrandingTokens, BrandingTokensSchema, HexColor } from '../types/branding';

const tint = (hex: HexColor, factor: number): HexColor => {
    const value = hex.replace('#', '');
    const chunk = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
    const r = parseInt(chunk.slice(0, 2), 16);
    const g = parseInt(chunk.slice(2, 4), 16);
    const b = parseInt(chunk.slice(4, 6), 16);
    const mix = (channel: number): number => Math.round(channel + (255 - channel) * factor);
    const next = `#${[mix(r), mix(g), mix(b)].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    return next as HexColor;
};

const darken = (hex: HexColor, factor: number): HexColor => {
    const value = hex.replace('#', '');
    const chunk = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
    const r = parseInt(chunk.slice(0, 2), 16);
    const g = parseInt(chunk.slice(2, 4), 16);
    const b = parseInt(chunk.slice(4, 6), 16);
    const mix = (channel: number): number => Math.round(channel * (1 - factor));
    const next = `#${[mix(r), mix(g), mix(b)].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    return next as HexColor;
};

// ============================================================================
// Aurora Theme (localhost) - "Cinematic Glassmorphism"
// ============================================================================

const auroraTypography = {
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
        wider: '0.08rem',
        eyebrow: '0.15rem',
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
    // Fluid typography scales
    fluidScale: {
        xs: 'clamp(0.75rem, 0.9vw, 0.875rem)',
        sm: 'clamp(0.875rem, 1vw, 1rem)',
        base: 'clamp(1rem, 1.2vw, 1.125rem)',
        lg: 'clamp(1.125rem, 1.5vw, 1.25rem)',
        xl: 'clamp(1.25rem, 2vw, 1.5rem)',
        '2xl': 'clamp(1.5rem, 2.5vw, 1.875rem)',
        '3xl': 'clamp(1.875rem, 3vw, 2.25rem)',
        '4xl': 'clamp(2.25rem, 4vw, 3rem)',
        hero: 'clamp(2.5rem, 5vw, 3.75rem)',
    },
} as const satisfies BrandingTokens['typography'];

const auroraPalette: BrandingTokens['palette'] = {
    primary: '#4f46e5',      // Indigo
    primaryVariant: '#4338ca',
    secondary: '#ec4899',    // Pink
    secondaryVariant: '#db2777',
    accent: '#22d3ee',       // Cyan (neon)
    neutral: '#05060a',      // Near black
    neutralVariant: '#0f172a',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    info: '#38bdf8',
};

const auroraSemantics: BrandingTokens['semantics'] = {
    colors: {
        surface: {
            base: '#090b19',
            raised: '#0f1219',
            sunken: '#05060d',
            overlay: '#0f172a',
            warning: '#fef3c7',
            // Glassmorphism (opacity will be handled in CSS)
            glass: '#090b19',
            glassBorder: '#ffffff',
            aurora: '#000000',
            spotlight: '#ffffff',
        },
        text: {
            primary: '#f8fafc',
            secondary: '#cbd5e1',
            muted: '#94a3b8',
            inverted: '#0f172a',
            accent: '#22d3ee',
            // Advanced text
            hero: '#ffffff',
            eyebrow: '#94a3b8',
            code: '#22d3ee',
        },
        interactive: {
            primary: '#4f46e5',
            primaryHover: '#4338ca',
            primaryActive: '#3730a3',
            primaryForeground: '#ffffff',
            secondary: '#ec4899',
            secondaryHover: '#db2777',
            secondaryActive: '#be185d',
            secondaryForeground: '#ffffff',
            accent: '#22d3ee',
            destructive: '#ef4444',
            destructiveHover: '#dc2626',
            destructiveActive: '#b91c1c',
            destructiveForeground: '#ffffff',
            // Advanced interactions (opacity in CSS)
            ghost: '#ffffff',
            magnetic: '#4f46e5',
            glow: '#22d3ee',
        },
        border: {
            subtle: '#1e293b',
            default: '#334155',
            strong: '#475569',
            focus: '#22d3ee',
            warning: '#fde047',
        },
        status: {
            success: '#22c55e',
            warning: '#eab308',
            danger: '#ef4444',
            info: '#38bdf8',
        },
        // Gradients
        gradient: {
            primary: ['#4f46e5', '#ec4899'],
            accent: ['#22d3ee', '#34d399'],
            aurora: ['#4f46e5', '#ec4899', '#22d3ee', '#34d399'],
            text: ['#22d3ee', '#ec4899'],
        },
    },
    spacing: {
        pagePadding: '1.5rem',
        sectionGap: '2rem',
        cardPadding: '1rem',
        componentGap: '0.75rem',
    },
    typography: auroraTypography.semantics,
};

const auroraShadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.06)',
    lg: '0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.08)',
} as const satisfies BrandingTokens['shadows'];

const auroraRadii = {
    none: '0px',
    sm: '8px',
    md: '12px',
    lg: '18px',
    pill: '999px',
    full: '9999px',
} as const satisfies BrandingTokens['radii'];

const auroraMotion = {
    duration: {
        instant: 50,
        fast: 150,
        base: 320,
        slow: 500,
        glacial: 1200,
    },
    easing: {
        standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
        decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        accelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    enableParallax: true,
    enableMagneticHover: true,
    enableScrollReveal: true,
};

// ============================================================================
// Brutalist Theme (127.0.0.1) - "Intentionally Bland"
// ============================================================================

const brutalistTypography = {
    fontFamily: {
        sans: 'Inter, system-ui, -apple-system, sans-serif',
        mono: 'Monaco, Courier New, monospace',
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
        tight: '0rem',
        normal: '0rem',
        wide: '0rem',
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
    // No fluid scales for brutalist
    fluidScale: undefined,
} as const satisfies BrandingTokens['typography'];

const brutalistPalette: BrandingTokens['palette'] = {
    primary: '#a1a1aa',      // Gray 400
    primaryVariant: '#71717a',
    secondary: '#d4d4d8',    // Gray 300
    secondaryVariant: '#a1a1aa',
    accent: '#a1a1aa',
    neutral: '#fafafa',      // Gray 50
    neutralVariant: '#f4f4f5',
    success: '#a1a1aa',
    warning: '#a1a1aa',
    danger: '#a1a1aa',
    info: '#a1a1aa',
};

const brutalistSemantics: BrandingTokens['semantics'] = {
    colors: {
        surface: {
            base: '#fafafa',
            raised: '#ffffff',
            sunken: '#f4f4f5',
            overlay: '#18181b',
            warning: '#fef3c7',
            // No glassmorphism
            glass: undefined,
            glassBorder: undefined,
            aurora: undefined,
            spotlight: undefined,
        },
        text: {
            primary: '#18181b',
            secondary: '#3f3f46',
            muted: '#71717a',
            inverted: '#fafafa',
            accent: '#18181b',
            // No advanced text
            hero: undefined,
            eyebrow: undefined,
            code: undefined,
        },
        interactive: {
            primary: '#a1a1aa',
            primaryHover: '#71717a',
            primaryActive: '#52525b',
            primaryForeground: '#ffffff',
            secondary: '#d4d4d8',
            secondaryHover: '#a1a1aa',
            secondaryActive: '#71717a',
            secondaryForeground: '#18181b',
            accent: '#a1a1aa',
            destructive: '#a1a1aa',
            destructiveHover: '#71717a',
            destructiveActive: '#52525b',
            destructiveForeground: '#ffffff',
            // No advanced interactions
            ghost: undefined,
            magnetic: undefined,
            glow: undefined,
        },
        border: {
            subtle: '#f4f4f5',
            default: '#e4e4e7',
            strong: '#a1a1aa',
            focus: '#71717a',
            warning: '#fde047',
        },
        status: {
            success: '#a1a1aa',
            warning: '#a1a1aa',
            danger: '#a1a1aa',
            info: '#a1a1aa',
        },
        // No gradients
        gradient: undefined,
    },
    spacing: {
        pagePadding: '1.5rem',
        sectionGap: '2rem',
        cardPadding: '1rem',
        componentGap: '0.75rem',
    },
    typography: brutalistTypography.semantics,
};

const brutalistShadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 4px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.12)',
} as const satisfies BrandingTokens['shadows'];

const brutalistRadii = {
    none: '0px',
    sm: '4px',
    md: '4px',
    lg: '4px',
    pill: '999px',
    full: '9999px',
} as const satisfies BrandingTokens['radii'];

const brutalistMotion = {
    duration: {
        instant: 0,
        fast: 0,
        base: 0,
        slow: 0,
        glacial: 0,
    },
    easing: {
        standard: 'linear',
        decelerate: 'linear',
        accelerate: 'linear',
        spring: 'linear',
    },
    enableParallax: false,
    enableMagneticHover: false,
    enableScrollReveal: false,
};

// ============================================================================
// Default spacing/assets shared across themes
// ============================================================================

const baseSpacing = {
    '2xs': '0.125rem',
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
} as const satisfies BrandingTokens['spacing'];

const baseLegal = {
    companyName: 'Splitifyd Labs',
    supportEmail: 'support@splitifyd.test',
    privacyPolicyUrl: 'https://splitifyd.test/legal/privacy',
    termsOfServiceUrl: 'https://splitifyd.test/legal/terms',
} as const satisfies BrandingTokens['legal'];

// ============================================================================
// Logo assets (served from public directory)
// ============================================================================

// Aurora theme uses the colorful logo with animations (also used as favicon)
const auroraLogoSvg = '/images/aurora-logo.svg';

// Brutalist theme uses the grayscale minimalist logo (also used as favicon)
const brutalistLogoSvg = '/images/brutalist-logo.svg';

// ============================================================================
// Aurora Theme (localhost)
// ============================================================================

export const localhostBrandingTokens: BrandingTokens = BrandingTokensSchema.parse({
    version: 1,
    palette: auroraPalette,
    typography: auroraTypography,
    spacing: baseSpacing,
    radii: auroraRadii,
    shadows: auroraShadows,
    assets: {
        logoUrl: auroraLogoSvg,
        // faviconUrl will default to logoUrl
    },
    legal: baseLegal,
    semantics: auroraSemantics,
    motion: auroraMotion,
});

// ============================================================================
// Brutalist Theme (127.0.0.1)
// ============================================================================

export const loopbackBrandingTokens: BrandingTokens = BrandingTokensSchema.parse({
    version: 1,
    palette: brutalistPalette,
    typography: brutalistTypography,
    spacing: baseSpacing,
    radii: brutalistRadii,
    shadows: brutalistShadows,
    assets: {
        logoUrl: brutalistLogoSvg,
        // faviconUrl will default to logoUrl
    },
    legal: baseLegal,
    semantics: brutalistSemantics,
    motion: brutalistMotion,
});

// ============================================================================
// Default Theme (fallback)
// ============================================================================

export const defaultBrandingTokens: BrandingTokens = loopbackBrandingTokens;

// ============================================================================
// Export all fixtures
// ============================================================================

export const brandingTokenFixtures = {
    default: defaultBrandingTokens,
    localhost: localhostBrandingTokens,
    loopback: loopbackBrandingTokens,
};

export type BrandingTokenFixtureKey = keyof typeof brandingTokenFixtures;
