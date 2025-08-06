import { pageTest, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Resource Monitoring E2E', () => {
  pageTest('should not have any 404 resources', async ({ page, homepagePage, loginPage, registerPage }) => {
    const failedRequests: string[] = [];
    
    // Listen for failed requests and assert no 404s
    page.on('response', response => {
      if (response.status() === 404) {
        failedRequests.push(`${response.status()} - ${response.url()}`);
      }
      // Assert each response is not a 404
      expect(response.status()).not.toBe(404);
    });

    // Visit main pages using page objects
    
    await homepagePage.navigate();
    await loginPage.navigate();
    await registerPage.navigate();
    
    // Verify no 404s were collected (redundant with inline assertions but provides clear final check)
    expect(failedRequests).toHaveLength(0);
  });
});