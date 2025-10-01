import {defineConfig, devices} from '@playwright/test';

/**
 * Playwright configuration for webapp-v2 unit tests
 * Separate from e2e-tests to allow faster individual test execution
 */
// Set environment variable for context reuse
process.env.PW_TEST_REUSE_CONTEXT = '1';

export default defineConfig({
    testDir: './src/__tests__/unit/playwright',

    /* Global setup to create reusable browser instance */
    globalSetup: './global-setup.ts',

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build if you accidentally left test.only in the source code. */
    forbidOnly: false,

    /* No retries for unit tests */
    retries: 0,

    /* Single worker for browser reuse - only 1 browser instance */
    workers: 1,

    /* Run all tests and report all failures */
    maxFailures: undefined,

    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [
        ['html', { open: 'never', outputFolder: 'playwright-report/html' }],
        ['json', { outputFile: 'playwright-report/results.json' }],
        ['junit', { outputFile: 'playwright-report/results.xml' }],
    ],

    /* Global test timeout - must be longer than any individual test */
    timeout: 10 * 1000,

    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL will be set automatically by webServer random port */

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        /* Take screenshot on failure */
        screenshot: 'only-on-failure',

        /* Optimize for speed - headless mode and faster navigation */
        headless: true,
        actionTimeout: 1000,
        navigationTimeout: 3000,

        /* Expect timeout to match action timeout */
        expect: {
            timeout: 1000,
        },

        /* Clean browser state between tests for isolation */
        storageState: undefined, // No persistent storage across tests
    },

    /* Configure project for desktop testing */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 1024 }, // Taller desktop viewport
            },
            testDir: './src/__tests__/unit/playwright',
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'npm run dev',
        port: 5173, // Will auto-increment if port is taken
        reuseExistingServer: !process.env.CI, // Only reuse in local development
        timeout: 120 * 1000, // 2 minutes to start server
    },
});