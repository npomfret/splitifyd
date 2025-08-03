import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, DashboardPage } from '../pages';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Basic Operations E2E', () => {
  test('should create and view an expense', async ({ page }) => {
    const user = await createAndLoginTestUser(page);
    
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Test Group', 'Testing expense creation');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    const addExpenseButton = page.getByRole('button', { name: /add expense/i });
    await addExpenseButton.click();
    
    await expect(page.getByPlaceholder('What was this expense for?')).toBeVisible();
    
    const descriptionField = page.getByPlaceholder('What was this expense for?');
    const amountField = page.getByPlaceholder('0.00');
    
    await descriptionField.fill('Test Expense');
    await amountField.fill('50.00');
    
    const submitButton = page.getByRole('button', { name: 'Save Expense' });
    await submitButton.click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    await expect(page.getByText('Test Expense')).toBeVisible();
    
    await page.getByText('Test Expense').click();
    await page.waitForLoadState('domcontentloaded');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+\/expenses\/[a-zA-Z0-9]+/);
    await expect(page.getByText('Test Expense')).toBeVisible();
    await expect(page.getByText('$50.00').first()).toBeVisible();
  });

  test('should handle multi-user expense visibility', async ({ page, browser }) => {
    const user1 = await createAndLoginTestUser(page);
    
    const dashboard = new DashboardPage(page);
    const createGroupModal = new CreateGroupModalPage(page);
    await dashboard.openCreateGroupModal();
    await createGroupModal.createGroup('Shared Group', 'Testing multi-user');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    const groupUrl = page.url();
    
    await page.getByRole('button', { name: /add expense/i }).click();
    await page.getByPlaceholder('What was this expense for?').fill('Shared Expense');
    await page.getByPlaceholder('0.00').fill('100.00');
    await page.getByRole('button', { name: 'Save Expense' }).click();
    await page.waitForURL(/\/groups\/[a-zA-Z0-9]+$/);
    
    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    const shareModal = page.locator('.fixed.inset-0').filter({ has: page.getByText(/share.*group/i) });
    const shareLinkInput = shareModal.getByRole('textbox');
    const shareLink = await shareLinkInput.inputValue();
    await page.keyboard.press('Escape');
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await createAndLoginTestUser(page2);
    
    const url = new URL(shareLink);
    const joinPath = url.pathname + url.search;
    await page2.goto(joinPath);
    await page2.waitForURL(/\/groups\/[a-zA-Z0-9]+$/, { timeout: 15000 });
    
    await expect(page2.getByText('Shared Expense')).toBeVisible();
    await expect(page2.getByText('$100.00')).toBeVisible();
    
    await context2.close();
  });
});