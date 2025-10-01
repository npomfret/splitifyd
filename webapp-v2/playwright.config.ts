import {defineConfig, devices} from '@playwright/test';

/**
 * Playwright configuration for webapp-v2 unit tests
 * Separate from e2e-tests to allow faster individual test execution
 */
export default defineConfig({
    testDir: './src/__tests__/unit/playwright',

    /* Run tests serially to maximize browser reuse */
    fullyParallel: false,

    /* Fail the build if you accidentally left test.only in the source code. */
    forbidOnly: false,

    /* No retries for unit tests */
    retries: 0,

    /* Single worker for maximum browser reuse */
    workers: 1,

    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [
        ['html', { open: 'never', outputFolder: 'playwright-report/html' }],
        ['json', { outputFile: 'playwright-report/results.json' }],
        ['junit', { outputFile: 'playwright-report/results.xml' }],
    ],

    /* Global test timeout */
    timeout: 5 * 1000,

    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://localhost:5173',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        /* Take screenshot on failure */
        screenshot: 'only-on-failure',

        /* Optimize for speed - headless mode and faster navigation */
        headless: true,
        actionTimeout: 5000,
        navigationTimeout: 5000,
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: {...devices['Desktop Chrome']},
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
    },
});