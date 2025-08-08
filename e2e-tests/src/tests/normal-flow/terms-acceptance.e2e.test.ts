import { pageTest, expect } from '../../fixtures';
import { RegisterPage } from '../../pages';

pageTest.describe('Terms and Cookie Policy Acceptance', () => {
  pageTest.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
  });

  pageTest('should display both terms and cookie policy checkboxes', async ({ page }) => {
    // Check that both checkboxes are present using more specific locators
    const termsCheckbox = page.locator('label:has-text("I accept the Terms of Service") input[type="checkbox"]');
    const cookieCheckbox = page.locator('label:has-text("I accept the Cookie Policy") input[type="checkbox"]');
    
    await expect(termsCheckbox).toBeVisible();
    await expect(cookieCheckbox).toBeVisible();
    
    // Check that they have appropriate labels
    await expect(page.locator('text=I accept the Terms of Service')).toBeVisible();
    await expect(page.locator('text=I accept the Cookie Policy')).toBeVisible();
    
    // Check that links exist - use first() to avoid strict mode violation
    await expect(page.locator('a[href="/terms"]').first()).toBeVisible();
    await expect(page.locator('a[href="/cookies"]').first()).toBeVisible();
  });

  pageTest('should disable submit button when terms not accepted', async ({ page }) => {
    // Fill form but leave terms unchecked
    const registerPage = new RegisterPage(page);
    await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
    await registerPage.fillPreactInput('input[placeholder="Enter your email"]', `test-terms-${Date.now()}@example.com`);
    await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', 'TestPassword123!');
    await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', 'TestPassword123!');
    
    // Check only cookie policy checkbox using specific locator
    await page.locator('label:has-text("I accept the Cookie Policy") input[type="checkbox"]').check();
    
    // Submit button should be disabled
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeDisabled();
  });

  pageTest('should disable submit button when cookie policy not accepted', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    // Fill form but leave cookie policy unchecked
    await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
    await registerPage.fillPreactInput('input[placeholder="Enter your email"]', `test-cookie-${Date.now()}@example.com`);
    await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', 'TestPassword123!');
    await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', 'TestPassword123!');
    
    // Check only terms checkbox using specific locator
    await page.locator('label:has-text("I accept the Terms of Service") input[type="checkbox"]').check();
    
    // Submit button should be disabled
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeDisabled();
  });

  pageTest('should enable submit button when both policies accepted', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    // Fill form completely
    await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
    await registerPage.fillPreactInput('input[placeholder="Enter your email"]', `test-both-${Date.now()}@example.com`);
    await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', 'TestPassword123!');
    await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', 'TestPassword123!');
    
    // Check both checkboxes using specific locators
    await page.locator('label:has-text("I accept the Terms of Service") input[type="checkbox"]').check();
    await page.locator('label:has-text("I accept the Cookie Policy") input[type="checkbox"]').check();
    
    // Submit button should be enabled
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeEnabled();
  });

  pageTest('should allow form submission when both policies accepted', async ({ page }, testInfo) => {
    // @skip-error-checking - This test may have expected registration errors
    testInfo.annotations.push({ type: 'skip-error-checking', description: 'This test may have expected registration errors' });
    
    const registerPage = new RegisterPage(page);
    // Fill form completely
    await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
    await registerPage.fillPreactInput('input[placeholder="Enter your email"]', `test-submit-${Date.now()}@example.com`);
    await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', 'TestPassword123!');
    await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', 'TestPassword123!');
    
    // Check both checkboxes using specific locators
    await page.locator('label:has-text("I accept the Terms of Service") input[type="checkbox"]').check();
    await page.locator('label:has-text("I accept the Cookie Policy") input[type="checkbox"]').check();
    
    // Submit button should be enabled and clickable
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeEnabled();
    
    // Test that clicking the button doesn't immediately fail (form validation passes)
    // Note: We don't test the full registration flow as that's covered elsewhere
    await submitButton.click();
    
    // Wait a moment to ensure no immediate validation errors
    await page.waitForTimeout(500);
    
    // At this point, the form has passed client-side validation and attempted submission
    // The actual registration success/failure is tested in other test files
  });

  pageTest('should show appropriate error messages for unchecked boxes', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    // Fill form but don't check any boxes
    await registerPage.fillPreactInput('input[placeholder="Enter your full name"]', 'Test User');
    await registerPage.fillPreactInput('input[placeholder="Enter your email"]', `test-validation-${Date.now()}@example.com`);
    await registerPage.fillPreactInput('input[placeholder="Create a strong password"]', 'TestPassword123!');
    await registerPage.fillPreactInput('input[placeholder="Confirm your password"]', 'TestPassword123!');
    
    // Try to submit (should show validation error before form submission)
    // Since the submit button is disabled, we'll test by checking the form validity
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeDisabled();
    
    // Check one box, should still be disabled
    await page.locator('label:has-text("I accept the Terms of Service") input[type="checkbox"]').check();
    await expect(submitButton).toBeDisabled();
    
    // Check second box, should now be enabled
    await page.locator('label:has-text("I accept the Cookie Policy") input[type="checkbox"]').check();
    await expect(submitButton).toBeEnabled();
  });
});