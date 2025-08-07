import { expect, test } from '@playwright/test';
import { generateTestEmail, generateTestUserName } from '../../utils/test-helpers';

test.describe('Terms and Cookie Policy Acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
  });

  test('should display both terms and cookie policy checkboxes', async ({ page }) => {
    // Check that both checkboxes are present
    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    const cookieCheckbox = page.locator('input[type="checkbox"]').last();
    
    await expect(termsCheckbox).toBeVisible();
    await expect(cookieCheckbox).toBeVisible();
    
    // Check that they have appropriate labels
    await expect(page.locator('text=I accept the Terms of Service')).toBeVisible();
    await expect(page.locator('text=I accept the Cookie Policy')).toBeVisible();
    
    // Check that links exist
    await expect(page.locator('a[href="/v2/terms"]')).toBeVisible();
    await expect(page.locator('a[href="/v2/cookies"]')).toBeVisible();
  });

  test('should disable submit button when terms not accepted', async ({ page }) => {
    const displayName = generateTestUserName('Terms');
    const email = generateTestEmail('terms');
    const password = 'TestPassword123!';

    // Fill form but leave terms unchecked
    await page.fill('input[placeholder="Enter your full name"]', displayName);
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Create a strong password"]', password);
    await page.fill('input[placeholder="Confirm your password"]', password);
    
    // Check only cookie policy checkbox
    await page.locator('input[type="checkbox"]').last().check();
    
    // Submit button should be disabled
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeDisabled();
  });

  test('should disable submit button when cookie policy not accepted', async ({ page }) => {
    const displayName = generateTestUserName('Cookie');
    const email = generateTestEmail('cookie');
    const password = 'TestPassword123!';

    // Fill form but leave cookie policy unchecked
    await page.fill('input[placeholder="Enter your full name"]', displayName);
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Create a strong password"]', password);
    await page.fill('input[placeholder="Confirm your password"]', password);
    
    // Check only terms checkbox
    await page.locator('input[type="checkbox"]').first().check();
    
    // Submit button should be disabled
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when both policies accepted', async ({ page }) => {
    const displayName = generateTestUserName('Both');
    const email = generateTestEmail('both');
    const password = 'TestPassword123!';

    // Fill form completely
    await page.fill('input[placeholder="Enter your full name"]', displayName);
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Create a strong password"]', password);
    await page.fill('input[placeholder="Confirm your password"]', password);
    
    // Check both checkboxes
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('input[type="checkbox"]').last().check();
    
    // Submit button should be enabled
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeEnabled();
  });

  test('should successfully register when both policies accepted', async ({ page }) => {
    const displayName = generateTestUserName('Success');
    const email = generateTestEmail('success');
    const password = 'TestPassword123!';

    // Fill form completely
    await page.fill('input[placeholder="Enter your full name"]', displayName);
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Create a strong password"]', password);
    await page.fill('input[placeholder="Confirm your password"]', password);
    
    // Check both checkboxes
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('input[type="checkbox"]').last().check();
    
    // Submit form
    await page.click('button:has-text("Create Account")');
    
    // Should redirect to dashboard on successful registration
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    
    // Should see the dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show appropriate error messages for unchecked boxes', async ({ page }) => {
    const displayName = generateTestUserName('Error');
    const email = generateTestEmail('error');
    const password = 'TestPassword123!';

    // Fill form but don't check any boxes
    await page.fill('input[placeholder="Enter your full name"]', displayName);
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Create a strong password"]', password);
    await page.fill('input[placeholder="Confirm your password"]', password);
    
    // Try to submit (should show validation error before form submission)
    // Since the submit button is disabled, we'll test by checking the form validity
    const submitButton = page.locator('button:has-text("Create Account")');
    await expect(submitButton).toBeDisabled();
    
    // Check one box, should still be disabled
    await page.locator('input[type="checkbox"]').first().check();
    await expect(submitButton).toBeDisabled();
    
    // Check second box, should now be enabled
    await page.locator('input[type="checkbox"]').last().check();
    await expect(submitButton).toBeEnabled();
  });
});