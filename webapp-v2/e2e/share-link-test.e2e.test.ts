import { test, expect } from './fixtures/base-test';
import { setupConsoleErrorReporting } from './helpers';
import { createAndLoginTestUser } from './helpers/auth-utils';
import { CreateGroupModalPage } from './pages';

// Enable console error reporting
setupConsoleErrorReporting();

test('share link functionality works', async ({ page }) => {
  test.setTimeout(10000);
  
  // Create user and group
  await createAndLoginTestUser(page);
  const createGroupModal = new CreateGroupModalPage(page);
  
  await page.getByRole('button', { name: 'Create Group' }).click();
  await page.waitForTimeout(500);
  await createGroupModal.createGroup('Share Test Group', 'Testing share functionality');
  
  await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
  
  // Look for any share/invite UI
  const shareElements = page.getByRole('button', { name: /share|invite|add.*member/i })
    .or(page.getByRole('link', { name: /share|invite/i }))
    .or(page.getByText(/share|invite.*link/i));
  
  const hasShareUI = await shareElements.count() > 0;
  console.log('Share UI found:', hasShareUI);
  
  if (!hasShareUI) {
    console.log('❌ No share/invite functionality found in the UI');
    throw new Error('Share functionality not implemented or visible');
  }
  
  // Click share
  await shareElements.first().click();
  await page.waitForTimeout(1000);
  
  // Look for any share link or invite UI
  const linkElements = page.locator('input[readonly]')
    .or(page.locator('input').filter({ hasText: /join|share|invite/i }))
    .or(page.getByText(/localhost.*join/i));
  
  const hasLinkUI = await linkElements.count() > 0;
  console.log('Share link UI found:', hasLinkUI);
  
  if (!hasLinkUI) {
    console.log('❌ No share link UI found after clicking share');
    throw new Error('Share link UI not found');
  }
  
  console.log('✅ Share functionality appears to be working');
});