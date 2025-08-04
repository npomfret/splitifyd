import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { AuthenticationWorkflow } from '../workflows/authentication.workflow';
import { DashboardPage, CreateGroupModalPage } from '../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Group Details E2E', () => {
  test('should display group information', async ({ page }) => {
    const user = await AuthenticationWorkflow.createTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboardPage.openCreateGroupModal();
    await createGroupModal.createGroup('Test Group Details', 'Test group for details page');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(page.getByRole('heading', { name: 'Test Group Details' })).toBeVisible();
    
    await expect(page.getByText('Test group for details page')).toBeVisible();
    
    const userNameElement = page.getByText(user.displayName).first();
    await expect(userNameElement).toBeVisible();
    
    await expect(page.getByText(/1 member/i)).toBeVisible();
  });

  test('should display empty expense list', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboardPage.openCreateGroupModal();
    await createGroupModal.createGroup('Empty Expenses Group', 'Group with no expenses');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(page.getByText(/no expenses yet/i)).toBeVisible();
    
    await expect(page.getByRole('button', { name: /add expense/i })).toBeVisible();
  });

  test('should show group balances section', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboardPage.openCreateGroupModal();
    await createGroupModal.createGroup('Balance Test Group', 'Group for testing balances');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await expect(page.getByRole('heading', { name: /balances/i })).toBeVisible();
  });

  test('should have navigation back to dashboard', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboardPage.openCreateGroupModal();
    await createGroupModal.createGroup('Navigation Test Group', 'Test description');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show group settings or options', async ({ page }) => {
    await AuthenticationWorkflow.createTestUser(page);
    
    const dashboardPage = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    
    await dashboardPage.openCreateGroupModal();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Settings Test Group', 'Test description for settings');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    const settingsElement = page.getByRole('button', { name: /settings/i });
    
    await expect(settingsElement).toBeVisible();
  });
});