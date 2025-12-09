import type { TenantData } from './types';

/**
 * Color derivation utilities for generating semantic colors from palette colors.
 *
 * When a user sets primary/secondary/accent palette colors, this module
 * derives all the interactive, border, and other semantic colors automatically.
 */

interface RGB {
    r: number;
    g: number;
    b: number;
}

interface HSL {
    h: number;
    s: number;
    l: number;
}

function hexToRgb(hex: string): RGB {
    const clean = hex.replace('#', '');
    const expanded = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;
    return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16),
    };
}

function rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToHsl(rgb: RGB): HSL {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
        return { h: 0, s: 0, l };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    switch (max) {
        case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
        case g:
            h = ((b - r) / d + 2) / 6;
            break;
        case b:
            h = ((r - g) / d + 4) / 6;
            break;
    }

    return { h, s, l };
}

function hslToRgb(hsl: HSL): RGB {
    const { h, s, l } = hsl;

    if (s === 0) {
        const gray = Math.round(l * 255);
        return { r: gray, g: gray, b: gray };
    }

    const hue2rgb = (p: number, q: number, t: number) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
        r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
}

function adjustLightness(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb);
    hsl.l = Math.max(0, Math.min(1, hsl.l + amount));
    return rgbToHex(hslToRgb(hsl));
}

function adjustSaturation(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb);
    hsl.s = Math.max(0, Math.min(1, hsl.s + amount));
    return rgbToHex(hslToRgb(hsl));
}

function getLuminance(hex: string): number {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb);
    return hsl.l;
}

function isLightColor(hex: string): boolean {
    return getLuminance(hex) > 0.5;
}

function mixColors(hex1: string, hex2: string, weight: number): string {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    return rgbToHex({
        r: rgb1.r * (1 - weight) + rgb2.r * weight,
        g: rgb1.g * (1 - weight) + rgb2.g * weight,
        b: rgb1.b * (1 - weight) + rgb2.b * weight,
    });
}

interface PaletteColors {
    primary: string;
    primaryVariant: string;
    secondary: string;
    secondaryVariant: string;
    accent: string;
    neutral: string;
    neutralVariant: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
}

/**
 * Derivation options that control how colors are generated from the palette.
 */
interface DerivationOptions {
    themeMode: 'light' | 'medium' | 'dark';
    style: 'balanced' | 'bold' | 'soft' | 'vibrant' | 'elegant';
    intensity: number; // 0-100
}

/**
 * Style presets that modify derivation parameters.
 */
interface StyleParams {
    saturationAdjust: number; // Adjust saturation of derived colors (-1 to 1)
    contrastMultiplier: number; // Multiplier for hover/active deltas
    tintStrength: number; // Base tint strength for surfaces (0-1)
}

const STYLE_PRESETS: Record<DerivationOptions['style'], StyleParams> = {
    balanced: { saturationAdjust: 0, contrastMultiplier: 1, tintStrength: 0.06 },
    bold: { saturationAdjust: 0.2, contrastMultiplier: 1.3, tintStrength: 0.10 },
    soft: { saturationAdjust: -0.3, contrastMultiplier: 0.7, tintStrength: 0.04 },
    vibrant: { saturationAdjust: 0.4, contrastMultiplier: 1, tintStrength: 0.12 },
    elegant: { saturationAdjust: -0.2, contrastMultiplier: 1, tintStrength: 0.03 },
};

const DEFAULT_OPTIONS: DerivationOptions = {
    themeMode: 'light',
    style: 'balanced',
    intensity: 50,
};

interface DerivedColors {
    // Interactive - Primary
    interactivePrimaryColor: string;
    interactivePrimaryHoverColor: string;
    interactivePrimaryActiveColor: string;
    interactivePrimaryForegroundColor: string;
    // Interactive - Secondary
    interactiveSecondaryColor: string;
    interactiveSecondaryHoverColor: string;
    interactiveSecondaryActiveColor: string;
    interactiveSecondaryForegroundColor: string;
    // Interactive - Accent & Effects
    interactiveAccentColor: string;
    interactiveGhostColor: string;
    interactiveMagneticColor: string;
    interactiveGlowColor: string;
    // Interactive - Destructive
    interactiveDestructiveColor: string;
    interactiveDestructiveHoverColor: string;
    interactiveDestructiveActiveColor: string;
    interactiveDestructiveForegroundColor: string;
    // Borders
    borderSubtleColor: string;
    borderDefaultColor: string;
    borderStrongColor: string;
    borderFocusColor: string;
    borderWarningColor: string;
    // Status
    statusSuccessColor: string;
    statusWarningColor: string;
    statusDangerColor: string;
    statusInfoColor: string;
    // Surfaces
    surfaceBaseColor: string;
    surfaceRaisedColor: string;
    surfaceSunkenColor: string;
    surfaceOverlayColor: string;
    surfaceWarningColor: string;
    surfaceMutedColor: string;
    surfacePopoverColor: string;
    // Text
    textPrimaryColor: string;
    textSecondaryColor: string;
    textMutedColor: string;
    textInvertedColor: string;
    textAccentColor: string;
}

/**
 * Derives all semantic colors from palette colors.
 *
 * This creates a complete, harmonious color system from just the core palette.
 * Options control theme mode (light/dark), style preset, and intensity.
 */
function deriveColorsFromPalette(
    palette: PaletteColors,
    options: DerivationOptions = DEFAULT_OPTIONS,
): DerivedColors {
    const { primary, secondary, accent, neutral, danger, warning, success, info } = palette;
    const { themeMode, style, intensity } = options;

    // Get style parameters
    const styleParams = STYLE_PRESETS[style];

    // Intensity affects how much primary bleeds into surfaces (0-100 -> 0-2x multiplier)
    const intensityMultiplier = intensity / 50; // 0 = 0x, 50 = 1x, 100 = 2x

    // Theme mode controls surface brightness
    // light = bright surfaces, dark text
    // medium = mid-tone surfaces, can go either way
    // dark = dark surfaces, light text
    const isDarkTheme = themeMode === 'dark';
    const isMediumTheme = themeMode === 'medium';

    // Apply saturation adjustment to palette colors
    const adjustedPrimary = adjustSaturation(primary, styleParams.saturationAdjust);
    const adjustedSecondary = adjustSaturation(secondary, styleParams.saturationAdjust);
    const adjustedAccent = adjustSaturation(accent, styleParams.saturationAdjust);

    // Contrast multiplier affects hover/active deltas
    const hoverDelta = 0.08 * styleParams.contrastMultiplier;
    const activeDelta = 0.12 * styleParams.contrastMultiplier;

    // Interactive Primary - Use primary color with hover/active variants
    const interactivePrimaryColor = adjustedPrimary;
    const interactivePrimaryHoverColor = isDarkTheme
        ? adjustLightness(adjustedPrimary, hoverDelta * 1.25)
        : adjustLightness(adjustedPrimary, -hoverDelta);
    const interactivePrimaryActiveColor = isDarkTheme
        ? adjustLightness(adjustedPrimary, activeDelta * 1.25)
        : adjustLightness(adjustedPrimary, -activeDelta);
    const interactivePrimaryForegroundColor = isLightColor(adjustedPrimary) ? '#0f172a' : '#ffffff';

    // Interactive Secondary - Use secondary color
    const interactiveSecondaryColor = adjustedSecondary;
    const interactiveSecondaryHoverColor = isDarkTheme
        ? adjustLightness(adjustedSecondary, hoverDelta * 1.25)
        : adjustLightness(adjustedSecondary, -hoverDelta);
    const interactiveSecondaryActiveColor = isDarkTheme
        ? adjustLightness(adjustedSecondary, activeDelta * 1.25)
        : adjustLightness(adjustedSecondary, -activeDelta);
    const interactiveSecondaryForegroundColor = isLightColor(adjustedSecondary) ? '#0f172a' : '#ffffff';

    // Accent & Effects
    const interactiveAccentColor = adjustedAccent;
    const interactiveGhostColor = mixColors(neutral, adjustedPrimary, 0.1);
    const interactiveMagneticColor = mixColors(adjustedPrimary, adjustedAccent, 0.3);
    const interactiveGlowColor = adjustSaturation(adjustLightness(adjustedPrimary, 0.1), 0.2);

    // Destructive - Use danger color
    const interactiveDestructiveColor = danger;
    const interactiveDestructiveHoverColor = adjustLightness(danger, isDarkTheme ? hoverDelta * 1.25 : -hoverDelta);
    const interactiveDestructiveActiveColor = adjustLightness(danger, isDarkTheme ? activeDelta * 1.25 : -activeDelta);
    const interactiveDestructiveForegroundColor = '#ffffff';

    // Borders - Derive from neutral
    const borderSubtleColor = isDarkTheme
        ? adjustLightness(neutral, 0.08)
        : adjustLightness(neutral, -0.05);
    const borderDefaultColor = isDarkTheme
        ? adjustLightness(neutral, 0.15)
        : adjustLightness(neutral, -0.12);
    const borderStrongColor = isDarkTheme
        ? adjustLightness(neutral, 0.25)
        : adjustLightness(neutral, -0.25);
    const borderFocusColor = adjustedPrimary;
    const borderWarningColor = warning;

    // Status colors - pass through
    const statusSuccessColor = success;
    const statusWarningColor = warning;
    const statusDangerColor = danger;
    const statusInfoColor = info;

    // Calculate tint strength based on style preset and intensity
    const baseTint = styleParams.tintStrength * intensityMultiplier;
    const raisedTint = baseTint * 0.5;
    const sunkenTint = baseTint * 1.3;
    const mutedTint = baseTint * 1.6;

    // Surfaces - Derive from primary color (tinted neutrals)
    // Medium theme uses mid-gray bases
    const surfaceBaseColor = isDarkTheme
        ? mixColors('#0f0f1a', adjustedPrimary, baseTint)
        : isMediumTheme
        ? mixColors('#6b7280', adjustedPrimary, baseTint)
        : mixColors('#f8fafc', adjustedPrimary, baseTint);

    const surfaceRaisedColor = isDarkTheme
        ? mixColors('#1a1a2e', adjustedPrimary, raisedTint)
        : isMediumTheme
        ? mixColors('#9ca3af', adjustedPrimary, raisedTint)
        : mixColors('#ffffff', adjustedPrimary, raisedTint);

    const surfaceSunkenColor = isDarkTheme
        ? mixColors('#0a0a12', adjustedPrimary, sunkenTint)
        : isMediumTheme
        ? mixColors('#4b5563', adjustedPrimary, sunkenTint)
        : mixColors('#f1f5f9', adjustedPrimary, sunkenTint);

    const surfaceOverlayColor = isDarkTheme
        ? 'rgba(0, 0, 0, 0.5)'
        : isMediumTheme
        ? 'rgba(0, 0, 0, 0.4)'
        : 'rgba(15, 23, 42, 0.5)';

    const surfaceWarningColor = isDarkTheme
        ? mixColors('#1a1a2e', warning, 0.15)
        : isMediumTheme
        ? mixColors('#6b7280', warning, 0.2)
        : mixColors('#fefce8', adjustedPrimary, 0.05);

    const surfaceMutedColor = isDarkTheme
        ? mixColors('#151524', adjustedPrimary, mutedTint)
        : isMediumTheme
        ? mixColors('#4b5563', adjustedPrimary, mutedTint)
        : mixColors('#f1f5f9', adjustedPrimary, mutedTint);

    // Popover surface - slightly different from raised for floating elements
    // Darker than raised in dark themes for depth, slightly tinted in light themes
    const popoverTint = baseTint * 0.3;
    const surfacePopoverColor = isDarkTheme
        ? mixColors('#0f0f1a', adjustedPrimary, popoverTint)
        : isMediumTheme
            ? mixColors('#374151', adjustedPrimary, popoverTint)
            : mixColors('#f8fafc', adjustedPrimary, popoverTint);

    // Text - Derive contrasting colors
    // Medium theme uses light text (like dark theme) since backgrounds are mid-gray
    const textPrimaryColor = isDarkTheme || isMediumTheme ? '#f8fafc' : '#0f172a';
    const textSecondaryColor = isDarkTheme || isMediumTheme ? '#e2e8f0' : '#475569';
    const textMutedColor = isDarkTheme || isMediumTheme ? '#cbd5e1' : '#64748b';
    const textInvertedColor = isDarkTheme || isMediumTheme ? '#0f172a' : '#ffffff';
    const textAccentColor = adjustedAccent;

    return {
        interactivePrimaryColor,
        interactivePrimaryHoverColor,
        interactivePrimaryActiveColor,
        interactivePrimaryForegroundColor,
        interactiveSecondaryColor,
        interactiveSecondaryHoverColor,
        interactiveSecondaryActiveColor,
        interactiveSecondaryForegroundColor,
        interactiveAccentColor,
        interactiveGhostColor,
        interactiveMagneticColor,
        interactiveGlowColor,
        interactiveDestructiveColor,
        interactiveDestructiveHoverColor,
        interactiveDestructiveActiveColor,
        interactiveDestructiveForegroundColor,
        borderSubtleColor,
        borderDefaultColor,
        borderStrongColor,
        borderFocusColor,
        borderWarningColor,
        statusSuccessColor,
        statusWarningColor,
        statusDangerColor,
        statusInfoColor,
        surfaceBaseColor,
        surfaceRaisedColor,
        surfaceSunkenColor,
        surfaceOverlayColor,
        surfaceWarningColor,
        surfaceMutedColor,
        surfacePopoverColor,
        textPrimaryColor,
        textSecondaryColor,
        textMutedColor,
        textInvertedColor,
        textAccentColor,
    };
}

/**
 * Derives semantic colors from the current form data's palette colors.
 * Returns a partial TenantData object with only the derived color fields.
 *
 * IMPORTANT: This always generates fresh colors from primary/secondary/accent.
 * It does NOT preserve existing semantic colors - that's the whole point.
 *
 * Uses derivation options from formData:
 * - derivationThemeMode: 'light' | 'medium' | 'dark'
 * - derivationStyle: 'balanced' | 'bold' | 'soft' | 'vibrant' | 'elegant'
 * - derivationIntensity: 0-100
 */
export function deriveSemanticColorsFromFormData(formData: TenantData): Partial<TenantData> {
    // Validate that required palette colors are present
    if (!formData.primaryColor || !formData.secondaryColor || !formData.accentColor) {
        return {};
    }

    // Get derivation options from form data (with defaults)
    const options: DerivationOptions = {
        themeMode: formData.derivationThemeMode || 'light',
        style: formData.derivationStyle || 'balanced',
        intensity: formData.derivationIntensity ?? 50,
    };

    // Set neutral colors based on theme mode
    const isDark = options.themeMode === 'dark';
    const isMedium = options.themeMode === 'medium';
    const neutral = isDark ? '#0f0f1a' : isMedium ? '#6b7280' : '#f8fafc';
    const neutralVariant = isDark ? '#1a1a2e' : isMedium ? '#9ca3af' : '#f1f5f9';

    const palette: PaletteColors = {
        primary: formData.primaryColor,
        primaryVariant: adjustLightness(formData.primaryColor, -0.1),
        secondary: formData.secondaryColor,
        secondaryVariant: adjustLightness(formData.secondaryColor, -0.1),
        accent: formData.accentColor,
        neutral,
        neutralVariant,
        success: '#22c55e',
        warning: '#eab308',
        danger: '#dc2626',
        info: '#3b82f6',
    };

    const derived = deriveColorsFromPalette(palette, options);

    // Derive gradient colors from primary/secondary/accent
    // Primary gradient: primary to a lighter/darker variant
    const gradientPrimary = [
        formData.primaryColor,
        adjustLightness(formData.primaryColor, isDark ? 0.15 : -0.15),
    ];

    // Accent gradient: accent to primary (creates visual connection)
    const gradientAccent = [
        formData.accentColor,
        formData.primaryColor,
    ];

    // Aurora gradient: use all three palette colors for rich background
    const auroraGradient = [
        formData.primaryColor,
        formData.secondaryColor,
        formData.accentColor,
        adjustLightness(formData.primaryColor, isDark ? -0.2 : 0.2),
    ];

    // Always update all palette colors (except the 3 the user explicitly set)
    return {
        ...derived,
        primaryVariantColor: palette.primaryVariant,
        secondaryVariantColor: palette.secondaryVariant,
        neutralColor: neutral,
        neutralVariantColor: neutralVariant,
        successColor: palette.success,
        warningColor: palette.warning,
        dangerColor: palette.danger,
        infoColor: palette.info,
        // Gradients derived from palette
        gradientPrimary,
        gradientAccent,
        auroraGradient,
    };
}
