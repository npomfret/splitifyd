import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Component Tests
 *
 * These tests run components in a real browser environment
 * but are much simpler than the experimental CT framework.
 */
export default defineConfig({
    testDir: './playwright-tests',
    outputDir: './playwright-report/test-results',
    timeout: 10 * 1000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 4,
    reporter: [['html', { outputFolder: 'playwright-report/reports', open: 'never' }], ['list']],

    use: {
        actionTimeout: 5000,
        baseURL: 'http://localhost:5173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
        timeout: 120 * 1000,
    },
});