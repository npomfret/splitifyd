import { test } from '@playwright/test';
import path from 'path';
import { mkdir } from 'fs/promises';
import { RegisterPage } from '../../pages';

test('generate walkthrough screenshots', async ({ page }) => {
  const screenshotsDir = path.join(process.cwd(), '..', 'tmp', 'screenshots', 'walkthrough');
  
  // Initialize page objects
  const registerPage = new RegisterPage(page);
  
  // Ensure the screenshots directory exists
  await mkdir(screenshotsDir, { recursive: true });
  
  console.log('Generating walkthrough screenshots...');
  
  // Register page - empty
  console.log('📸 Capturing register page (empty)...');
  await registerPage.navigate();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ 
    path: path.join(screenshotsDir, '01-register-empty.png'),
    fullPage: true 
  });
  
  // Register page with validation errors
  console.log('📸 Capturing register page with validation errors...');
  // Fill in form with all required fields but with validation errors
  await page.fill('input[placeholder*="name"]', 'Test User');
  await page.fill('input[type="email"]', 'notanemail');  // Invalid email
  await page.fill('input[type="password"]', '123');      // Too short password
  await page.fill('input[placeholder*="Confirm"]', '456'); // Mismatched password
  
  // Check the terms checkbox if present
  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  if (await termsCheckbox.count() > 0) {
    await termsCheckbox.check();
  }
  
  // Try to submit to trigger validation (force click even if disabled)
  await page.click('button[type="submit"]', { force: true });
  await page.waitForTimeout(500); // Wait for validation messages to appear
  
  await page.screenshot({ 
    path: path.join(screenshotsDir, '02-register-validation-errors.png'),
    fullPage: true 
  });
  
  console.log('✅ Screenshots generated successfully!');
  const absolutePath = path.resolve(screenshotsDir);
  console.log(`📁 Screenshots saved to: ${absolutePath}`);
});