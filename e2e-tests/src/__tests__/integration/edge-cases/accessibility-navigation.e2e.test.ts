import { pageTest, expect } from '../../../fixtures';
import { setupMCPDebugOnFailure } from '../../../helpers';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

// NOTE: ARIA labels testing moved to unit tests for better performance
pageTest.describe('Form Accessibility', () => {
    pageTest('should navigate login form with keyboard', async ({ loginPageNavigated, loginPage }) => {
        const { page } = loginPageNavigated;

        // Wait for page to be fully interactive
        await page.waitForLoadState('domcontentloaded');
        await expect(loginPage.getEmailInput()).toBeVisible();

        // Navigate through the tab sequence to reach email input
        // Based on actual page structure: Splitifyd button, Login button, Sign Up button, then email input
        await page.keyboard.press('Tab'); // logo img link
        await page.keyboard.press('Tab'); // Login button  
        await page.keyboard.press('Tab'); // Sign Up button
        await page.keyboard.press('Tab'); // Email input
        
        // Verify email field is focused
        await expect(loginPage.getEmailInput()).toBeFocused();

        // Type in email field
        await page.keyboard.type('foo@bar.com');
        
        // Verify the value was entered
        await expect(loginPage.getEmailInput()).toHaveValue('foo@bar.com');

        // Tab to password field
        await page.keyboard.press('Tab');
        
        // Verify password field is focused
        await expect(loginPage.getPasswordInput()).toBeFocused();
        
        await page.keyboard.type('Password123');
        
        // Verify password value was entered
        await expect(loginPage.getPasswordInput()).toHaveValue('Password123');

        await page.keyboard.press('Tab');// Remember me
        await page.keyboard.press('Tab');// show password
        await page.keyboard.press('Tab');// Forogot passowrd
        await page.keyboard.press('Tab');// submit button (sign in)

        // Verify submit button is focused
        await expect(loginPage.getSubmitButton()).toBeFocused();

        // Submit with Enter
        await page.keyboard.press('Enter');

        // Form was submitted - verify we either see error or navigation
        // Since it's invalid credentials, should stay on login page with error
        await expect(page).toHaveURL(/\/login/);
        
        // Verify keyboard navigation worked without console errors
        // (console errors are automatically captured by test infrastructure)
    });
});
