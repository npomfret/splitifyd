import { pageTest as test, expect } from "../../fixtures/page-fixtures";
import { waitForApp, setupConsoleErrorReporting } from '../../helpers/index';

setupConsoleErrorReporting();

// Simplified performance test - just basic load time check
test.describe('Performance Tests', () => {
  test('should load within reasonable time', async ({ homepageNavigated }) => {
    const startTime = Date.now();
    const { page, homepagePage } = homepageNavigated;
    await waitForApp(page);
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(1000);
  });
});