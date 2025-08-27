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
  
  // Register page
  console.log('📸 Capturing register page...');
  await registerPage.navigate();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ 
    path: path.join(screenshotsDir, '02-register.png'),
    fullPage: true 
  });
  
  console.log('✅ Screenshots generated successfully!');
  const absolutePath = path.resolve(screenshotsDir);
  console.log(`📁 Screenshots saved to: ${absolutePath}`);
});