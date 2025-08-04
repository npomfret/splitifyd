import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, GroupWorkflow } from '../helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Group Details E2E', () => {
  test('should display group information', async ({ page }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Test Group Details', 'Test group for details page');
    const user = groupInfo.user;
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(page.getByRole('heading', { name: 'Test Group Details' })).toBeVisible();
    
    await expect(page.getByText('Test group for details page')).toBeVisible();
    
    const userNameElement = page.getByText(user.displayName).first();
    await expect(userNameElement).toBeVisible();
    
    await expect(page.getByText(/1 member/i)).toBeVisible();
  });

  test('should display empty expense list', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Empty Expenses Group', 'Group with no expenses');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(page.getByText(/no expenses yet/i)).toBeVisible();
    
    await expect(page.getByRole('button', { name: /add expense/i })).toBeVisible();
  });

  test('should show group balances section', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Balance Test Group', 'Group for testing balances');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(page.getByRole('heading', { name: /balances/i })).toBeVisible();
  });

  test('should have navigation back to dashboard', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Navigation Test Group', 'Test description');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show group settings or options', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Settings Test Group', 'Test description for settings');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    const settingsElement = page.getByRole('button', { name: /settings/i });
    
    await expect(settingsElement).toBeVisible();
  });
});