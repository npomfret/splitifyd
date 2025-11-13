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
    logoUrl: z.string().url(),
    wordmarkUrl: z.string().url().optional(),
    faviconUrl: z.string().url(),
    heroIllustrationUrl: z.string().url().optional(),
    backgroundTextureUrl: z.string().url().optional(),
});

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
    }),
    text: z.object({
        primary: HexColorSchema,
        secondary: HexColorSchema,
        muted: HexColorSchema,
        inverted: HexColorSchema,
        accent: HexColorSchema,
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
        destructive: HexColorSchema,
        destructiveHover: HexColorSchema,
        destructiveActive: HexColorSchema,
        destructiveForeground: HexColorSchema,
    }),
    border: z.object({
        subtle: HexColorSchema,
        default: HexColorSchema,
        strong: HexColorSchema,
        focus: HexColorSchema,
    }),
    status: z.object({
        success: HexColorSchema,
        warning: HexColorSchema,
        danger: HexColorSchema,
        info: HexColorSchema,
    }),
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
export type BrandingTokens = z.infer<typeof BrandingTokensSchema>;
export type BrandingArtifactMetadata = z.infer<typeof BrandingArtifactMetadataSchema>;
export type TenantBranding = z.infer<typeof TenantBrandingSchema>;

export interface PublishTenantThemeResult {
    artifact: BrandingArtifactMetadata;
    cssUrl: string;
    tokensUrl: string;
}
