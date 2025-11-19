import type { Page } from '@playwright/test';
import { expect, simpleTest as test } from '../../fixtures/simple-test.fixture';
import { EMULATOR_URL, waitForApp } from '../../helpers';

const emulatorUrl = new URL(EMULATOR_URL);
const portSegment = emulatorUrl.port ? `:${emulatorUrl.port}` : '';
const pathSuffix = emulatorUrl.pathname === '/' ? '' : emulatorUrl.pathname;
const protocol = emulatorUrl.protocol || 'http:';

const AURORA_URL = `${protocol}//localhost${portSegment}${pathSuffix}`;
const BRUTALIST_URL = `${protocol}//127.0.0.1${portSegment}${pathSuffix}`;

// Regex to match any grayscale RGB color where R=G=B (within 5 units tolerance for rounding)
const GRAY_REGEX = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\)/i;
const MIN_CONTRAST_RATIO = 4.5;

function isGrayscale(rgbString: string): boolean {
    const match = rgbString.match(GRAY_REGEX);
    if (!match) return false;
    const [, r, g, b] = match.map(Number);
    // Check if all channels are equal (or very close, within 5 units for rounding)
    return Math.abs(r - g) <= 5 && Math.abs(g - b) <= 5 && Math.abs(r - b) <= 5;
}

async function navigateToTenant(page: Page, url: string): Promise<void> {
    await page.goto(url);
    await waitForApp(page);
}

async function fetchTenantAppName(page: Page, url: string): Promise<string> {
    const configUrl = new URL('/api/config', url).toString();
    const response = await page.request.get(configUrl);
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    const appName = payload?.tenant?.branding?.appName;
    expect(typeof appName === 'string' && appName.length > 0).toBeTruthy();
    return appName as string;
}

async function expectHeaderAppName(page: Page, expectedAppName: string): Promise<void> {
    const logoText = await page.locator('[data-testid="header-logo-link"] span').innerText();
    expect(logoText.trim()).toBe(expectedAppName);
}

async function getCssVariable(page: Page, variableName: string): Promise<string> {
    return page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), variableName);
}

function parseColor(value: string): [number, number, number] {
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

function relativeLuminance([r, g, b]: [number, number, number]): number {
    const toLinear = (channel: number) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };

    const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(colorA: string, colorB: string): number {
    const lumA = relativeLuminance(parseColor(colorA));
    const lumB = relativeLuminance(parseColor(colorB));
    const [light, dark] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
    return (light + 0.05) / (dark + 0.05);
}

test.describe('Theme switching smoke tests', () => {
    test('Aurora theme surfaces teal primary actions', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await navigateToTenant(page, AURORA_URL);

        // Check the primary CTA button uses a colored (non-gray) background
        const signUpButton = page.getByTestId('header-signup-link');
        await expect(signUpButton).toBeVisible();

        const backgroundColor = await signUpButton.evaluate((element) => getComputedStyle(element).backgroundColor);
        expect(isGrayscale(backgroundColor)).toBe(false);

        const appName = await fetchTenantAppName(page, AURORA_URL);
        await expectHeaderAppName(page, appName);
    });

    test('Brutalist theme restricts actions to grayscale palette', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await navigateToTenant(page, BRUTALIST_URL);

        // Find the primary CTA button in the header (uses interactive-primary token)
        const signUpButton = page.getByTestId('header-signup-link');
        await expect(signUpButton).toBeVisible();

        // Primary buttons use gradient background-image, not background-color
        const backgroundImage = await signUpButton.evaluate((element) => getComputedStyle(element).backgroundImage);

        // Extract RGB colors from gradient
        const rgbMatches = backgroundImage.match(/rgba?\(([^)]+)\)/g);
        expect(rgbMatches).toBeTruthy();
        expect(rgbMatches!.length).toBeGreaterThan(0);

        // Check that all colors in the gradient are grayscale
        const allGrayscale = rgbMatches!.every((rgb) => isGrayscale(rgb));
        expect(allGrayscale).toBe(true);

        const appName = await fetchTenantAppName(page, BRUTALIST_URL);
        await expectHeaderAppName(page, appName);
    });

    test('Aurora theme enables glassmorphism via .glass-panel class', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await navigateToTenant(page, AURORA_URL);

        // Check if .glass-panel class has backdrop-filter defined in theme CSS
        const glassBlur = await page.evaluate(() => {
            const testDiv = document.createElement('div');
            testDiv.className = 'glass-panel';
            document.body.appendChild(testDiv);
            const style = getComputedStyle(testDiv);
            const backdropFilter = style.backdropFilter || (style as any).webkitBackdropFilter || '';
            document.body.removeChild(testDiv);
            return backdropFilter;
        });

        // Aurora theme should have blur(24px) defined for glass panels
        expect(glassBlur).toContain('blur');
    });

    test('Brutalist theme has no .glass-panel styling', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await navigateToTenant(page, BRUTALIST_URL);

        // Check if .glass-panel class has no backdrop-filter (brutalist theme has glass: undefined)
        const glassBlur = await page.evaluate(() => {
            const testDiv = document.createElement('div');
            testDiv.className = 'glass-panel';
            document.body.appendChild(testDiv);
            const style = getComputedStyle(testDiv);
            const backdropFilter = style.backdropFilter || (style as any).webkitBackdropFilter || '';
            document.body.removeChild(testDiv);
            return backdropFilter;
        });

        // Brutalist theme should have no blur (glass: undefined means no .glass-panel CSS generated)
        expect(glassBlur === '' || glassBlur === 'none').toBeTruthy();
    });

    test('Aurora maintains accessible contrast between text and base surface', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await navigateToTenant(page, AURORA_URL);

        const [textColor, surfaceColor] = await Promise.all([
            getCssVariable(page, '--semantics-colors-text-primary'),
            getCssVariable(page, '--semantics-colors-surface-base'),
        ]);

        const ratio = contrastRatio(textColor, surfaceColor);
        expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
    });

    test('Brutalist maintains accessible contrast between text and base surface', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        await navigateToTenant(page, BRUTALIST_URL);

        const [textColor, surfaceColor] = await Promise.all([
            getCssVariable(page, '--semantics-colors-text-primary'),
            getCssVariable(page, '--semantics-colors-surface-base'),
        ]);

        const ratio = contrastRatio(textColor, surfaceColor);
        expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
    });
});
