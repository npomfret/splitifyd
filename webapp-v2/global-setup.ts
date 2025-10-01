import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Get headless setting from config (respects --headed CLI flag)
  const headless = config.projects[0]?.use?.headless ?? true;

  // Launch a single browser instance that will be reused across all tests
  const browser = await chromium.launch({
    headless: headless,
  });

  // Store browser for reuse
  (global as any).__PLAYWRIGHT_BROWSER__ = browser;

  return async () => {
    // Close browser after all tests complete
    await browser.close();
  };
}

export default globalSetup;