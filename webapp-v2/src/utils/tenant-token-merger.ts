import type { BrandingTokens, TenantBranding } from '@billsplit-wl/shared';
import { generateBrandingTokens } from './branding-tokens-generator';

/**
 * Represents the flattened form values from the tenant editor modal.
 * These simple edits are merged into the full BrandingTokens structure.
 */
export interface BrandingFormEdits {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    surfaceColor: string;
    textColor: string;
    // Motion & Effects
    enableAuroraAnimation?: boolean;
    enableGlassmorphism?: boolean;
    enableMagneticHover?: boolean;
    enableScrollReveal?: boolean;
    // Typography
    fontFamilySans?: string;
    fontFamilySerif?: string;
    fontFamilyMono?: string;
    // Aurora Gradient
    auroraGradient?: string[];
    // Glassmorphism
    glassColor?: string;
    glassBorderColor?: string;
}

/**
 * Smartly merges simple branding color changes with existing brandingTokens,
 * preserving advanced features like glassmorphism, aurora animations, fluid typography, etc.
 *
 * Strategy:
 * - If no existing tokens AND no motion/typography edits → return undefined (let backend auto-generate)
 * - If no existing tokens BUT has motion/typography edits → generate tokens with those features
 * - If existing tokens → update ONLY the edited colors, preserve everything else
 */
export function mergeTokensSmartly(
    existingTokens: TenantBranding | undefined,
    formEdits: BrandingFormEdits,
): TenantBranding | undefined {
    console.log('[mergeTokensSmartly] Called with glassColor:', formEdits.glassColor);
    console.log('[mergeTokensSmartly] Called with glassBorderColor:', formEdits.glassBorderColor);
    console.log('[mergeTokensSmartly] Has existing tokens?:', !!existingTokens?.tokens);

    // Check if user made any motion/typography/aurora/glass edits
    const hasAdvancedEdits = formEdits.enableAuroraAnimation !== undefined ||
        formEdits.enableGlassmorphism !== undefined ||
        formEdits.enableMagneticHover !== undefined ||
        formEdits.enableScrollReveal !== undefined ||
        formEdits.fontFamilySans !== undefined ||
        formEdits.fontFamilySerif !== undefined ||
        formEdits.fontFamilyMono !== undefined ||
        formEdits.auroraGradient !== undefined ||
        formEdits.glassColor !== undefined ||
        formEdits.glassBorderColor !== undefined;

    // If no existing tokens AND user has made advanced edits (motion, typography, etc.),
    // generate complete tokens using the frontend generator, then apply the edits
    if (!existingTokens?.tokens && hasAdvancedEdits) {
        console.log('[mergeTokensSmartly] Generating tokens - glass color:', formEdits.glassColor);
        console.log('[mergeTokensSmartly] Generating tokens - glass border:', formEdits.glassBorderColor);

        const generatedTokens = generateBrandingTokens({
            primaryColor: formEdits.primaryColor,
            secondaryColor: formEdits.secondaryColor,
            accentColor: formEdits.accentColor,
            surfaceColor: formEdits.surfaceColor,
            textColor: formEdits.textColor,
        });

        // Apply motion effect overrides
        const tokens: BrandingTokens = {
            ...generatedTokens.tokens,
            motion: {
                ...generatedTokens.tokens.motion,
                ...(formEdits.enableAuroraAnimation !== undefined && {
                    enableParallax: formEdits.enableAuroraAnimation,
                }),
                ...(formEdits.enableMagneticHover !== undefined && {
                    enableMagneticHover: formEdits.enableMagneticHover,
                }),
                ...(formEdits.enableScrollReveal !== undefined && {
                    enableScrollReveal: formEdits.enableScrollReveal,
                }),
            },
            typography: {
                ...generatedTokens.tokens.typography,
                fontFamily: {
                    ...generatedTokens.tokens.typography.fontFamily,
                    ...(formEdits.fontFamilySans && {
                        sans: formEdits.fontFamilySans,
                    }),
                    ...(formEdits.fontFamilySerif && {
                        serif: formEdits.fontFamilySerif,
                    }),
                    ...(formEdits.fontFamilyMono && {
                        mono: formEdits.fontFamilyMono,
                    }),
                },
            },
        };

        // Apply aurora gradient if specified (must have at least 2 colors per schema)
        if (formEdits.auroraGradient && formEdits.auroraGradient.length >= 2) {
            tokens.semantics = {
                ...tokens.semantics,
                colors: {
                    ...tokens.semantics.colors,
                    gradient: {
                        ...tokens.semantics.colors.gradient,
                        aurora: formEdits.auroraGradient as `#${string}`[],
                    },
                },
            };
        }

        // Apply glassmorphism color settings if provided
        if (formEdits.glassColor || formEdits.glassBorderColor) {
            console.log('[mergeTokensSmartly] Applying glass colors');
            const existingSurface = tokens.semantics.colors.surface;
            const updatedSurface: any = { ...existingSurface };

            if (formEdits.glassColor) {
                updatedSurface.glass = formEdits.glassColor as `rgba(${string})`;
            } else if (existingSurface.glass) {
                updatedSurface.glass = existingSurface.glass;
            }

            if (formEdits.glassBorderColor) {
                updatedSurface.glassBorder = formEdits.glassBorderColor as `rgba(${string})`;
            } else if (existingSurface.glassBorder) {
                updatedSurface.glassBorder = existingSurface.glassBorder;
            }

            tokens.semantics.colors.surface = updatedSurface;
        }

        console.log('[mergeTokensSmartly] Final glass color:', tokens.semantics.colors.surface.glass);
        console.log('[mergeTokensSmartly] Final glass border:', tokens.semantics.colors.surface.glassBorder);

        return { tokens };
    }

    // If no existing tokens AND no advanced edits, let backend auto-generate
    if (!existingTokens?.tokens) {
        return undefined;
    }

    const existing = existingTokens.tokens;

    // Helper to adjust color brightness (positive = darken, negative = lighten)
    const adjustColor = (color: string, amount: number): `#${string}` => {
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

        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}` as `#${string}`;
    };

    // Create updated tokens by merging
    const updated: BrandingTokens = {
        ...existing,

        // Update palette colors
        palette: {
            ...existing.palette,
            primary: formEdits.primaryColor as `#${string}`,
            primaryVariant: adjustColor(formEdits.primaryColor, 0.1),
            secondary: formEdits.secondaryColor as `#${string}`,
            secondaryVariant: adjustColor(formEdits.secondaryColor, 0.1),
            accent: formEdits.accentColor as `#${string}`,
            neutral: formEdits.surfaceColor as `#${string}`,
            neutralVariant: adjustColor(formEdits.surfaceColor, 0.05),
            // PRESERVE: success, warning, danger, info
        },

        // Update semantic colors
        semantics: {
            ...existing.semantics,
            colors: {
                ...existing.semantics.colors,

                surface: (() => {
                    const baseSurface = {
                        ...existing.semantics.colors.surface,
                        base: formEdits.surfaceColor as `#${string}`,
                        raised: adjustColor(formEdits.surfaceColor, -0.02),
                        sunken: adjustColor(formEdits.surfaceColor, 0.05),
                        overlay: formEdits.textColor as `#${string}`,
                    };

                    // Handle glassmorphism conditionally
                    if (formEdits.enableGlassmorphism !== undefined) {
                        if (formEdits.enableGlassmorphism) {
                            // Use provided glass colors, or preserve existing, or use defaults
                            return {
                                ...baseSurface,
                                glass: (formEdits.glassColor || existing.semantics.colors.surface.glass || 'rgba(25, 30, 50, 0.45)') as `rgba(${string})`,
                                glassBorder: (formEdits.glassBorderColor || existing.semantics.colors.surface.glassBorder || 'rgba(255, 255, 255, 0.12)') as `rgba(${string})`,
                            };
                        }
                        // If explicitly disabled, remove glass properties
                        const { glass, glassBorder, ...withoutGlass } = baseSurface;
                        return withoutGlass;
                    }

                    // If glassmorphism toggle not specified, but colors provided, update them
                    if (formEdits.glassColor || formEdits.glassBorderColor) {
                        return {
                            ...baseSurface,
                            glass: (formEdits.glassColor || existing.semantics.colors.surface.glass) as `rgba(${string})`,
                            glassBorder: (formEdits.glassBorderColor || existing.semantics.colors.surface.glassBorder) as `rgba(${string})`,
                        };
                    }

                    // If not specified, preserve existing glass properties
                    return baseSurface;
                })(),

                text: {
                    ...existing.semantics.colors.text,
                    primary: formEdits.textColor as `#${string}`,
                    secondary: adjustColor(formEdits.textColor, -0.3),
                    muted: adjustColor(formEdits.textColor, -0.5),
                    inverted: formEdits.surfaceColor as `#${string}`,
                    accent: formEdits.accentColor as `#${string}`,
                },

                interactive: {
                    ...existing.semantics.colors.interactive,
                    primary: formEdits.primaryColor as `#${string}`,
                    primaryHover: adjustColor(formEdits.primaryColor, 0.1),
                    primaryActive: adjustColor(formEdits.primaryColor, 0.15),
                    secondary: formEdits.secondaryColor as `#${string}`,
                    secondaryHover: adjustColor(formEdits.secondaryColor, 0.1),
                    secondaryActive: adjustColor(formEdits.secondaryColor, 0.15),
                    accent: formEdits.accentColor as `#${string}`,
                    // PRESERVE: primaryForeground, secondaryForeground, destructive*, magnetic
                },

                border: {
                    ...existing.semantics.colors.border,
                    subtle: adjustColor(formEdits.surfaceColor, 0.1),
                    default: adjustColor(formEdits.surfaceColor, 0.2),
                    strong: adjustColor(formEdits.surfaceColor, 0.3),
                    focus: formEdits.accentColor as `#${string}`,
                    // PRESERVE: warning
                },

                // PRESERVE: status

                // Update gradient if provided (must have at least 2 colors per schema)
                ...(formEdits.auroraGradient && formEdits.auroraGradient.length >= 2 && {
                    gradient: {
                        ...existing.semantics.colors.gradient,
                        aurora: formEdits.auroraGradient as `#${string}`[],
                    },
                }),
            },

            // PRESERVE: spacing, typography
        },

        // Update motion feature flags
        motion: {
            ...existing.motion,
            ...(formEdits.enableAuroraAnimation !== undefined && {
                enableParallax: formEdits.enableAuroraAnimation,
            }),
            ...(formEdits.enableMagneticHover !== undefined && {
                enableMagneticHover: formEdits.enableMagneticHover,
            }),
            ...(formEdits.enableScrollReveal !== undefined && {
                enableScrollReveal: formEdits.enableScrollReveal,
            }),
        },

        // Update typography font families if provided
        typography: {
            ...existing.typography,
            fontFamily: {
                ...existing.typography.fontFamily,
                ...(formEdits.fontFamilySans && {
                    sans: formEdits.fontFamilySans,
                }),
                ...(formEdits.fontFamilySerif && {
                    serif: formEdits.fontFamilySerif,
                }),
                ...(formEdits.fontFamilyMono && {
                    mono: formEdits.fontFamilyMono,
                }),
            },
            // PRESERVE: sizes, weights, lineHeights, letterSpacing, semantics, fluidScale
        },

        // PRESERVE: assets (including custom fonts)
        // PRESERVE: spacing, radii, shadows, legal
    };

    return { tokens: updated };
}
