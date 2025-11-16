import type { Locator, Page } from '@playwright/test';
import { appConfigHandler, firebaseInitConfigHandler } from '@/test/msw/handlers';
import { expect, test } from '../../utils/console-logging-fixture';

type ThemeCssVars = {
    interactivePrimary: string;
    interactivePrimaryForeground: string;
    textPrimary: string;
    textMuted: string;
    surfaceBase: string;
    surfaceMuted: string;
    borderDefault: string;
};

type ThemeFixture = {
    label: string;
    hashKey: string;
    localStorageHash?: string;
    cssVars: ThemeCssVars;
};

const themeFixtures: ThemeFixture[] = [
    {
        label: 'system fallback theme',
        hashKey: 'default',
        cssVars: {
            interactivePrimary: '237 68 80',
            interactivePrimaryForeground: '255 255 255',
            textPrimary: '30 27 75',
            textMuted: '112 111 133',
            surfaceBase: '250 250 252',
            surfaceMuted: '241 241 247',
            borderDefault: '214 220 230',
        },
    },
    {
        label: 'loopback tenant theme',
        hashKey: 'loopback-tenant-hash',
        localStorageHash: 'loopback-tenant-hash',
        cssVars: {
            interactivePrimary: '34 197 94',
            interactivePrimaryForeground: '15 23 42',
            textPrimary: '20 30 80',
            textMuted: '90 105 120',
            surfaceBase: '238 248 238',
            surfaceMuted: '220 241 230',
            borderDefault: '150 205 170',
        },
    },
];

const themeMap = new Map(themeFixtures.map((fixture) => [fixture.hashKey, fixture]));

test.describe('Tenant theme smoke suite', () => {
    for (const fixture of themeFixtures) {
        test(`applies ${fixture.label}`, async ({ pageWithLogging: page, msw }) => {
            // Register config handlers to prevent 404 errors
            await msw.use([firebaseInitConfigHandler(), appConfigHandler()]);

            // Set up route interception FIRST (before any navigation or init scripts)
            await page.route(/\/api\/theme\.css/, async (route) => {
                const url = new URL(route.request().url());
                const hashKey = url.searchParams.get('v') ?? 'default';
                const activeTheme = themeMap.get(hashKey) ?? themeMap.get('default')!;
                await route.fulfill({
                    status: 200,
                    contentType: 'text/css',
                    body: buildThemeCss(activeTheme.cssVars),
                });
            });

            // Then set up localStorage via init script
            if (fixture.localStorageHash) {
                await page.addInitScript((hash) => {
                    localStorage.setItem('splitifyd:theme-hash', hash);
                }, fixture.localStorageHash);
            } else {
                await page.addInitScript(() => {
                    localStorage.removeItem('splitifyd:theme-hash');
                });
            }

            // Finally navigate
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await expect(page).toHaveURL('/');

            // Wait for the theme stylesheet link to load
            await page.waitForLoadState('networkidle');

            // Also wait for the stylesheet to be fully loaded
            await page.waitForFunction(() => {
                const link = document.getElementById('tenant-theme-stylesheet') as HTMLLinkElement;
                return link?.sheet !== null && link?.sheet !== undefined;
            }, { timeout: 5000 });

            // Verify theme CSS variables are applied correctly
            await expectRootCssVar(page, '--interactive-primary-rgb', fixture.cssVars.interactivePrimary);
            await expectRootCssVar(page, '--text-primary-rgb', fixture.cssVars.textPrimary);
            await expectRootCssVar(page, '--surface-base-rgb', fixture.cssVars.surfaceBase);
            await expectRootCssVar(page, '--border-default-rgb', fixture.cssVars.borderDefault);

            // Verify theme colors are applied to visible UI elements
            // Check the "Sign Up" button in the header (always visible and styled with theme color)
            const headerSignUpButton = page.getByRole('button', { name: 'Sign Up' }).first();
            await expect(headerSignUpButton).toBeVisible();
            await expectColorMatch(headerSignUpButton, 'background-color', fixture.cssVars.interactivePrimary);

            // Navigate to login page to check more theme applications
            const loginButton = page.getByText('Login').first();
            await expect(loginButton).toBeVisible();
            await loginButton.click();
            await page.waitForURL('/login');

            // Check the "Sign up" link text color on the login page
            const signUpLink = page.getByTestId('loginpage-signup-button');
            await expect(signUpLink).toBeVisible();
            await expectColorMatch(signUpLink, 'color', fixture.cssVars.interactivePrimary);
        });
    }
});

function buildThemeCss(vars: ThemeCssVars): string {
    return `:root {
        --interactive-primary-rgb: ${vars.interactivePrimary} !important;
        --interactive-primary-foreground-rgb: ${vars.interactivePrimaryForeground} !important;
        --text-primary-rgb: ${vars.textPrimary} !important;
        --text-muted-rgb: ${vars.textMuted} !important;
        --surface-base-rgb: ${vars.surfaceBase} !important;
        --surface-muted-rgb: ${vars.surfaceMuted} !important;
        --border-default-rgb: ${vars.borderDefault} !important;
    }`;
}

async function expectRootCssVar(page: Page, variable: string, expected: string): Promise<void> {
    const actual = await page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), variable);
    expect(actual).toBe(expected);
}

async function expectColorMatch(locator: Locator, cssProperty: string, rgbTriplet: string): Promise<void> {
    const actual = await locator.evaluate((element, property) => getComputedStyle(element as Element).getPropertyValue(property), cssProperty);
    expect(normalizeCssColor(actual)).toEqual(parseRgbString(rgbTriplet));
}

function normalizeCssColor(colorValue: string): [number, number, number] {
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

function parseRgbString(rgb: string): [number, number, number] {
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
