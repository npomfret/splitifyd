import { pageTest, expect } from '../../fixtures';
import { setupMCPDebugOnFailure } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

// TODO: PARTIAL CANDIDATE FOR UNIT TEST
// The "should have proper ARIA labels" test just checks element attributes
// and could be a unit test. The keyboard navigation test is valid E2E.
//
// To convert: The ARIA labels test should be a unit test in webapp-v2
// that renders form components and checks for proper accessibility attributes.
// Keep the keyboard navigation test as E2E since it tests actual interaction.
pageTest.describe('Form Accessibility', () => {
  pageTest('should navigate login form with keyboard', async ({ loginPageNavigated }) => {
    const { page } = loginPageNavigated;
    
    // Focus should start at first input or be tabbable to it
    await page.keyboard.press('Tab');
    
    // Type in focused field (should be email)
    await page.keyboard.type('test@example.com');
    
    // Tab to password field
    await page.keyboard.press('Tab');
    await page.keyboard.type('Password123');
    
    // Tab to submit button
    await page.keyboard.press('Tab');
    
    // Submit with Enter
    await page.keyboard.press('Enter');
    
    // Form was submitted (will stay on page if invalid credentials)
    // Just verify no errors occurred during keyboard navigation
    
    // No console errors
    // Console errors are automatically captured by 
  });

  pageTest('should have proper ARIA labels', async ({ loginPageNavigated }) => {
    const { page, loginPage } = loginPageNavigated;
    
    // Check form has proper structure
    const form = page.locator(SELECTORS.FORM);
    // Form MUST exist on login page - this is not optional
    await expect(form).toBeVisible();
    
    // Inputs should be associated with labels
    const emailInput = loginPage.getEmailInput();
    const passwordInput = loginPage.getPasswordInput();
    
    // Verify inputs exist
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    
    // ACTUALLY CHECK ARIA LABELS (fixing misleading test name)
    // Check that inputs have either aria-label or are associated with labels
    const emailAriaLabel = await emailInput.getAttribute('aria-label');
    const emailLabelledBy = await emailInput.getAttribute('aria-labelledby');
    const emailId = await emailInput.getAttribute('id');
    
    // Email input should have accessibility labeling
    if (!emailAriaLabel && !emailLabelledBy) {
      // Check if there's a label element pointing to this input
      const emailLabel = page.locator(`label[for="${emailId}"]`);
      await expect(emailLabel).toBeVisible();
    }
    
    const passwordAriaLabel = await passwordInput.getAttribute('aria-label');
    const passwordLabelledBy = await passwordInput.getAttribute('aria-labelledby');
    const passwordId = await passwordInput.getAttribute('id');
    
    // Password input should have accessibility labeling
    if (!passwordAriaLabel && !passwordLabelledBy) {
      // Check if there's a label element pointing to this input
      const passwordLabel = page.locator(`label[for="${passwordId}"]`);
      await expect(passwordLabel).toBeVisible();
    }
    
    // No console errors
    // Console errors are automatically captured by 
  });
});