import { test, expect } from '../fixtures/base-test';
import { setupConsoleErrorReporting, setupMCPDebugOnFailure } from '../helpers';
import { MultiUserWorkflow } from '../workflows/multi-user.workflow';

// Enable console error reporting and MCP debugging
setupConsoleErrorReporting();
setupMCPDebugOnFailure();

test.describe('Complex Unsettled Group Scenario', () => {
  test('create group with multiple people and expenses that is NOT settled', async ({ page, browser }) => {
    const workflow = new MultiUserWorkflow(browser);
    
    // Add users
    const { user: alice } = await workflow.addUser();
    const { user: bob } = await workflow.addUser();
    
    // Create group with Alice
    const groupId = await workflow.createGroupWithFirstUser('Vacation Trip 2024', 'Beach house rental and activities');
    
    // Add Bob to the group
    await workflow.addUsersToGroup();
    
    // Alice adds beach house expense ($800)
    await workflow.addExpense('Beach House Rental', 800.00, 0);
    
    // Bob adds restaurant expense ($120)
    await workflow.addExpense('Restaurant Dinner', 120.00, 1);
    
    // Verify expenses and balances on Alice's page
    const users = workflow.getUsers();
    const alicePage = users[0].page;
    
    await alicePage.reload();
    await alicePage.waitForLoadState('networkidle');
    // Wait for balance section to be visible - indicates data loaded
    await expect(alicePage.getByRole('heading', { name: /balance/i })).toBeVisible();
    
    // Verify both expenses are visible
    const expenses = workflow.getExpenses();
    expect(expenses).toHaveLength(2);
    expect(expenses.map(e => e.description)).toContain('Beach House Rental');
    expect(expenses.map(e => e.description)).toContain('Restaurant Dinner');
    
    // Verify balances section shows unsettled state
    const balanceSection = alicePage.getByRole('heading', { name: /balance/i }).locator('..');
    await expect(balanceSection).toBeVisible();
    
    // With Alice paying $800 and Bob paying $120, there should be a balance showing
    await expect(balanceSection.getByText(/\$/)).toBeVisible();
    
    // Verify member count shows 2 members
    await expect(alicePage.getByText(/2 members/i)).toBeVisible();
    
    // Let Playwright handle cleanup automatically
    await workflow.cleanup();
  });
});