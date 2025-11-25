import type { BrandingTokens, TenantBranding } from '@billsplit-wl/shared';
import { generateBrandingTokens } from './branding-tokens-generator';

interface SimpleBranding {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    headerBackgroundColor: string;
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
    simpleEdits: SimpleBranding,
): TenantBranding | undefined {
    console.log('[mergeTokensSmartly] Called with glassColor:', simpleEdits.glassColor);
    console.log('[mergeTokensSmartly] Called with glassBorderColor:', simpleEdits.glassBorderColor);
    console.log('[mergeTokensSmartly] Has existing tokens?:', !!existingTokens?.tokens);

    // Check if user made any motion/typography/aurora/glass edits
    const hasAdvancedEdits = simpleEdits.enableAuroraAnimation !== undefined ||
        simpleEdits.enableGlassmorphism !== undefined ||
        simpleEdits.enableMagneticHover !== undefined ||
        simpleEdits.enableScrollReveal !== undefined ||
        simpleEdits.fontFamilySans !== undefined ||
        simpleEdits.fontFamilySerif !== undefined ||
        simpleEdits.fontFamilyMono !== undefined ||
        simpleEdits.auroraGradient !== undefined ||
        simpleEdits.glassColor !== undefined ||
        simpleEdits.glassBorderColor !== undefined;

    // If no existing tokens AND user has made advanced edits (motion, typography, etc.),
    // generate complete tokens using the frontend generator, then apply the edits
    if (!existingTokens?.tokens && hasAdvancedEdits) {
        console.log('[mergeTokensSmartly] Generating tokens - glass color:', simpleEdits.glassColor);
        console.log('[mergeTokensSmartly] Generating tokens - glass border:', simpleEdits.glassBorderColor);

        const generatedTokens = generateBrandingTokens({
            primaryColor: simpleEdits.primaryColor,
            secondaryColor: simpleEdits.secondaryColor,
            accentColor: simpleEdits.accentColor,
            backgroundColor: simpleEdits.backgroundColor,
            headerBackgroundColor: simpleEdits.headerBackgroundColor,
        });

        // Apply motion effect overrides
        const tokens: BrandingTokens = {
            ...generatedTokens.tokens,
            motion: {
                ...generatedTokens.tokens.motion,
                ...(simpleEdits.enableAuroraAnimation !== undefined && {
                    enableParallax: simpleEdits.enableAuroraAnimation,
                }),
                ...(simpleEdits.enableMagneticHover !== undefined && {
                    enableMagneticHover: simpleEdits.enableMagneticHover,
                }),
                ...(simpleEdits.enableScrollReveal !== undefined && {
                    enableScrollReveal: simpleEdits.enableScrollReveal,
                }),
            },
            typography: {
                ...generatedTokens.tokens.typography,
                fontFamily: {
                    ...generatedTokens.tokens.typography.fontFamily,
                    ...(simpleEdits.fontFamilySans && {
                        sans: simpleEdits.fontFamilySans,
                    }),
                    ...(simpleEdits.fontFamilySerif && {
                        serif: simpleEdits.fontFamilySerif,
                    }),
                    ...(simpleEdits.fontFamilyMono && {
                        mono: simpleEdits.fontFamilyMono,
                    }),
                },
            },
        };

        // Apply aurora gradient if specified (must have at least 2 colors per schema)
        if (simpleEdits.auroraGradient && simpleEdits.auroraGradient.length >= 2) {
            tokens.semantics = {
                ...tokens.semantics,
                colors: {
                    ...tokens.semantics.colors,
                    gradient: {
                        ...tokens.semantics.colors.gradient,
                        aurora: simpleEdits.auroraGradient as `#${string}`[],
                    },
                },
            };
        }

        // Apply glassmorphism color settings if provided
        if (simpleEdits.glassColor || simpleEdits.glassBorderColor) {
            console.log('[mergeTokensSmartly] Applying glass colors');
            const existingSurface = tokens.semantics.colors.surface;
            const updatedSurface: any = { ...existingSurface };

            if (simpleEdits.glassColor) {
                updatedSurface.glass = simpleEdits.glassColor as `rgba(${string})`;
            } else if (existingSurface.glass) {
                updatedSurface.glass = existingSurface.glass;
            }

            if (simpleEdits.glassBorderColor) {
                updatedSurface.glassBorder = simpleEdits.glassBorderColor as `rgba(${string})`;
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
            primary: simpleEdits.primaryColor as `#${string}`,
            primaryVariant: adjustColor(simpleEdits.primaryColor, 0.1),
            secondary: simpleEdits.secondaryColor as `#${string}`,
            secondaryVariant: adjustColor(simpleEdits.secondaryColor, 0.1),
            accent: simpleEdits.accentColor as `#${string}`,
            neutral: simpleEdits.backgroundColor as `#${string}`,
            neutralVariant: adjustColor(simpleEdits.backgroundColor, 0.05),
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
                        base: simpleEdits.backgroundColor as `#${string}`,
                        raised: adjustColor(simpleEdits.backgroundColor, -0.02),
                        sunken: adjustColor(simpleEdits.backgroundColor, 0.05),
                        overlay: simpleEdits.headerBackgroundColor as `#${string}`,
                    };

                    // Handle glassmorphism conditionally
                    if (simpleEdits.enableGlassmorphism !== undefined) {
                        if (simpleEdits.enableGlassmorphism) {
                            // Use provided glass colors, or preserve existing, or use defaults
                            return {
                                ...baseSurface,
                                glass: (simpleEdits.glassColor || existing.semantics.colors.surface.glass || 'rgba(25, 30, 50, 0.45)') as `rgba(${string})`,
                                glassBorder: (simpleEdits.glassBorderColor || existing.semantics.colors.surface.glassBorder || 'rgba(255, 255, 255, 0.12)') as `rgba(${string})`,
                            };
                        }
                        // If explicitly disabled, remove glass properties
                        const { glass, glassBorder, ...withoutGlass } = baseSurface;
                        return withoutGlass;
                    }

                    // If glassmorphism toggle not specified, but colors provided, update them
                    if (simpleEdits.glassColor || simpleEdits.glassBorderColor) {
                        return {
                            ...baseSurface,
                            glass: (simpleEdits.glassColor || existing.semantics.colors.surface.glass) as `rgba(${string})`,
                            glassBorder: (simpleEdits.glassBorderColor || existing.semantics.colors.surface.glassBorder) as `rgba(${string})`,
                        };
                    }

                    // If not specified, preserve existing glass properties
                    return baseSurface;
                })(),

                text: {
                    ...existing.semantics.colors.text,
                    primary: simpleEdits.headerBackgroundColor as `#${string}`,
                    secondary: adjustColor(simpleEdits.headerBackgroundColor, -0.3),
                    muted: adjustColor(simpleEdits.headerBackgroundColor, -0.5),
                    inverted: simpleEdits.backgroundColor as `#${string}`,
                    accent: simpleEdits.accentColor as `#${string}`,
                },

                interactive: {
                    ...existing.semantics.colors.interactive,
                    primary: simpleEdits.primaryColor as `#${string}`,
                    primaryHover: adjustColor(simpleEdits.primaryColor, 0.1),
                    primaryActive: adjustColor(simpleEdits.primaryColor, 0.15),
                    secondary: simpleEdits.secondaryColor as `#${string}`,
                    secondaryHover: adjustColor(simpleEdits.secondaryColor, 0.1),
                    secondaryActive: adjustColor(simpleEdits.secondaryColor, 0.15),
                    accent: simpleEdits.accentColor as `#${string}`,
                    // PRESERVE: primaryForeground, secondaryForeground, destructive*, magnetic
                },

                border: {
                    ...existing.semantics.colors.border,
                    subtle: adjustColor(simpleEdits.backgroundColor, 0.1),
                    default: adjustColor(simpleEdits.backgroundColor, 0.2),
                    strong: adjustColor(simpleEdits.backgroundColor, 0.3),
                    focus: simpleEdits.accentColor as `#${string}`,
                    // PRESERVE: warning
                },

                // PRESERVE: status

                // Update gradient if provided (must have at least 2 colors per schema)
                ...(simpleEdits.auroraGradient && simpleEdits.auroraGradient.length >= 2 && {
                    gradient: {
                        ...existing.semantics.colors.gradient,
                        aurora: simpleEdits.auroraGradient as `#${string}`[],
                    },
                }),
            },

            // PRESERVE: spacing, typography
        },

        // Update motion feature flags
        motion: {
            ...existing.motion,
            ...(simpleEdits.enableAuroraAnimation !== undefined && {
                enableParallax: simpleEdits.enableAuroraAnimation,
            }),
            ...(simpleEdits.enableMagneticHover !== undefined && {
                enableMagneticHover: simpleEdits.enableMagneticHover,
            }),
            ...(simpleEdits.enableScrollReveal !== undefined && {
                enableScrollReveal: simpleEdits.enableScrollReveal,
            }),
        },

        // Update typography font families if provided
        typography: {
            ...existing.typography,
            fontFamily: {
                ...existing.typography.fontFamily,
                ...(simpleEdits.fontFamilySans && {
                    sans: simpleEdits.fontFamilySans,
                }),
                ...(simpleEdits.fontFamilySerif && {
                    serif: simpleEdits.fontFamilySerif,
                }),
                ...(simpleEdits.fontFamilyMono && {
                    mono: simpleEdits.fontFamilyMono,
                }),
            },
            // PRESERVE: sizes, weights, lineHeights, letterSpacing, semantics, fluidScale
        },

        // PRESERVE: assets (including custom fonts)
        // PRESERVE: spacing, radii, shadows, legal
    };

    return { tokens: updated };
}
