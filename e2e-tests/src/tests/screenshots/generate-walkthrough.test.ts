import { test } from '@playwright/test';
import path from 'path';
import { mkdir } from 'fs/promises';
import { RegisterPage, LoginPage, DashboardPage, GroupDetailPage } from '../../pages';

test('generate walkthrough screenshots', async ({ page }) => {
  const screenshotsDir = path.join(process.cwd(), '..', 'tmp', 'screenshots', 'walkthrough');
  
  // Initialize page objects
  const registerPage = new RegisterPage(page);
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const groupDetailPage = new GroupDetailPage(page);
  
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
  
  // Login with existing user to show dashboard with content
  console.log('📸 Logging in with existing user...');
  await loginPage.navigate();
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot of the login page first
  await page.screenshot({ 
    path: path.join(screenshotsDir, '03-login-page.png'),
    fullPage: true 
  });
  
  await loginPage.login('test1@test.com', 'rrRR44$$');
  
  // Wait for dashboard to load with a more flexible approach
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
    console.log('Dashboard redirect failed, checking current URL:', page.url());
  });
  await page.waitForLoadState('networkidle');
  
  console.log('📸 Capturing dashboard with content...');
  await page.screenshot({ 
    path: path.join(screenshotsDir, '04-dashboard-with-content.png'),
    fullPage: true 
  });
  
  // Find a group with unsettled expenses
  console.log('📸 Looking for unsettled group...');
  
  // Wait a bit for groups to load
  await page.waitForTimeout(1000);
  
  // Look for group cards that show a balance (indicating unsettled expenses)
  // Try multiple selectors as the data-testid might not be present
  let groupCards = page.locator('[data-testid="group-card"]');
  let groupCount = await groupCards.count();
  
  // If no groups found with data-testid, try other selectors
  if (groupCount === 0) {
    console.log('Trying alternative selectors for group cards...');
    groupCards = page.locator('.group-card, [class*="group"], a[href*="/groups/"]').filter({ hasText: /\w/ });
    groupCount = await groupCards.count();
  }
  
  if (groupCount > 0) {
    // Click on the first group with a balance indicator
    // Groups with balances typically show "You owe" or "You are owed" text
    let foundUnsettledGroup = false;
    
    for (let i = 0; i < groupCount; i++) {
      const card = groupCards.nth(i);
      const cardText = await card.textContent();
      
      // Check if this group has unsettled expenses
      if (cardText && (cardText.includes('owe') || cardText.includes('owed'))) {
        console.log(`📸 Found unsettled group: clicking group ${i + 1}...`);
        await card.click();
        foundUnsettledGroup = true;
        break;
      }
    }
    
    // If no unsettled group found, just click the first one
    if (!foundUnsettledGroup && groupCount > 0) {
      console.log('📸 No unsettled groups found, clicking first group...');
      await groupCards.first().click();
    }
    
    // Wait for group detail page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Extra wait for animations
    
    console.log('📸 Capturing group detail page with expenses...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '05-group-detail-unsettled.png'),
      fullPage: true 
    });
  } else {
    console.log('⚠️ No groups found on dashboard');
  }
  
  console.log('✅ Screenshots generated successfully!');
  const absolutePath = path.resolve(screenshotsDir);
  console.log(`📁 Screenshots saved to: ${absolutePath}`);
});