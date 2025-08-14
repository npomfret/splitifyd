import {defineConfig, devices} from '@playwright/test';
import {EMULATOR_URL} from './src/helpers';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './src/tests',
  /* Output directory for test results */
  outputDir: '../tmp/playwright-test-results',
  /* Global setup and teardown for user pool management */
  globalSetup: './src/fixtures/global-setup.ts',
  globalTeardown: './src/fixtures/global-teardown.ts',
  /* Global test timeout - some are slow */
  timeout: 15000,
  /* Expect timeout for assertions like toBeVisible() */
  expect: {
    timeout: 2000
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: EMULATOR_URL,
    
    /* Fast fail for element interactions */
    actionTimeout: 1500,
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot when test fails */
    screenshot: 'only-on-failure',
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