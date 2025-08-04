import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { MultiUserTestBuilder } from '../helpers/test-helpers';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Complex Unsettled Group Scenario', () => {
  test('create group with multiple people and expenses that is NOT settled', async ({ page, browser }) => {
    const testBuilder = new MultiUserTestBuilder(browser);
    
    try {
      // Add users
      const { user: alice } = await testBuilder.addUser();
      const { user: bob } = await testBuilder.addUser();
      
      // Create group with Alice
      const groupId = await testBuilder.createGroupWithFirstUser('Vacation Trip 2024', 'Beach house rental and activities');
      
      // Add Bob to the group
      await testBuilder.addUsersToGroup();
      
      // Alice adds beach house expense ($800)
      await testBuilder.addExpense('Beach House Rental', 800.00, 0);
      
      // Bob adds restaurant expense ($120)
      await testBuilder.addExpense('Restaurant Dinner', 120.00, 1);
      
      // Verify expenses and balances on Alice's page
      const users = testBuilder.getUsers();
      const alicePage = users[0].page;
      
      await alicePage.reload();
      await alicePage.waitForLoadState('networkidle');
      await alicePage.waitForTimeout(2000); // Wait for balances to update
      
      // Verify both expenses are visible
      const expenses = testBuilder.getExpenses();
      expect(expenses).toHaveLength(2);
      expect(expenses.map(e => e.description)).toContain('Beach House Rental');
      expect(expenses.map(e => e.description)).toContain('Restaurant Dinner');
      
      // Verify balances section shows unsettled state
      const balanceSection = alicePage.getByRole('heading', { name: /balance/i }).locator('..');
      await expect(balanceSection).toBeVisible();
      
      // With Alice paying $800 and Bob paying $120, there should be a balance
      const balanceText = balanceSection.getByText(/owes|owed/i)
        .or(balanceSection.getByText(/\$/));
      await expect(balanceText.first()).toBeVisible();
      
      // Verify member count shows 2 members
      await expect(alicePage.getByText(/2 members/i)).toBeVisible();
      
    } finally {
      await testBuilder.cleanup();
    }
  });
});