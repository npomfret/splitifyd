import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Component Tests
 *
 * These tests run components in a real browser environment
 * but are much simpler than the experimental CT framework.
 */
export default defineConfig({
    testDir: './src/__tests__/unit/playwright',
    outputDir: './playwright-report/test-results',
    timeout: 10 * 1000, // 10 seconds - fast but reasonable for page loads
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : 1, // Always use 1 worker for consistency
    reporter: [['html', { outputFolder: 'playwright-report/reports', open: 'never' }], ['list']],

    use: {
        actionTimeout: 5000, // 5 seconds for actions - reasonable for form interactions
        baseURL: 'http://localhost:5173', // Will be overridden by webServer
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
        reuseExistingServer: true,
        timeout: 120 * 1000,
    },
});
