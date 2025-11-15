import { z } from 'zod';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CSS_LENGTH_PATTERN = /^-?\d*\.?\d+(px|rem)$/i;

export type HexColor = `#${string}`;
export type CssLength = `${number}${'px' | 'rem'}`;

export const HexColorSchema = z
    .string()
    .regex(HEX_COLOR_PATTERN, 'Expected hex color (#RRGGBB or #RGB)')
    .transform((value) => value.toLowerCase() as HexColor);

export const CssLengthSchema = z
    .string()
    .regex(CSS_LENGTH_PATTERN, 'Expected CSS length (px or rem)')
    .transform((value) => value.toLowerCase() as CssLength);

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
const FluidTypographyScaleSchema = z.object({
    xs: z.string().optional(),    // clamp(0.75rem, 0.9vw, 0.875rem)
    sm: z.string().optional(),    // clamp(0.875rem, 1vw, 1rem)
    base: z.string().optional(),  // clamp(1rem, 1.2vw, 1.125rem)
    lg: z.string().optional(),    // clamp(1.125rem, 1.5vw, 1.25rem)
    xl: z.string().optional(),    // clamp(1.25rem, 2vw, 1.5rem)
    '2xl': z.string().optional(), // clamp(1.5rem, 2.5vw, 1.875rem)
    '3xl': z.string().optional(), // clamp(1.875rem, 3vw, 2.25rem)
    '4xl': z.string().optional(), // clamp(2.25rem, 4vw, 3rem)
    hero: z.string().optional(),  // clamp(2.5rem, 5vw, 3.75rem)
}).optional();

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
    pagePadding: CssLengthSchema,
    sectionGap: CssLengthSchema,
    cardPadding: CssLengthSchema,
    componentGap: CssLengthSchema,
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
    logoUrl: z.string().min(1), // Required - can be absolute URL, relative path, or data URL. Used as favicon if faviconUrl not provided
    wordmarkUrl: z.string().min(1).optional(),
    faviconUrl: z.string().min(1).optional(), // Optional - defaults to logoUrl if not provided
    heroIllustrationUrl: z.string().min(1).optional(),
    backgroundTextureUrl: z.string().min(1).optional(),
    // New for self-hosted fonts
    fonts: z.object({
        headingUrl: z.string().min(1).optional(), // Space Grotesk, etc.
        bodyUrl: z.string().min(1).optional(),    // Inter, etc.
        monoUrl: z.string().min(1).optional(),    // Geist Mono, etc.
    }).optional(),
});

// New: Motion Tokens
const BrandingMotionSchema = z.object({
    // Durations (ms) - allow 0 for no motion
    duration: z.object({
        instant: z.number().min(0).max(100).optional(),     // 0-50ms
        fast: z.number().min(0).max(200).optional(),        // 0-150ms
        base: z.number().min(0).max(400).optional(),        // 0-320ms
        slow: z.number().min(0).max(800).optional(),        // 0-500ms
        glacial: z.number().min(0).max(2000).optional(),    // 0-1200ms
    }).optional(),

    // Easing curves (cubic-bezier values as strings)
    easing: z.object({
        standard: z.string().optional(),    // cubic-bezier(0.22, 1, 0.36, 1)
        decelerate: z.string().optional(),  // cubic-bezier(0.05, 0.7, 0.1, 1)
        accelerate: z.string().optional(),  // cubic-bezier(0.3, 0, 0.8, 0.15)
        spring: z.string().optional(),      // cubic-bezier(0.34, 1.56, 0.64, 1)
    }).optional(),

    // Feature flags
    enableParallax: z.boolean().optional(),
    enableMagneticHover: z.boolean().optional(),
    enableScrollReveal: z.boolean().optional(),
}).optional();

const BrandingLegalSchema = z.object({
    companyName: z.string().min(1),
    supportEmail: z.string().email(),
    privacyPolicyUrl: z.string().url(),
    termsOfServiceUrl: z.string().url(),
});

const BrandingSemanticColorSchema = z.object({
    surface: z.object({
        base: HexColorSchema,
        raised: HexColorSchema,
        sunken: HexColorSchema,
        overlay: HexColorSchema,
        warning: HexColorSchema,
        // New for glassmorphism
        glass: HexColorSchema.optional(),
        glassBorder: HexColorSchema.optional(),
        aurora: HexColorSchema.optional(),
        spotlight: HexColorSchema.optional(),
    }),
    text: z.object({
        primary: HexColorSchema,
        secondary: HexColorSchema,
        muted: HexColorSchema,
        inverted: HexColorSchema,
        accent: HexColorSchema,
        // New for advanced typography
        hero: HexColorSchema.optional(),
        eyebrow: HexColorSchema.optional(),
        code: HexColorSchema.optional(),
    }),
    interactive: z.object({
        primary: HexColorSchema,
        primaryHover: HexColorSchema,
        primaryActive: HexColorSchema,
        primaryForeground: HexColorSchema,
        secondary: HexColorSchema,
        secondaryHover: HexColorSchema,
        secondaryActive: HexColorSchema,
        secondaryForeground: HexColorSchema,
        accent: HexColorSchema,
        destructive: HexColorSchema,
        destructiveHover: HexColorSchema,
        destructiveActive: HexColorSchema,
        destructiveForeground: HexColorSchema,
        // New for advanced interactions
        ghost: HexColorSchema.optional(),
        magnetic: HexColorSchema.optional(),
        glow: HexColorSchema.optional(),
    }),
    border: z.object({
        subtle: HexColorSchema,
        default: HexColorSchema,
        strong: HexColorSchema,
        focus: HexColorSchema,
        warning: HexColorSchema,
    }),
    status: z.object({
        success: HexColorSchema,
        warning: HexColorSchema,
        danger: HexColorSchema,
        info: HexColorSchema,
    }),
    // New gradient system
    gradient: z.object({
        primary: z.array(HexColorSchema).length(2).optional(),
        accent: z.array(HexColorSchema).length(2).optional(),
        aurora: z.array(HexColorSchema).min(2).max(4).optional(),
        text: z.array(HexColorSchema).length(2).optional(),
    }).optional(),
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
    semantics: BrandingSemanticSchema,
    // New: Motion system
    motion: BrandingMotionSchema,
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

export type BrandingPalette = z.infer<typeof BrandingPaletteSchema>;
export type BrandingTypography = z.infer<typeof BrandingTypographySchema>;
export type BrandingSpacingScale = z.infer<typeof BrandingSpacingScaleSchema>;
export type BrandingRadii = z.infer<typeof BrandingRadiiSchema>;
export type BrandingShadows = z.infer<typeof BrandingShadowsSchema>;
export type BrandingAssets = z.infer<typeof BrandingAssetsSchema>;
export type BrandingLegal = z.infer<typeof BrandingLegalSchema>;
export type BrandingSemanticColors = z.infer<typeof BrandingSemanticColorSchema>;
export type BrandingSemantics = z.infer<typeof BrandingSemanticSchema>;
export type BrandingMotion = z.infer<typeof BrandingMotionSchema>;
export type FluidTypographyScale = z.infer<typeof FluidTypographyScaleSchema>;
export type BrandingTokens = z.infer<typeof BrandingTokensSchema>;
export type BrandingArtifactMetadata = z.infer<typeof BrandingArtifactMetadataSchema>;
export type TenantBranding = z.infer<typeof TenantBrandingSchema>;

export interface PublishTenantThemeResult {
    artifact: BrandingArtifactMetadata;
    cssUrl: string;
    tokensUrl: string;
}
