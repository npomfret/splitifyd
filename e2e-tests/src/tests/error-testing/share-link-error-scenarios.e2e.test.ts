import { test, expect } from '@playwright/test';
import { multiUserTest } from '../../fixtures/multi-user-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers';
import { MultiUserWorkflow } from '../../workflows/multi-user.workflow';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Share Link - Error Scenarios', () => {
  multiUserTest('should handle invalid share links gracefully', { annotation: { type: 'skip-error-checking' } }, async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    // Get the base URL from the current page
    await page.waitForLoadState('domcontentloaded');
    const baseUrl = page.url().split('/dashboard')[0];
    const invalidShareLink = `${baseUrl}/join?linkId=invalid-group-id-12345`;
    
    const multiUserWorkflow = new MultiUserWorkflow();
    await multiUserWorkflow.testInvalidShareLink(page, invalidShareLink);
  });

  multiUserTest('should handle malformed share links', { annotation: { type: 'skip-error-checking' } }, async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    
    // Get the base URL from the current page
    await page.waitForLoadState('domcontentloaded');
    const baseUrl = page.url().split('/dashboard')[0];
    
    // Test various malformed links
    // When linkId is missing or empty, app redirects to dashboard
    const emptyLinkCases = [
      `${baseUrl}/join?linkId=`,
      `${baseUrl}/join`,
    ];
    
    for (const link of emptyLinkCases) {
      await page.goto(link);
      await page.waitForURL(/\/dashboard/, { timeout: 5000 });
      expect(page.url()).toContain('/dashboard');
    }
    
    // Test with malicious/invalid linkId - should show error
    const invalidLink = `${baseUrl}/join?linkId=../../malicious`;
    const multiUserWorkflow = new MultiUserWorkflow();
    await multiUserWorkflow.testInvalidShareLink(page, invalidLink);
  });
});