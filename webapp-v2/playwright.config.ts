import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for webapp-v2 unit tests
 * These are unit tests that use Playwright with mocked APIs
 * They do NOT require the Firebase emulator
 */
export default defineConfig({
    testDir: './src/__tests__/unit/playwright',
    outputDir: './test-results',
    timeout: 5000, // 5 seconds per test
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 4,
    reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],

    use: {
        actionTimeout: 500, // 0.5 seconds for actions
        baseURL: process.env.VITE_APP_URL || 'http://localhost:5173',
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
