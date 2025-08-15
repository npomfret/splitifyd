import { pageTest, expect } from '../../fixtures';
import { RegisterPage } from '../../pages';
import { setupMCPDebugOnFailure } from '../../helpers';

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
    await registerPage.fillPreactInput('input[placeholder="Enter your email"]', `test-submit-${Date.now()}@example.com`);
    await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', 'TestPassword123!');
    await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', 'TestPassword123!');
    
    // Check both checkboxes using page object methods
    await registerPage.checkTermsCheckbox();
    await registerPage.checkCookieCheckbox();
    
    // Submit button should be enabled and clickable
    const submitButton = registerPage.getCreateAccountButton();
    await expect(submitButton).toBeEnabled();
    
    // Test that clicking the button doesn't immediately fail (form validation passes)
    // Note: We don't test the full registration flow as that's covered elsewhere
    await submitButton.click();
    
    // Wait for any validation or network activity to complete
    await page.waitForLoadState('networkidle');
    
    // At this point, the form has passed client-side validation and attempted submission
    // The actual registration success/failure is tested in other test files
  });
});