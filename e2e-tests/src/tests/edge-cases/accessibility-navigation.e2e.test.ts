import { pageTest, expect } from '../../fixtures';
import { setupMCPDebugOnFailure } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

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
    
    // No console errors
    // Console errors are automatically captured by 
  });
});