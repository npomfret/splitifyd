import type { BrandingTokens, TenantBranding } from '@billsplit-wl/shared';

interface SimpleBranding {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    headerBackgroundColor: string;
}

/**
 * Smartly merges simple branding color changes with existing brandingTokens,
 * preserving advanced features like glassmorphism, aurora animations, fluid typography, etc.
 *
 * Strategy:
 * - If no existing tokens → return undefined (let backend auto-generate)
 * - If existing tokens → update ONLY the edited colors, preserve everything else
 */
export function mergeTokensSmartly(
    existingTokens: TenantBranding | undefined,
    simpleEdits: SimpleBranding,
): TenantBranding | undefined {
    // If no existing tokens, don't pass anything - let backend auto-generate vanilla
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

                surface: {
                    ...existing.semantics.colors.surface,
                    base: simpleEdits.backgroundColor as `#${string}`,
                    raised: adjustColor(simpleEdits.backgroundColor, -0.02),
                    sunken: adjustColor(simpleEdits.backgroundColor, 0.05),
                    overlay: simpleEdits.headerBackgroundColor as `#${string}`,
                    // PRESERVE: glass, glassBorder, aurora, spotlight, magnetic, glow, warning
                },

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

                // PRESERVE: status, gradient
            },

            // PRESERVE: spacing, typography
        },

        // PRESERVE: typography (including fluidScale if exists)
        // PRESERVE: motion (including enableParallax, enableMagneticHover, enableScrollReveal)
        // PRESERVE: assets (including custom fonts)
        // PRESERVE: spacing, radii, shadows, legal
    };

    return { tokens: updated };
}
