import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, GroupWorkflow } from '../helpers';
import { GroupDetailPage } from '../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Group Details E2E', () => {
  test('should display group information', async ({ page }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Test Group Details', 'Test group for details page');
    const user = groupInfo.user;
    const groupDetailPage = new GroupDetailPage(page);
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(groupDetailPage.getGroupTitle()).toContainText('Test Group Details');
    
    await expect(groupDetailPage.getGroupDescription()).toBeVisible();
    
    const userNameElement = groupDetailPage.getUserName(user.displayName);
    await expect(userNameElement).toBeVisible();
    
    await expect(groupDetailPage.getMembersCount()).toBeVisible();
  });

  test('should display empty expense list', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Empty Expenses Group', 'Group with no expenses');
    const groupDetailPage = new GroupDetailPage(page);
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(groupDetailPage.getNoExpensesMessage()).toBeVisible();
    
    await expect(groupDetailPage.getAddExpenseButton()).toBeVisible();
  });

  test('should show group balances section', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Balance Test Group', 'Group for testing balances');
    const groupDetailPage = new GroupDetailPage(page);
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
  });

  test('should have navigation back to dashboard', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Navigation Test Group', 'Test description');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show group settings or options', async ({ page }) => {
    await GroupWorkflow.createTestGroup(page, 'Settings Test Group', 'Test description for settings');
    const groupDetailPage = new GroupDetailPage(page);
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    const settingsElement = page.getByRole('button', { name: /settings/i });
    
    await expect(settingsElement).toBeVisible();
  });
});