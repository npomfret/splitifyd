import { expect, Page } from '@playwright/test';
import { BasePage } from './BasePage';

const GRAY_REGEX = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\)/i;
const MIN_CONTRAST_RATIO = 4.5;

/**
 * Page Object Model for theme-related verifications
 * Handles assertions about theme properties like colors, glassmorphism, and contrast
 */
export class ThemePage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    /**
     * Navigate to a specific tenant URL
     */
    async navigateTo(url: string): Promise<void> {
        await this.page.goto(url);
        await this.waitForAppReady();
    }

    /**
     * Wait for the app to be ready (app container visible)
     */
    async waitForAppReady(): Promise<void> {
        await expect(this.page.locator('#app')).toBeVisible({ timeout: 10000 });
    }

    /**
     * Fetch tenant app name from config API
     */
    async getTenantAppName(baseUrl: string): Promise<string> {
        const configUrl = new URL('/api/config', baseUrl).toString();
        const response = await this.page.request.get(configUrl);
        expect(response.ok()).toBeTruthy();

        const payload = await response.json();
        const appName = payload?.tenant?.branding?.appName;
        expect(typeof appName === 'string' && appName.length > 0).toBeTruthy();
        return appName as string;
    }

    /**
     * Verify header displays expected app name
     */
    async expectHeaderAppName(expectedAppName: string): Promise<void> {
        const logoText = await this.page.locator('[data-testid="header-logo-link"] span').innerText();
        expect(logoText.trim()).toBe(expectedAppName);
    }

    /**
     * Verify sign up button uses a colored (non-grayscale) background
     */
    async expectSignUpButtonHasColor(): Promise<void> {
        const signUpButton = this.page.getByTestId('header-signup-link');
        await expect(signUpButton).toBeVisible();

        const backgroundColor = await signUpButton.evaluate((element) => getComputedStyle(element).backgroundColor);
        expect(this.isGrayscale(backgroundColor)).toBe(false);
    }

    /**
     * Verify sign up button uses grayscale palette only
     */
    async expectSignUpButtonIsGrayscale(): Promise<void> {
        const signUpButton = this.page.getByTestId('header-signup-link');
        await expect(signUpButton).toBeVisible();

        const [backgroundColor, backgroundImage] = await signUpButton.evaluate((element) => {
            const styles = getComputedStyle(element);
            return [styles.backgroundColor, styles.backgroundImage];
        });

        // Buttons may use either background-color or background-image gradient
        if (backgroundImage && backgroundImage !== 'none') {
            // Extract RGB colors from gradient
            const rgbMatches = backgroundImage.match(/rgba?\(([^)]+)\)/g);
            if (!rgbMatches || rgbMatches.length === 0) {
                throw new Error(`Expected gradient to contain RGB colors, but got: ${backgroundImage}`);
            }

            // Check that all colors in the gradient are grayscale
            const nonGrayscaleColors = rgbMatches.filter((rgb) => !this.isGrayscale(rgb));
            if (nonGrayscaleColors.length > 0) {
                throw new Error(
                    `Expected all gradient colors to be grayscale, but found non-grayscale colors: ${nonGrayscaleColors.join(', ')}. `
                        + `Full gradient: ${backgroundImage}`,
                );
            }
        } else if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
            // Check solid background-color is grayscale (only if not transparent)
            if (!this.isGrayscale(backgroundColor)) {
                throw new Error(`Expected background color to be grayscale, but got: ${backgroundColor}`);
            }
        }
        // If both are transparent/none, button styling may come from parent or pseudo-elements
        // In this case, we accept it as the test is checking theme-level restrictions
    }

    /**
     * Verify theme has glassmorphism support (backdrop-filter with blur)
     */
    async expectGlassmorphismSupport(): Promise<void> {
        const hasGlassSupport = await this.page.evaluate(() => {
            // Check if there's a CSS rule for glass-related effects
            const sheets = Array.from(document.styleSheets);
            for (const sheet of sheets) {
                try {
                    const rules = Array.from(sheet.cssRules || []);
                    for (const rule of rules) {
                        if (rule instanceof CSSStyleRule) {
                            const selector = rule.selectorText || '';
                            const backdropFilter = rule.style.backdropFilter || (rule.style as any).webkitBackdropFilter || '';

                            // Look for glass-related classes or backdrop-filter rules
                            if ((selector.includes('glass') || backdropFilter.includes('blur')) && backdropFilter !== 'none') {
                                return true;
                            }
                        }
                    }
                } catch (e) {
                    // Skip CORS-restricted stylesheets
                }
            }
            return false;
        });

        expect(hasGlassSupport).toBe(true);
    }

    /**
     * Verify theme has no glassmorphism styling
     */
    async expectNoGlassmorphism(): Promise<void> {
        const glassBlur = await this.page.evaluate(() => {
            const testDiv = document.createElement('div');
            testDiv.className = 'glass-panel';
            document.body.appendChild(testDiv);
            const style = getComputedStyle(testDiv);
            const backdropFilter = style.backdropFilter || (style as any).webkitBackdropFilter || '';
            document.body.removeChild(testDiv);
            return backdropFilter;
        });

        expect(glassBlur === '' || glassBlur === 'none').toBeTruthy();
    }

    /**
     * Verify accessible contrast between text and background
     * Tests that primary semantic tokens have accessible contrast
     */
    async expectAccessibleContrast(): Promise<void> {
        const [textPrimaryColor, surfaceBaseColor] = await this.page.evaluate(() => {
            // Read the semantic tokens directly from CSS variables
            const root = document.documentElement;
            const rootStyle = getComputedStyle(root);

            const textPrimary = rootStyle.getPropertyValue('--semantics-colors-text-primary').trim();
            const surfaceBase = rootStyle.getPropertyValue('--semantics-colors-surface-base').trim();

            return [textPrimary, surfaceBase];
        });

        expect(textPrimaryColor).toBeTruthy();
        expect(surfaceBaseColor).toBeTruthy();
        expect(textPrimaryColor).not.toBe('');
        expect(surfaceBaseColor).not.toBe('');

        const ratio = this.calculateContrastRatio(textPrimaryColor, surfaceBaseColor);

        expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
    }

    /**
     * Check if an RGB color string is grayscale
     */
    private isGrayscale(rgbString: string): boolean {
        const match = rgbString.match(GRAY_REGEX);
        if (!match) return false;
        const [, r, g, b] = match.map(Number);
        // Check if all channels are equal (or very close, within 5 units for rounding)
        return Math.abs(r - g) <= 5 && Math.abs(g - b) <= 5 && Math.abs(r - b) <= 5;
    }

    /**
     * Parse a color string to RGB values
     */
    private parseColor(value: string): [number, number, number] {
        const color = value.trim();

        if (color.startsWith('#')) {
            const hex = color.slice(1);
            const normalized = hex.length === 3
                ? hex.split('').map((char) => `${char}${char}`).join('')
                : hex;

            const r = parseInt(normalized.slice(0, 2), 16);
            const g = parseInt(normalized.slice(2, 4), 16);
            const b = parseInt(normalized.slice(4, 6), 16);
            return [r, g, b];
        }

        const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
        if (rgbMatch) {
            const [r, g, b] = rgbMatch[1]
                .split(',')
                .slice(0, 3)
                .map((segment) => Number(segment.trim()));
            return [r, g, b];
        }

        throw new Error(`Unsupported color format: ${value}`);
    }

    /**
     * Calculate relative luminance for a color
     */
    private relativeLuminance([r, g, b]: [number, number, number]): number {
        const toLinear = (channel: number) => {
            const normalized = channel / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        };

        const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
        return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    }

    /**
     * Calculate WCAG contrast ratio between two colors
     */
    private calculateContrastRatio(colorA: string, colorB: string): number {
        const lumA = this.relativeLuminance(this.parseColor(colorA));
        const lumB = this.relativeLuminance(this.parseColor(colorB));
        const [light, dark] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
        return (light + 0.05) / (dark + 0.05);
    }

    /**
     * Verify a CSS variable on :root has the expected value
     */
    async expectRootCssVariable(variableName: string, expectedValue: string): Promise<void> {
        const actualValue = await this.page.evaluate(
            (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
            variableName,
        );
        expect(actualValue).toBe(expectedValue);
    }

    /**
     * Verify an element's CSS property matches an RGB triplet (e.g., "237 68 80")
     */
    async expectElementColorMatches(selector: string, cssProperty: string, rgbTriplet: string): Promise<void> {
        const element = this.page.locator(selector).first();
        await expect(element).toBeVisible();

        const actualColor = await element.evaluate(
            (el, prop) => getComputedStyle(el).getPropertyValue(prop),
            cssProperty,
        );

        const actualRgb = this.normalizeCssColor(actualColor);
        const expectedRgb = this.parseRgbTriplet(rgbTriplet);

        expect(actualRgb).toEqual(expectedRgb);
    }

    /**
     * Verify an element's background gradient contains a specific RGB color
     */
    async expectGradientContainsColor(selector: string, rgbTriplet: string): Promise<void> {
        const element = this.page.locator(selector).first();
        await expect(element).toBeVisible();

        const backgroundImage = await element.evaluate((el) => getComputedStyle(el).getPropertyValue('background-image'));

        const rgbMatches = backgroundImage.match(/rgba?\(([^)]+)\)/g);
        if (!rgbMatches || rgbMatches.length === 0) {
            throw new Error(`No RGB colors found in background-image: ${backgroundImage}`);
        }

        const expectedRgb = this.parseRgbTriplet(rgbTriplet);
        const gradientContainsColor = rgbMatches.some((rgbMatch) => {
            const actualRgb = this.normalizeCssColor(rgbMatch);
            return actualRgb[0] === expectedRgb[0] && actualRgb[1] === expectedRgb[1] && actualRgb[2] === expectedRgb[2];
        });

        expect(gradientContainsColor).toBe(true);
    }

    /**
     * Normalize a CSS color string to RGB triplet
     */
    private normalizeCssColor(colorValue: string): [number, number, number] {
        const match = colorValue.match(/rgba?\(([^)]+)\)/);
        if (!match) {
            throw new Error(`Unexpected color format: ${colorValue}`);
        }

        const parts = match[1]
            .replace(/\//g, ' ')
            .replace(/,/g, ' ')
            .trim()
            .split(/\s+/)
            .map(Number)
            .filter((value): value is number => Number.isFinite(value));

        if (parts.length < 3) {
            throw new Error(`Unable to parse CSS color: ${colorValue}`);
        }

        return [Math.round(parts[0]), Math.round(parts[1]), Math.round(parts[2])];
    }

    /**
     * Parse an RGB triplet string like "237 68 80" to [number, number, number]
     */
    private parseRgbTriplet(rgb: string): [number, number, number] {
        const parts = rgb
            .trim()
            .split(/\s+/)
            .map(Number)
            .filter((value): value is number => Number.isFinite(value));

        if (parts.length !== 3) {
            throw new Error(`Invalid RGB triplet: ${rgb}`);
        }

        return [parts[0], parts[1], parts[2]];
    }
}
