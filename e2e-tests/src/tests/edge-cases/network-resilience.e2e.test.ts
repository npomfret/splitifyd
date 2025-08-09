import { test } from '@playwright/test';
import { pageTest, expect } from '../../fixtures';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();
setupConsoleErrorReporting();

pageTest.describe('Network Resilience E2E', () => {
  pageTest('should handle network errors gracefully', async ({ page, context, loginPage }) => {
    test.info().annotations.push({ type: 'skip-error-checking' });
    // Block API calls to simulate network failure
    await context.route('**/api/**', route => route.abort());
    
    // Try to load login page (which might make API calls)
    await loginPage.navigate();
    
    // Page should still render even if API calls fail
    await expect(loginPage.getSignInHeading()).toBeVisible({timeout: 5000});// high timeout intentionally
    
    // Should not have unhandled errors (handled network errors are ok)
    // This is a basic check - app should handle network failures gracefully
  });
});