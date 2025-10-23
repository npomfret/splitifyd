import { defineConfig, devices } from '@playwright/test';

const DEV_SERVER_HOST = '127.0.0.1';
const ASSIGNED_PORT = process.env.PLAYWRIGHT_DEV_PORT
    ?? process.env.PLAYWRIGHT_ASSIGNED_PORT
    ?? String(40000 + Math.floor(Math.random() * 10000));

process.env.PLAYWRIGHT_ASSIGNED_PORT = ASSIGNED_PORT;

const DEV_SERVER_PORT = Number(ASSIGNED_PORT);
const USE_EXTERNAL_SERVER = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1';
const DEV_SERVER_BASE_URL = `http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`;

/**
 * Playwright configuration for webapp-v2 unit tests
 * Separate from e2e-tests to allow faster individual test execution
 */
// Set environment variable for context reuse
process.env.PW_TEST_REUSE_CONTEXT = '1';

export default defineConfig({
    testDir: './src/__tests__/integration/playwright',

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
        baseURL: DEV_SERVER_BASE_URL,
        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        /* Take screenshot on failure */
        screenshot: 'only-on-failure',

        /* Optimize for speed - headless mode and faster navigation */
        headless: true,
        actionTimeout: 1000,
        navigationTimeout: 3000,

        /* Clean browser state between tests for isolation */
        storageState: undefined, // No persistent storage across tests
    },

    /* Configure project for desktop testing */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 2048 }, // Taller desktop viewport
            },
            testDir: './src/__tests__/integration/playwright',
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: USE_EXTERNAL_SERVER
        ? undefined
        : {
            command: `npm run dev -- --host ${DEV_SERVER_HOST} --port ${DEV_SERVER_PORT}`,
            url: DEV_SERVER_BASE_URL,
            reuseExistingServer: !process.env.CI, // Only reuse in local development
            timeout: 120 * 1000, // 2 minutes to start server
        },
});
