import { authenticatedPageTest as test, expect } from '../../fixtures/authenticated-page-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../../helpers/index';
import { GroupWorkflow } from '../../workflows/index';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Group Details E2E', () => {
  test('should display group information', async ({ authenticatedPage, groupDetailPage }) => {
    const { page, user } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup('Test Group Details', 'Test group for details page');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(groupDetailPage.getGroupTitle()).toContainText('Test Group Details');
    
    await expect(groupDetailPage.getGroupDescription()).toBeVisible();
    
    const userNameElement = groupDetailPage.getUserName(user.displayName);
    await expect(userNameElement).toBeVisible();
    
    await expect(groupDetailPage.getMembersCount()).toBeVisible();
  });

  test('should display empty expense list', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup('Empty Expenses Group', 'Group with no expenses');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(groupDetailPage.getNoExpensesMessage()).toBeVisible();
    
    await expect(groupDetailPage.getAddExpenseButton()).toBeVisible();
  });

  test('should show group balances section', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup('Balance Test Group', 'Group for testing balances');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(groupDetailPage.getBalancesHeading()).toBeVisible();
  });

  test('should have navigation back to dashboard', async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup('Navigation Test Group', 'Test description');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show group settings or options', async ({ authenticatedPage, groupDetailPage }) => {
    const { page } = authenticatedPage;
    const groupWorkflow = new GroupWorkflow(page);
    await groupWorkflow.createGroup('Settings Test Group', 'Test description for settings');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    const settingsElement = page.getByRole('button', { name: /settings/i });
    
    await expect(settingsElement).toBeVisible();
  });
});