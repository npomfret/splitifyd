import { pageTest, expect } from '../../fixtures';
import { waitForApp, setupMCPDebugOnFailure } from '../../helpers';
import { SELECTORS } from '../../constants/selectors';
import { TIMEOUTS } from '../../config/timeouts';

// Enable MCP debugging for failed tests
setupMCPDebugOnFailure();

// TODO: CANDIDATE FOR CI PERFORMANCE BUDGET
// The load time test just measures timing without interaction.
// Should be a performance budget check in CI, not an E2E test.
pageTest.describe('Performance Monitoring E2E', () => {
  pageTest('should load pages within acceptable time', async ({ homepagePage }) => {
    const startTime = Date.now();
    
    await homepagePage.navigate();
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 5 seconds (generous for CI)
    expect(loadTime).toBeLessThan(5000);
  });

  pageTest('should maintain full functionality with slow network', async ({ page, context, loginPage }) => {
    
    // Simulate slow 3G
    await context.route('**/*', route => {
      setTimeout(() => route.continue(), TIMEOUTS.QUICK / 5);
    });
    
    await loginPage.navigate();
    
    // Page should still be functional on slow network
    await waitForApp(page);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // COMPREHENSIVE FUNCTIONALITY TEST (fixing misleading test name)
    // Test all form interactions, not just one input
    const emailInput = loginPage.getEmailInput();
    const passwordInput = loginPage.getPasswordInput();
    const submitButton = loginPage.getSubmitButton();
    
    // Test email input
    await loginPage.fillPreactInput(emailInput, 'test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
    
    // Test password input
    await loginPage.fillPreactInput(passwordInput, 'TestPassword123');
    await expect(passwordInput).toHaveValue('TestPassword123');
    
    // Test form validation - clear email and check submit is disabled
    await loginPage.fillPreactInput(emailInput, '');
    await expect(submitButton).toBeDisabled();
    
    // Re-fill email
    await loginPage.fillPreactInput(emailInput, 'test@example.com');
    await expect(submitButton).toBeEnabled();
    
    // Test navigation links still work
    const registerLink = page.getByRole('link', { name: /sign up|create account/i });
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    
    // Should navigate to register page even with slow network
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    
    // No console errors
    // Console errors are automatically captured by 
  });
});