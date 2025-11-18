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
    primary: '#4f46e5', // Indigo
    primaryVariant: '#4338ca',
    secondary: '#ec4899', // Pink
    secondaryVariant: '#db2777',
    accent: '#22d3ee', // Cyan (neon)
    neutral: '#05060a', // Near black
    neutralVariant: '#0f172a',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    info: '#38bdf8',
};

const auroraSemantics: BrandingTokens['semantics'] = {
    colors: {
        surface: {
            base: '#1a1d2e', // Lighter dark blue-gray base
            raised: '#252944', // SOLID opaque for dropdowns/menus - fully readable
            sunken: '#12141f', // Deeper shadow
            overlay: '#1e2336', // SOLID opaque for modals - high readability
            warning: '#fef3c7',
            muted: 'rgba(40, 45, 65, 0.7)', // Lighter muted surface for secondary buttons
            // Glassmorphism with more transparency
            glass: 'rgba(25, 30, 50, 0.45)', // More transparent glass for better aurora visibility
            glassBorder: 'rgba(255, 255, 255, 0.12)', // Brighter glass border
            aurora: '#000000',
            spotlight: '#ffffff',
        },
        text: {
            primary: '#ffffff', // Pure white for better contrast
            secondary: '#e2e8f0', // Lighter secondary text
            muted: 'rgba(255, 255, 255, 0.65)', // Lighter muted text
            inverted: '#0a0d15', // Dark text for light backgrounds
            accent: '#34d399', // Teal accent for links/highlights
            // Advanced text
            hero: '#ffffff',
            eyebrow: 'rgba(203, 213, 225, 0.9)', // Lighter uppercase labels
            code: '#22d3ee',
        },
        interactive: {
            primary: '#34d399', // Teal gradient start
            primaryHover: '#2dd4bf', // Lighter teal on hover
            primaryActive: '#14b8a6', // Darker teal when pressed
            primaryForeground: '#0a0d15', // Dark text on teal button
            secondary: 'rgba(255, 255, 255, 0.08)', // Lighter glass secondary button
            secondaryHover: 'rgba(255, 255, 255, 0.14)',
            secondaryActive: 'rgba(255, 255, 255, 0.20)',
            secondaryForeground: '#ffffff',
            accent: '#22d3ee', // Cyan accents
            destructive: '#f87171', // Softer red for errors
            destructiveHover: '#ef4444',
            destructiveActive: '#dc2626',
            destructiveForeground: '#ffffff',
            // Advanced interactions
            ghost: 'rgba(255, 255, 255, 0.08)',
            magnetic: '#4f46e5',
            glow: 'rgba(52, 211, 153, 0.25)', // Brighter teal glow
        },
        border: {
            subtle: 'rgba(255, 255, 255, 0.06)',
            default: 'rgba(255, 255, 255, 0.12)', // More visible borders
            strong: 'rgba(255, 255, 255, 0.18)',
            focus: '#34d399', // Teal focus rings
            warning: '#fde047',
        },
        status: {
            success: '#34d399', // Teal for success
            warning: '#fbbf24',
            danger: '#f87171',
            info: '#22d3ee',
        },
        // Gradients - brighter aurora effect
        gradient: {
            primary: ['#34d399', '#22d3ee'], // Teal to cyan
            accent: ['#22d3ee', '#34d399'], // Reversed
            aurora: ['#6366f1', '#ec4899', '#22d3ee', '#34d399'], // Brighter spectrum
            text: ['#34d399', '#22d3ee'], // Gradient text effect
        },
    },
    spacing: {
        pagePadding: 'clamp(1.5rem, 4vw, 3rem)', // Fluid padding
        sectionGap: 'clamp(2rem, 5vw, 3.5rem)',
        cardPadding: 'clamp(1rem, 3vw, 2rem)',
        componentGap: '0.75rem',
    },
    typography: auroraTypography.semantics,
};

const auroraShadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.06)',
    lg: '0 20px 60px rgba(5, 6, 10, 0.45), 0 0 30px rgba(52, 211, 153, 0.1)', // Soft shadow with teal glow
} as const satisfies BrandingTokens['shadows'];

const auroraRadii = {
    none: '0px',
    sm: '12px', // Slightly more rounded
    md: '18px', // Comfortable radius for cards
    lg: '28px', // Hero/large card radius
    pill: '999px',
    full: '9999px',
} as const satisfies BrandingTokens['radii'];

const auroraMotion = {
    duration: {
        instant: 50,
        fast: 150,
        base: 320, // Primary transition duration
        slow: 500,
        glacial: 1200,
    },
    easing: {
        standard: 'cubic-bezier(0.22, 1, 0.36, 1)', // Natural ease-out
        decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        accelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    enableParallax: true, // Enables aurora background animation
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
    primary: '#a1a1aa', // Gray 400
    primaryVariant: '#71717a',
    secondary: '#d4d4d8', // Gray 300
    secondaryVariant: '#a1a1aa',
    accent: '#a1a1aa',
    neutral: '#e5e5e5', // Light grey (no white!)
    neutralVariant: '#d4d4d4',
    success: '#a1a1aa',
    warning: '#a1a1aa',
    danger: '#a1a1aa',
    info: '#a1a1aa',
};

const brutalistSemantics: BrandingTokens['semantics'] = {
    colors: {
        surface: {
            base: '#c8c8c8', // Grey 350 - main background
            raised: '#ececec', // Grey 100 - cards, elevated elements
            sunken: '#b8b8b8', // Grey 400 - depressed areas (input fields)
            overlay: '#262626', // Grey 800 - dark overlays
            warning: '#fef3c7', // Keep warning visible
            muted: '#909090', // Grey 500 - disabled/muted surfaces (darker for visibility)
            // No glassmorphism
            glass: undefined,
            glassBorder: undefined,
            aurora: undefined,
            spotlight: undefined,
        },
        text: {
            primary: '#171717', // Grey 900 - primary text
            secondary: '#404040', // Grey 700 - secondary text
            muted: '#737373', // Grey 500 - muted text
            inverted: '#e8e8e8', // Grey 200 - text on dark backgrounds
            accent: '#525252', // Grey 600 - accent text
            disabled: '#a3a3a3', // Grey 400 - disabled text
            // No advanced text
            hero: undefined,
            eyebrow: undefined,
            code: undefined,
        },
        interactive: {
            primary: '#404040', // Grey 700 - primary buttons (darker for contrast)
            primaryHover: '#303030', // Grey 750 - hover state
            primaryActive: '#202020', // Grey 800 - active state
            primaryForeground: '#f5f5f5', // Grey 100 - text on buttons
            secondary: '#a8a8a8', // Grey 450 - secondary buttons (darker for visibility)
            secondaryHover: '#888888', // Grey 500 - hover
            secondaryActive: '#707070', // Grey 550 - active
            secondaryForeground: '#171717', // Grey 900 - text
            accent: '#606060', // Grey 600 - accent elements
            destructive: '#505050', // Grey 650 - destructive actions
            destructiveHover: '#404040', // Grey 700
            destructiveActive: '#303030', // Grey 750
            destructiveForeground: '#f5f5f5', // Grey 100
            // No advanced interactions
            ghost: undefined,
            magnetic: undefined,
            glow: undefined,
        },
        border: {
            subtle: '#d8d8d8', // Grey 250 - subtle borders
            default: '#888888', // Grey 500 - default borders (stronger)
            strong: '#606060', // Grey 600 - strong borders
            focus: '#404040', // Grey 700 - focus rings (darker for visibility)
            warning: '#fde047', // Keep warning visible
            error: '#888888', // Grey 500 - error borders
        },
        status: {
            success: '#8a8a8a', // Grey 450
            warning: '#a3a3a3', // Grey 400
            danger: '#8a8a8a', // Grey 450
            info: '#a3a3a3', // Grey 400
        },
        // Solid color "gradients" (no actual gradient effect for brutalism)
        gradient: {
            primary: ['#404040', '#404040'], // Solid dark grey
            accent: ['#606060', '#606060'], // Solid medium grey
            text: ['#171717', '#171717'], // Solid black text
        },
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
    sm: '0 1px 3px rgba(0, 0, 0, 0.15)',
    md: '0 3px 6px rgba(0, 0, 0, 0.20)',
    lg: '0 8px 16px rgba(0, 0, 0, 0.25)',
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
    companyName: 'Acme Labs',
    supportEmail: 'support@example.test',
    privacyPolicyUrl: 'https://example.test/legal/privacy',
    termsOfServiceUrl: 'https://example.test/legal/terms',
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
