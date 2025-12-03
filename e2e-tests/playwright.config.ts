import { defineConfig, devices } from '@playwright/test';
import {emulatorHostingURL} from "@billsplit-wl/test-support";

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './src/__tests__/integration',
    /* Output directory for test results - default to integration data path */
    outputDir: './playwright-output/integration/data',
    /* Global setup and teardown for user pool management */
    globalSetup: './src/fixtures/global-setup.ts',
    /* Global test timeout - some are slow */
    timeout: 25000,
    /* Expect timeout for assertions like toBeVisible() */
    expect: {
        timeout: 2000,
    },
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: true,
    /* Retry on CI only */
    retries: 0,
    /* Opt out of parallel tests on CI. */
    workers: 1,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'list',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: emulatorHostingURL(),

        /* Set the locale for all tests */
        locale: 'en-US',

        /* Fast fail for element interactions */
        actionTimeout: 1500,

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        /* Take screenshot when test fails */
        screenshot: 'only-on-failure',

        /* Force bypass browser cache */
        bypassCSP: true,
        ignoreHTTPSErrors: true,

        /* Browser context options to disable caching */
        contextOptions: {
            ignoreHTTPSErrors: true,
        },

        /* Use incognito mode to avoid caching issues */
        launchOptions: {
            args: ['--disable-web-security', '--disable-cache', '--disable-application-cache', '--disable-offline-load-stale-cache', '--disk-cache-size=0', '--media-cache-size=0'],
        },
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1024, height: 2048 },
            },
        },
    ],
});
