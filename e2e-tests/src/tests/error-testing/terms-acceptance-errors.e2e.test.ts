import { pageTest, expect } from '../../fixtures';
import { RegisterPage } from '../../pages';
import { setupMCPDebugOnFailure } from '../../helpers';
import {DEFAULT_PASSWORD, generateTestEmail} from "../../../../packages/test-support/test-helpers.ts";

setupMCPDebugOnFailure();

pageTest.describe('Terms Acceptance Error Testing', () => {
    pageTest('should allow form submission when both policies accepted', async ({ page }, testInfo) => {
        // @skip-error-checking - This test may have expected registration errors
        testInfo.annotations.push({ type: 'skip-error-checking', description: 'This test may have expected registration errors' });

        const registerPage = new RegisterPage(page);
        // Navigate to the register page first
        await registerPage.navigate();

        // Fill form completely
        await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
        await registerPage.fillPreactInput('input[placeholder="Enter your email"]', generateTestEmail());
        await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', DEFAULT_PASSWORD);
        await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', DEFAULT_PASSWORD);

        // Check both checkboxes using page object methods
        await registerPage.checkTermsCheckbox();
        await registerPage.checkCookieCheckbox();

        // Submit button should be enabled and clickable
        const submitButton = registerPage.getCreateAccountButton();
        await expect(submitButton).toBeEnabled();

        // Test that clicking the button doesn't immediately fail (form validation passes)
        // Note: We don't test the full registration flow as that's covered elsewhere
        await submitButton.click();

        // Wait for any validation or network activity to complete using page object
        await registerPage.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

        // At this point, the form has passed client-side validation and attempted submission
        // The actual registration success/failure is tested in other test files
    });
});
