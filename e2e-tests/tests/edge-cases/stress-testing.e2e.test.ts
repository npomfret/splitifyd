import { pageTest, expect } from '../../fixtures/page-fixtures';
import { waitForApp, setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Stress Testing E2E', () => {
  pageTest('should handle rapid navigation without errors', async ({ page, homepagePage, loginPage, registerPage }) => {
    
    // Rapidly navigate between pages using page objects
    
    for (let i = 0; i < 5; i++) {
      await loginPage.navigate();
      await registerPage.navigate();
      await homepagePage.navigate();
    }
    
    // Final page should load correctly
    await waitForApp(page);
    await expect(page.getByRole('heading', { 
      name: 'Effortless Bill Splitting, Simplified & Smart.' 
    })).toBeVisible();
    
    // No console errors from rapid navigation
    // Console errors are automatically captured by setupConsoleErrorReporting
  });
});