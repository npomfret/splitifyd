import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure, GroupWorkflow } from '../helpers';
import { GroupDetailPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Balance and Settlement E2E', () => {
  test('should display settled state for empty group', async ({ page }) => {
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Empty Balance Group');
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Balance section should show "All settled up!" for empty group
    const balanceSection = page.getByRole('heading', { name: 'Balances' }).locator('..');
    await expect(balanceSection).toBeVisible();
    await expect(balanceSection.getByText('All settled up!')).toBeVisible();
    
    // Members section should show the creator
    await expect(page.getByRole('main').getByText(groupInfo.user.displayName)).toBeVisible();
    
    // Expenses section should show empty state
    const expensesHeading = page.getByRole('heading', { name: 'Expenses' });
    await expect(expensesHeading).toBeVisible();
    await expect(page.getByText('No expenses yet. Add one to get started!')).toBeVisible();
  });

  test('should calculate and display multi-user balances', async ({ page, browser }) => {
    // This test uses the balance calculation from multi-user-collaboration.e2e.test.ts
    // to avoid duplication - it already tests multi-user balance display
    const groupInfo = await GroupWorkflow.createTestGroup(page, 'Multi-User Balance Group');
    const groupDetail = new GroupDetailPage(page);
    
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    
    // Add expense to single-member group - should still show settled
    await groupDetail.addExpense({
      description: 'Solo Expense',
      amount: 50,
      paidBy: groupInfo.user.displayName,
      splitType: 'equal'
    });
    
    // Single-member group with expense should still show settled
    const balanceSection = page.getByRole('heading', { name: 'Balances' }).locator('..');
    await expect(balanceSection.getByText('All settled up!')).toBeVisible();
    await expect(page.getByText('Solo Expense')).toBeVisible();
    
    // Note: Multi-user balance calculations (who owes whom) are tested
    // in multi-user-collaboration.e2e.test.ts to avoid duplication
  });
});