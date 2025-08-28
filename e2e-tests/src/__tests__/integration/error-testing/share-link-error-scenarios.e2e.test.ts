import { test, expect } from '@playwright/test';
import { multiUserTest } from '../../../fixtures';
import { setupMCPDebugOnFailure } from '../../../helpers';
import { MultiUserWorkflow } from '../../../workflows';

setupMCPDebugOnFailure();

test.describe('Share Link - Error Scenarios', () => {
    multiUserTest('should handle invalid share links gracefully', { annotation: { type: 'skip-error-checking' } }, async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;

        // Get the base URL from the current page
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const baseUrl = page.url().split('/dashboard')[0];
        const invalidShareLink = `${baseUrl}/join?linkId=invalid-group-id-12345`;

        const multiUserWorkflow = new MultiUserWorkflow();
        await multiUserWorkflow.testInvalidShareLink(page, invalidShareLink);
    });

    multiUserTest('should handle malformed share links', { annotation: { type: 'skip-error-checking' } }, async ({ authenticatedPage }) => {
        const { page } = authenticatedPage;

        // Get the base URL from the current page using page object
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
        const baseUrl = page.url().split('/dashboard')[0];

        // Test various malformed links using page object navigation
        // When linkId is missing or empty, app now shows an error page (not redirect)
        const emptyLinkCases = [`${baseUrl}/join?linkId=`, `${baseUrl}/join`];

        for (const link of emptyLinkCases) {
            await page.goto(link);
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

            // Should stay on /join page and show error message
            expect(page.url()).toContain('/join');

            // Check for error message
            await expect(page.getByText('Invalid Link')).toBeVisible();
            await expect(page.getByText(/No group invitation link was provided/)).toBeVisible();

            // Should have a button to go back to dashboard
            const backButton = page.getByRole('button', { name: /Back to Dashboard/i });
            await expect(backButton).toBeVisible();
        }

        // Test with malicious/invalid linkId - should show error
        const invalidLink = `${baseUrl}/join?linkId=../../malicious`;
        const multiUserWorkflow = new MultiUserWorkflow();
        await multiUserWorkflow.testInvalidShareLink(page, invalidLink);
    });
});
