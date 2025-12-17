import { z } from 'zod';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGBA_COLOR_PATTERN = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/i;
const CSS_LENGTH_PATTERN = /^-?\d*\.?\d+(px|rem)$/i;
const FLEXIBLE_LENGTH_PATTERN = /^(?:clamp|min|max)\([\s\S]+\)$|^-?\d*\.?\d+(px|rem|vw|vh|%)$/i;

export type HexColor = `#${string}`;
export type CssColor = `#${string}` | `rgba(${string})` | `rgb(${string})`;
export type CssLength = `${number}${'px' | 'rem'}`;
export type FlexibleLength = string; // Allows clamp(), min(), max(), etc.

export const HexColorSchema = z
    .string()
    .regex(HEX_COLOR_PATTERN, 'Expected hex color (#RRGGBB or #RGB)')
    .transform((value) => value.toLowerCase() as HexColor);

// Flexible color schema that accepts hex or rgba
export const CssColorSchema = z
    .string()
    .refine(
        (value) => HEX_COLOR_PATTERN.test(value) || RGBA_COLOR_PATTERN.test(value),
        'Expected hex color (#RRGGBB) or rgba(r, g, b, a)',
    )
    .transform((value) => value as CssColor);

export const CssLengthSchema = z
    .string()
    .regex(CSS_LENGTH_PATTERN, 'Expected CSS length (px or rem)')
    .transform((value) => value.toLowerCase() as CssLength);

// Flexible length schema that accepts clamp(), px, rem, vw, vh, %
export const FlexibleLengthSchema = z
    .string()
    .regex(FLEXIBLE_LENGTH_PATTERN, 'Expected CSS length (px, rem, vw, vh, %, or clamp())')
    .transform((value) => value as FlexibleLength);

const BrandingPaletteSchema = z.object({
    primary: HexColorSchema,
    primaryVariant: HexColorSchema,
    secondary: HexColorSchema,
    secondaryVariant: HexColorSchema,
    accent: HexColorSchema,
    neutral: HexColorSchema,
    neutralVariant: HexColorSchema,
    success: HexColorSchema,
    warning: HexColorSchema,
    danger: HexColorSchema,
    info: HexColorSchema,
});

const TypographySizeSchema = z.object({
    xs: CssLengthSchema,
    sm: CssLengthSchema,
    md: CssLengthSchema,
    lg: CssLengthSchema,
    xl: CssLengthSchema,
    '2xl': CssLengthSchema,
    '3xl': CssLengthSchema,
    '4xl': CssLengthSchema,
    '5xl': CssLengthSchema,
});

const TypographyWeightSchema = z.object({
    regular: z.number().int().min(100).max(900),
    medium: z.number().int().min(100).max(900),
    semibold: z.number().int().min(100).max(900),
    bold: z.number().int().min(100).max(900),
});

const TypographyLineHeightSchema = z.object({
    compact: CssLengthSchema,
    standard: CssLengthSchema,
    spacious: CssLengthSchema,
});

const TypographyLetterSpacingSchema = z.object({
    tight: CssLengthSchema,
    normal: CssLengthSchema,
    wide: CssLengthSchema,
    // New for advanced tracking
    wider: CssLengthSchema.optional(),
    eyebrow: CssLengthSchema.optional(), // For all-caps labels
});

const TypographySemanticSchema = z.object({
    body: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']),
    bodyStrong: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']),
    caption: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']),
    button: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']),
    eyebrow: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']),
    heading: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']),
    display: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']),
});

// New: Fluid Typography Scale (clamp-based)
const FluidTypographyScaleSchema = z
    .object({
        xs: z.string().optional(), // clamp(0.75rem, 0.9vw, 0.875rem)
        sm: z.string().optional(), // clamp(0.875rem, 1vw, 1rem)
        base: z.string().optional(), // clamp(1rem, 1.2vw, 1.125rem)
        lg: z.string().optional(), // clamp(1.125rem, 1.5vw, 1.25rem)
        xl: z.string().optional(), // clamp(1.25rem, 2vw, 1.5rem)
        '2xl': z.string().optional(), // clamp(1.5rem, 2.5vw, 1.875rem)
        '3xl': z.string().optional(), // clamp(1.875rem, 3vw, 2.25rem)
        '4xl': z.string().optional(), // clamp(2.25rem, 4vw, 3rem)
        hero: z.string().optional(), // clamp(2.5rem, 5vw, 3.75rem)
    })
    .optional();

const BrandingTypographySchema = z.object({
    fontFamily: z.object({
        sans: z.string().min(1),
        serif: z.string().min(1).optional(),
        mono: z.string().min(1),
    }),
    sizes: TypographySizeSchema,
    weights: TypographyWeightSchema,
    lineHeights: TypographyLineHeightSchema,
    letterSpacing: TypographyLetterSpacingSchema,
    semantics: TypographySemanticSchema,
    // New: Fluid typography scale
    fluidScale: FluidTypographyScaleSchema,
});

const BrandingSpacingScaleSchema = z.object({
    '2xs': CssLengthSchema,
    xs: CssLengthSchema,
    sm: CssLengthSchema,
    md: CssLengthSchema,
    lg: CssLengthSchema,
    xl: CssLengthSchema,
    '2xl': CssLengthSchema,
});

const BrandingSpacingSemanticSchema = z.object({
    pagePadding: FlexibleLengthSchema,
    sectionGap: FlexibleLengthSchema,
    cardPadding: FlexibleLengthSchema,
    componentGap: FlexibleLengthSchema,
});

const BrandingRadiiSchema = z.object({
    none: CssLengthSchema,
    sm: CssLengthSchema,
    md: CssLengthSchema,
    lg: CssLengthSchema,
    pill: CssLengthSchema,
    full: CssLengthSchema,
});

const BrandingShadowsSchema = z.object({
    sm: z.string().min(1),
    md: z.string().min(1),
    lg: z.string().min(1),
});

const BrandingAssetsSchema = z.object({
    logoUrl: z.string().min(1).optional(), // Optional - can be absolute URL, relative path, or data URL. Used as favicon if faviconUrl not provided
    faviconUrl: z.string().min(1).optional(), // Optional - defaults to logoUrl if not provided
    // For self-hosted fonts
    fonts: z
        .object({
            headingUrl: z.string().min(1).optional(), // Space Grotesk, etc.
            bodyUrl: z.string().min(1).optional(), // Inter, etc.
            monoUrl: z.string().min(1).optional(), // Geist Mono, etc.
        })
        .optional(),
});

// Sharing/OG Tags configuration for social media previews
// Note: Title and description come from translations (webapp-v2/src/locales/*/translation.json)
const BrandingSharingSchema = z
    .object({
        ogImage: z.string().url().optional(), // Open Graph image URL (1200x630px recommended)
    })
    .optional();

// New: Motion Tokens
const BrandingMotionSchema = z
    .object({
        // Durations (ms) - allow 0 for no motion
        duration: z
            .object({
                instant: z.number().min(0).max(100).optional(), // 0-50ms
                fast: z.number().min(0).max(200).optional(), // 0-150ms
                base: z.number().min(0).max(400).optional(), // 0-320ms
                slow: z.number().min(0).max(800).optional(), // 0-500ms
                glacial: z.number().min(0).max(2000).optional(), // 0-1200ms
            })
            .optional(),

        // Easing curves (cubic-bezier values as strings)
        easing: z
            .object({
                standard: z.string().optional(), // cubic-bezier(0.22, 1, 0.36, 1)
                decelerate: z.string().optional(), // cubic-bezier(0.05, 0.7, 0.1, 1)
                accelerate: z.string().optional(), // cubic-bezier(0.3, 0, 0.8, 0.15)
                spring: z.string().optional(), // cubic-bezier(0.34, 1.56, 0.64, 1)
            })
            .optional(),

        // Feature flags
        enableParallax: z.boolean().optional(),
        enableMagneticHover: z.boolean().optional(),
        enableScrollReveal: z.boolean().optional(),
        enableAutoGlassmorphism: z.boolean().optional(), // Auto-apply glassmorphism to cards
    })
    .optional();

const BrandingLegalSchema = z.object({
    appName: z.string().min(1),
    companyName: z.string().min(1),
    supportEmail: z.string().email(),
});

const FooterLinkSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    url: z.string().url(),
});

const BrandingFooterSchema = z
    .object({
        links: z.array(FooterLinkSchema).default([]),
    })
    .optional();

const BrandingSemanticColorSchema = z.object({
    surface: z.object({
        base: CssColorSchema,
        raised: CssColorSchema,
        sunken: CssColorSchema,
        overlay: CssColorSchema,
        warning: CssColorSchema,
        muted: CssColorSchema.optional(),
        // For glassmorphism
        glass: CssColorSchema.optional(),
        glassBorder: CssColorSchema.optional(),
        // Skeleton loader colors (optional - falls back to muted/raised if not defined)
        skeleton: CssColorSchema.optional(),
        skeletonShimmer: CssColorSchema.optional(),
        // Popover/dropdown surfaces (optional - falls back to surface-base if not defined)
        popover: CssColorSchema.optional(),
    }),
    text: z.object({
        primary: CssColorSchema,
        secondary: CssColorSchema,
        muted: CssColorSchema,
        inverted: CssColorSchema,
        accent: CssColorSchema,
        // Optional tokens with CSS fallbacks in global.css
        hero: CssColorSchema.optional(),
        eyebrow: CssColorSchema.optional(),
        code: CssColorSchema.optional(),
        // Color for "you owe" amounts (negative balances) - distinct from error states
        owed: CssColorSchema.optional(),
    }),
    interactive: z.object({
        primary: CssColorSchema,
        primaryHover: CssColorSchema,
        primaryActive: CssColorSchema,
        primaryForeground: CssColorSchema,
        secondary: CssColorSchema,
        secondaryHover: CssColorSchema,
        secondaryActive: CssColorSchema,
        secondaryForeground: CssColorSchema,
        accent: CssColorSchema,
        destructive: CssColorSchema,
        destructiveHover: CssColorSchema,
        destructiveActive: CssColorSchema,
        destructiveForeground: CssColorSchema,
        // Optional effect tokens
        ghost: CssColorSchema.optional(),
        magnetic: CssColorSchema.optional(),
        glow: CssColorSchema.optional(),
    }),
    border: z.object({
        subtle: CssColorSchema,
        default: CssColorSchema,
        strong: CssColorSchema,
        focus: CssColorSchema,
        warning: CssColorSchema,
        error: CssColorSchema.optional(),
    }),
    status: z.object({
        success: CssColorSchema,
        warning: CssColorSchema,
        danger: CssColorSchema,
        info: CssColorSchema,
    }),
    // Gradient system
    gradient: z
        .object({
            primary: z.array(CssColorSchema).length(2).optional(),
            accent: z.array(CssColorSchema).length(2).optional(),
            aurora: z.array(CssColorSchema).min(2).max(4).optional(),
        })
        .optional(),
});

const BrandingSemanticSchema = z.object({
    colors: BrandingSemanticColorSchema,
    spacing: BrandingSpacingSemanticSchema,
    typography: TypographySemanticSchema,
});

export const BrandingTokensSchema = z.object({
    version: z.literal(1),
    palette: BrandingPaletteSchema,
    typography: BrandingTypographySchema,
    spacing: BrandingSpacingScaleSchema,
    radii: BrandingRadiiSchema,
    shadows: BrandingShadowsSchema,
    assets: BrandingAssetsSchema,
    legal: BrandingLegalSchema,
    footer: BrandingFooterSchema,
    semantics: BrandingSemanticSchema,
    motion: BrandingMotionSchema,
    sharing: BrandingSharingSchema,
});

export const BrandingArtifactMetadataSchema = z.object({
    hash: z.string().min(1),
    cssUrl: z.string().url(),
    tokensUrl: z.string().url(),
    version: z.number().int().nonnegative(),
    generatedAtEpochMs: z.number().int().nonnegative(),
    generatedBy: z.string().min(1),
});

export const TenantBrandingSchema = z.object({
    tokens: BrandingTokensSchema,
    artifact: BrandingArtifactMetadataSchema.optional(),
});

export type BrandingLegal = z.infer<typeof BrandingLegalSchema>;
export type FooterLink = z.infer<typeof FooterLinkSchema>;
export type BrandingSharing = z.infer<typeof BrandingSharingSchema>;
export type BrandingTokens = z.infer<typeof BrandingTokensSchema>;
export type BrandingArtifactMetadata = z.infer<typeof BrandingArtifactMetadataSchema>;
export type TenantBranding = z.infer<typeof TenantBrandingSchema>;

export interface PublishTenantThemeResult {
    artifact: BrandingArtifactMetadata;
    cssUrl: string;
    tokensUrl: string;
}
