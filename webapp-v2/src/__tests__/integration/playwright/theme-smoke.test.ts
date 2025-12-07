import { appConfigHandler, firebaseInitConfigHandler } from '@/test/msw/handlers';
import { ThemePage } from '@billsplit-wl/test-support';
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
            const themePage = new ThemePage(page);

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
                    const hostKey = window.location.host || 'default';
                    const storageKey = `tenant-theme:${hostKey}:hash`;
                    localStorage.setItem(storageKey, hash);
                }, fixture.localStorageHash);
            } else {
                await page.addInitScript(() => {
                    const hostKey = window.location.host || 'default';
                    const storageKey = `tenant-theme:${hostKey}:hash`;
                    localStorage.removeItem(storageKey);
                });
            }

            // Finally navigate
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await expect(page).toHaveURL('/');

            // Verify theme CSS variables are applied correctly
            await themePage.expectRootCssVariable('--interactive-primary-rgb', fixture.cssVars.interactivePrimary);
            await themePage.expectRootCssVariable('--text-primary-rgb', fixture.cssVars.textPrimary);
            await themePage.expectRootCssVariable('--surface-base-rgb', fixture.cssVars.surfaceBase);
            await themePage.expectRootCssVariable('--border-default-rgb', fixture.cssVars.borderDefault);

            // Verify theme colors are applied to visible UI elements
            // Check the "Sign Up" button in the header (always visible and styled with theme color)
            const headerSignUpButton = page.getByRole('button', { name: 'Sign Up' }).first();
            await expect(headerSignUpButton).toBeVisible();

            // Primary buttons use gradient background-image, so check background-image contains the color
            await themePage.expectGradientContainsColor(
                'button:has-text("Sign Up")',
                fixture.cssVars.interactivePrimary,
            );

            // Navigate to login page to check more theme applications
            const loginButton = page.getByText('Login').first();
            await expect(loginButton).toBeVisible();
            // Wait for any theme-related transitions to complete before clicking
            await loginButton.click({ timeout: 3000 });
            await page.waitForURL('/login');

            // Check the "Sign up" link text color on the login page
            // The sign-up link is within the login form, use .text-interactive-primary to target it
            await themePage.expectElementColorMatches(
                'button.text-interactive-primary:has-text("Sign up")',
                'color',
                fixture.cssVars.interactivePrimary,
            );
        });
    }
});

function buildThemeCss(vars: ThemeCssVars): string {
    // Build gradient using the interactive-primary color
    const rgbParts = vars.interactivePrimary.split(' ').map(Number);
    const primaryColor = `rgb(${rgbParts[0]}, ${rgbParts[1]}, ${rgbParts[2]})`;
    const gradientPrimary = `linear-gradient(135deg, ${primaryColor}, ${primaryColor})`;

    return `:root {
        --interactive-primary-rgb: ${vars.interactivePrimary} !important;
        --interactive-primary-foreground-rgb: ${vars.interactivePrimaryForeground} !important;
        --text-primary-rgb: ${vars.textPrimary} !important;
        --text-muted-rgb: ${vars.textMuted} !important;
        --surface-base-rgb: ${vars.surfaceBase} !important;
        --surface-muted-rgb: ${vars.surfaceMuted} !important;
        --border-default-rgb: ${vars.borderDefault} !important;
        --gradient-primary: ${gradientPrimary} !important;
        --shadows-md: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
    }`;
}
