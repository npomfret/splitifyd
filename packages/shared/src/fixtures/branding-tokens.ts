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

const baseTypography = {
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
} as const satisfies BrandingTokens['typography'];

const baseSpacing = {
    '2xs': '0.125rem',
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
} as const satisfies BrandingTokens['spacing'];

const baseSpacingSemantics = {
    pagePadding: '1.5rem',
    sectionGap: '2rem',
    cardPadding: '1rem',
    componentGap: '0.75rem',
} as const satisfies BrandingTokens['semantics']['spacing'];

const baseRadii = {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '16px',
    pill: '999px',
    full: '9999px',
} as const satisfies BrandingTokens['radii'];

const baseShadows = {
    sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
    md: '0 4px 12px rgba(15, 23, 42, 0.12)',
    lg: '0 20px 60px rgba(15, 23, 42, 0.18)',
} as const satisfies BrandingTokens['shadows'];

const buildSemantics = (palette: BrandingTokens['palette']): BrandingTokens['semantics'] => ({
    colors: {
        surface: {
            base: palette.neutral,
            raised: tint(palette.neutral, 0.04),
            sunken: darken(palette.neutral, 0.04),
            overlay: '#0f172a',
        },
        text: {
            primary: '#0f172a',
            secondary: '#475569',
            muted: '#94a3b8',
            inverted: '#ffffff',
            accent: palette.accent,
        },
        interactive: {
            primary: palette.primary,
            primaryHover: darken(palette.primary, 0.06),
            primaryActive: darken(palette.primary, 0.12),
            primaryForeground: '#ffffff',
            secondary: palette.secondary,
            secondaryHover: darken(palette.secondary, 0.08),
            secondaryActive: darken(palette.secondary, 0.16),
            secondaryForeground: '#ffffff',
            destructive: palette.danger,
            destructiveHover: darken(palette.danger, 0.08),
            destructiveActive: darken(palette.danger, 0.12),
            destructiveForeground: '#ffffff',
        },
        border: {
            subtle: '#e2e8f0',
            default: '#cbd5f5',
            strong: '#94a3b8',
            focus: palette.accent,
        },
        status: {
            success: palette.success,
            warning: palette.warning,
            danger: palette.danger,
            info: palette.info,
        },
    },
    spacing: baseSpacingSemantics,
    typography: baseTypography.semantics,
});

const buildTokens = (input: Omit<BrandingTokens, 'semantics'> & { semantics?: BrandingTokens['semantics'] }): BrandingTokens => {
    const { semantics, ...rest } = input;
    const tokens = BrandingTokensSchema.parse({ ...rest, semantics: semantics ?? buildSemantics(rest.palette) });
    return tokens;
};

const defaultPalette = {
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
} as BrandingTokens['palette'];

const localhostPalette: BrandingTokens['palette'] = {
    ...defaultPalette,
    primary: '#0f766e',
    primaryVariant: '#0d524b',
    secondary: '#0891b2',
    secondaryVariant: '#0e7490',
    accent: '#f43f5e',
};

const loopbackPalette: BrandingTokens['palette'] = {
    ...defaultPalette,
    primary: '#9333ea',
    primaryVariant: '#7e22ce',
    secondary: '#fb7185',
    secondaryVariant: '#f43f5e',
    accent: '#f59e0b',
};

const baseTokens: Omit<BrandingTokens, 'semantics'> = {
    version: 1,
    palette: defaultPalette,
    typography: baseTypography,
    spacing: baseSpacing,
    radii: baseRadii,
    shadows: baseShadows,
    assets: {
        logoUrl: 'https://static.splitifyd.dev/branding/default/logo.svg',
        wordmarkUrl: 'https://static.splitifyd.dev/branding/default/wordmark.svg',
        faviconUrl: 'https://static.splitifyd.dev/branding/default/favicon.png',
        heroIllustrationUrl: 'https://static.splitifyd.dev/branding/default/hero.png',
        backgroundTextureUrl: 'https://static.splitifyd.dev/branding/default/texture.png',
    },
    legal: {
        companyName: 'Splitifyd Labs',
        supportEmail: 'support@splitifyd.test',
        privacyPolicyUrl: 'https://splitifyd.test/legal/privacy',
        termsOfServiceUrl: 'https://splitifyd.test/legal/terms',
    },
};

export const defaultBrandingTokens = buildTokens(baseTokens);

export const localhostBrandingTokens = buildTokens({
    ...baseTokens,
    palette: localhostPalette,
    assets: {
        ...baseTokens.assets,
        logoUrl: 'https://static.splitifyd.dev/branding/localhost/logo.svg',
        faviconUrl: 'https://static.splitifyd.dev/branding/localhost/favicon.png',
    },
});

export const loopbackBrandingTokens = buildTokens({
    ...baseTokens,
    palette: loopbackPalette,
    assets: {
        ...baseTokens.assets,
        logoUrl: 'https://static.splitifyd.dev/branding/loopback/logo.svg',
        faviconUrl: 'https://static.splitifyd.dev/branding/loopback/favicon.png',
    },
});

export const brandingTokenFixtures = {
    default: defaultBrandingTokens,
    localhost: localhostBrandingTokens,
    loopback: loopbackBrandingTokens,
};

export type BrandingTokenFixtureKey = keyof typeof brandingTokenFixtures;
