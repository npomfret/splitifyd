import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { createAndLoginTestUser } from '../helpers/auth-utils';
import { CreateGroupModalPage, GroupDetailPage } from '../pages';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Complex Unsettled Group Scenario', () => {
  test('create group with multiple people and expenses that is NOT settled', async ({ page, browser }) => {
    // Create User 1 (Alice - the group creator)
    const user1 = await createAndLoginTestUser(page);

    // Create a group for vacation expenses
    const createGroupModal = new CreateGroupModalPage(page);
    await page.getByRole('button', { name: 'Create Group' }).click();
    await page.waitForLoadState('domcontentloaded');
    await createGroupModal.createGroup('Vacation Trip 2024', 'Beach house rental and activities');
    
    // Wait for navigation to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9]+/);
    const groupUrl = page.url();

    // Verify Alice is in the group
    await expect(page.getByText('Vacation Trip 2024')).toBeVisible();
    await expect(page.getByRole('main').getByText(user1.displayName)).toBeVisible();
    
    // Get share link for second user
    const shareButton = page.getByRole('button', { name: /share/i });
    await shareButton.click();
    const shareLinkInput = page.getByRole('dialog').getByRole('textbox');
    const shareLink = await shareLinkInput.inputValue();
    await page.keyboard.press('Escape');
    
    // Alice adds the first expense: Beach house rental ($800)
    const groupDetailPage = new GroupDetailPage(page);
    await groupDetailPage.addExpense({
      description: 'Beach House Rental',
      amount: 800.00,
      paidBy: user1.displayName,
      splitType: 'equal'
    });
    
    // Verify expense appears using data-testid to avoid strict mode violation
    const expenseItems = await groupDetailPage.getExpenseItems();
    expect(expenseItems.length).toBe(1);
    
    // Verify expense details using specific selectors
    const firstExpense = expenseItems[0];
    await expect(firstExpense.locator('[data-testid="expense-description"]')).toContainText('Beach House Rental');
    await expect(firstExpense.locator('[data-testid="expense-amount"]')).toContainText('800');
    
    // Create User 2 (Bob) and have them join the group
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = await createAndLoginTestUser(page2);
    
    // Bob joins via share link
    await page2.goto(shareLink);
    await page2.waitForLoadState('networkidle');
    await expect(page2).toHaveURL(groupUrl);
    
    // Bob adds an expense: Restaurant dinner ($120)
    const groupDetailPage2 = new GroupDetailPage(page2);
    await groupDetailPage2.addExpense({
      description: 'Restaurant Dinner',
      amount: 120.00,
      paidBy: user2.displayName,
      splitType: 'equal'
    });
    
    // Back to Alice's view - check all expenses are visible
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify all expenses are visible using proper selectors
    const allExpenseItems = await groupDetailPage.getExpenseItems();
    expect(allExpenseItems.length).toBe(2);
    
    // Verify both expenses using data-testid selectors to avoid strict mode violations
    const expenseDescriptions = await Promise.all(
      allExpenseItems.map(item => 
        item.locator('[data-testid="expense-description"]').textContent()
      )
    );
    
    expect(expenseDescriptions).toContain('Beach House Rental');
    expect(expenseDescriptions).toContain('Restaurant Dinner');
    
    // Verify balances section exists
    const balanceSection = page.getByRole('heading', { name: /balance/i }).locator('..');
    await expect(balanceSection).toBeVisible();
    
    // With 2 members and different expense amounts, the group should be unsettled
    // Alice paid $800, Bob paid $120, so there should be a balance
    const balanceText = balanceSection.getByText(/owes|owed/i)
      .or(balanceSection.getByText(/\$/));
    await expect(balanceText.first()).toBeVisible();
    
    // Verify member count shows 2 members
    await expect(page.getByText(/2 members/i)).toBeVisible();
    
    // Clean up
    await context2.close();
  });
});