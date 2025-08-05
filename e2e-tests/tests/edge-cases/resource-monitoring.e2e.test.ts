import { pageTest, expect } from '../../fixtures/page-fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Resource Monitoring E2E', () => {
  pageTest('should not have any 404 resources', async ({ page, homepagePage, loginPage, registerPage }) => {
    const failed404s: string[] = [];
    
    // Listen for failed requests
    page.on('response', response => {
      if (response.status() === 404) {
        failed404s.push(`${response.status()} - ${response.url()}`);
      }
    });

    // Visit main pages using page objects
    
    await homepagePage.navigate();
    await loginPage.navigate();
    await registerPage.navigate();
    
    // No 404s should have occurred
    expect(failed404s).toHaveLength(0);
  });
});