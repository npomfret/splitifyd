import { simpleTest, expect } from '../../../fixtures/simple-test.fixture';
import { LoginPage } from '../../../pages';

// NOTE: ARIA labels testing moved to unit tests for better performance
simpleTest.describe('Form Accessibility', () => {
    simpleTest('should navigate login form with keyboard', async ({ newEmptyBrowser }) => {
        const { page } = await newEmptyBrowser();
        const loginPage = new LoginPage(page);
        await loginPage.navigate();

        // Clear any pre-filled login data to get consistent focus behavior
        await loginPage.clearStorage();
        
        // Reload page to get clean form state
        await page.reload();
        
        // Wait for form to be fully interactive and ready
        await loginPage.waitForFormReady();

        // Check what element has focus when page loads
        const initialFocusedElement = await loginPage.getFocusedElement();
        console.log(`Initial focus: ${initialFocusedElement}`);

        // Autofocus behavior is inconsistent in test environments, so handle both cases
        // todo: figure out why this is
        if (initialFocusedElement.includes('email-input')) {
            // Email input is already focused
            console.log('Email input has autofocus');
            await expect(loginPage.getEmailInput()).toBeFocused();
        } else {
            // Need to tab to email input - let's find where it is in the tab sequence
            console.log('Need to tab to email input');
            
            // Tab until we reach the email input
            let tabCount = 0;
            let currentFocus = initialFocusedElement;
            
            while (!currentFocus.includes('email-input') && tabCount < 5) {
                await page.keyboard.press('Tab');
                tabCount++;
                currentFocus = await loginPage.getFocusedElement();
                console.log(`Tab ${tabCount}: ${currentFocus}`);
                
                if (currentFocus.includes('email-input')) {
                    break;
                }
            }
            
            await expect(loginPage.getEmailInput()).toBeFocused();
        }
        
        // Type in email field using keyboard
        await page.keyboard.type('test@example.com');
        await expect(loginPage.getEmailInput()).toHaveValue('test@example.com');

        // Continue keyboard navigation from email input
        // Next Tab: Should go to password input field
        await page.keyboard.press('Tab');
        await expect(loginPage.getPasswordInput()).toBeFocused();

        // Type in password field using keyboard
        await page.keyboard.type('TestPassword123');
        await expect(loginPage.getPasswordInput()).toHaveValue('TestPassword123');

        // Next Tab: Should go to show password button
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused();

        // Next Tab: Should go to remember me checkbox
        await page.keyboard.press('Tab');
        await expect(loginPage.getRememberMeCheckbox()).toBeFocused();

        // Next Tab: Should go to forgot password link/button
        await page.keyboard.press('Tab');
        console.log(`After Tab (to forgot password): ${await loginPage.getFocusedElement()}`);
        await expect(page.getByRole('button', { name: /forgot.*password/i })).toBeFocused();

        // Next Tab: Should go to Sign In button (enabled because form is now valid)
        await page.keyboard.press('Tab');
        await expect(loginPage.getSubmitButton()).toBeFocused();

        // Next Tab: Should go to Default Login button
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Default Login' })).toBeFocused();

        // Next Tab: Should go to Sign up link (the one in the form, not header)
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Sign up', exact: true })).toBeFocused();

        // Verify the form is properly structured for keyboard navigation
        await expect(page).toHaveURL(/\/login/);
        
        // Test completes successfully - all elements were focusable in correct order
        // This validates the accessibility and keyboard navigation without triggering auth errors
    });
});
